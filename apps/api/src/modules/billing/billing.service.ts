import { AUDIT_ACTIONS, PLAN_DEFINITIONS, PLAN_IDS, type PlanTier } from "@flowboard/shared";
import Stripe from "stripe";
import { billingMode, env } from "../../config/env.js";
import { recordActivity } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { assertPlanFitsUsage, getWorkspaceSubscription } from "../../lib/limits.js";
import { prisma } from "../../lib/prisma.js";
import type { TenantContext } from "../../lib/access.js";

function stripeClient() {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY);
}

function priceFor(tier: PlanTier) {
  if (tier === "PRO") return env.STRIPE_PRICE_PRO;
  if (tier === "BUSINESS") return env.STRIPE_PRICE_BUSINESS;
  return undefined;
}

async function usage(workspaceId: string) {
  const [projects, members, tasks] = await Promise.all([
    prisma.project.count({ where: { workspaceId, deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.task.count({ where: { workspaceId, deletedAt: null } }),
  ]);
  return { projects, members, tasks };
}

async function applyPlan(workspaceId: string, tier: PlanTier, extra?: { stripeCustomerId?: string; stripeSubscriptionId?: string; currentPeriodEnd?: Date | null; status?: "ACTIVE" | "CANCELED" | "PAST_DUE" }) {
  await prisma.subscription.update({
    where: { workspaceId },
    data: {
      planId: PLAN_IDS[tier],
      status: extra?.status ?? "ACTIVE",
      stripeCustomerId: extra?.stripeCustomerId,
      stripeSubscriptionId: extra?.stripeSubscriptionId,
      currentPeriodEnd: extra?.currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
  });
}

export const billingService = {
  mode: billingMode,

  async listPlans() {
    const plans = await prisma.plan.findMany({ orderBy: { monthlyPriceCents: "asc" } });
    return plans.map((plan) => ({
      ...plan,
      mode: billingMode,
    }));
  },

  async ensurePlans() {
    for (const plan of PLAN_DEFINITIONS) {
      await prisma.plan.upsert({
        where: { tier: plan.tier },
        update: {
          name: plan.name,
          description: plan.description,
          maxProjects: plan.maxProjects,
          maxMembers: plan.maxMembers,
          maxTasks: plan.maxTasks,
          advancedReports: plan.advancedReports,
          prioritySupport: plan.prioritySupport,
          customIntegrations: plan.customIntegrations,
          monthlyPriceCents: plan.monthlyPriceCents,
          stripePriceId: priceFor(plan.tier) ?? undefined,
        },
        create: {
          id: PLAN_IDS[plan.tier],
          tier: plan.tier,
          name: plan.name,
          description: plan.description,
          maxProjects: plan.maxProjects,
          maxMembers: plan.maxMembers,
          maxTasks: plan.maxTasks,
          advancedReports: plan.advancedReports,
          prioritySupport: plan.prioritySupport,
          customIntegrations: plan.customIntegrations,
          monthlyPriceCents: plan.monthlyPriceCents,
          stripePriceId: priceFor(plan.tier),
        },
      });
    }
  },

  async get(tenant: TenantContext) {
    const subscription = await getWorkspaceSubscription(tenant.workspaceId);
    return {
      mode: billingMode,
      subscription: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd,
        stripeCustomerId: subscription.stripeCustomerId ? "linked" : null,
      },
      plan: subscription.plan,
      usage: await usage(tenant.workspaceId),
    };
  },

  async checkout(tenant: TenantContext, tier: Exclude<PlanTier, "FREE">) {
    await assertPlanFitsUsage(tenant.workspaceId, tier);
    const stripe = stripeClient();
    const price = priceFor(tier);
    if (!stripe || !price) {
      return {
        mode: "mock" as const,
        message: "Stripe is not configured. Billing is running in demo mode.",
        url: null,
      };
    }
    const subscription = await getWorkspaceSubscription(tenant.workspaceId);
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: tenant.workspaceId } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: tenant.userId } });
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: workspace.name,
        metadata: { workspaceId: tenant.workspaceId },
      });
      customerId = customer.id;
      await prisma.subscription.update({ where: { workspaceId: tenant.workspaceId }, data: { stripeCustomerId: customerId } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${env.APP_URL}/app/billing?checkout=success`,
      cancel_url: `${env.APP_URL}/app/billing?checkout=cancel`,
      metadata: { workspaceId: tenant.workspaceId, planTier: tier },
      subscription_data: { metadata: { workspaceId: tenant.workspaceId, planTier: tier } },
    });
    return { mode: "stripe" as const, url: session.url };
  },

  async portal(tenant: TenantContext) {
    const stripe = stripeClient();
    const subscription = await getWorkspaceSubscription(tenant.workspaceId);
    if (!stripe || !subscription.stripeCustomerId) {
      throw Errors.badRequest("The billing portal is available after a Stripe subscription exists. Demo mode can change plans directly.");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env.APP_URL}/app/billing`,
    });
    return { url: session.url };
  },

  async mockActivate(tenant: TenantContext, tier: PlanTier) {
    if (billingMode !== "mock") throw Errors.badRequest("Demo activation is disabled while Stripe is configured");
    await assertPlanFitsUsage(tenant.workspaceId, tier);
    const current = await getWorkspaceSubscription(tenant.workspaceId);
    await applyPlan(tenant.workspaceId, tier, {
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      status: "ACTIVE",
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "billing",
      entityId: tenant.workspaceId,
      action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
      metadata: { from: current.plan.tier, to: tier, mode: "mock" },
    });
    return this.get(tenant);
  },

  async cancel(tenant: TenantContext, when: "period_end" | "now") {
    const stripe = stripeClient();
    const subscription = await getWorkspaceSubscription(tenant.workspaceId);
    if (when === "now") {
      if (stripe && subscription.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      }
      await applyPlan(tenant.workspaceId, "FREE", { status: "ACTIVE", currentPeriodEnd: null });
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "billing",
        entityId: tenant.workspaceId,
        action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
        metadata: { from: subscription.plan.tier, to: "FREE", when },
      });
      return this.get(tenant);
    }
    if (stripe && subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: true });
    }
    await prisma.subscription.update({
      where: { workspaceId: tenant.workspaceId },
      data: { cancelAtPeriodEnd: true, currentPeriodEnd: subscription.currentPeriodEnd ?? new Date(Date.now() + 30 * 86400000) },
    });
    return this.get(tenant);
  },

  async handleWebhook(raw: Buffer, signature: string | undefined) {
    const stripe = stripeClient();
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw Errors.badRequest("Stripe webhooks are disabled in demo billing mode");
    }
    if (!signature) throw Errors.badRequest("Missing Stripe signature");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw Errors.badRequest("Invalid Stripe signature");
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const tier = session.metadata?.planTier as PlanTier | undefined;
      if (workspaceId && tier && tier !== "FREE") {
        await applyPlan(workspaceId, tier, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          status: "ACTIVE",
        });
        await recordActivity({
          workspaceId,
          entityType: "billing",
          entityId: workspaceId,
          action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
          metadata: { to: tier, source: "stripe.checkout" },
        });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspaceId;
      const row = workspaceId
        ? { workspaceId }
        : await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id } });
      if (row) {
        await applyPlan(row.workspaceId, "FREE", { status: "CANCELED" });
        await prisma.subscription.update({ where: { workspaceId: row.workspaceId }, data: { status: "ACTIVE", planId: PLAN_IDS.FREE } });
      }
    }
    return { received: true };
  },

  async sweepExpiredCancellations() {
    const due = await prisma.subscription.findMany({
      where: { cancelAtPeriodEnd: true, currentPeriodEnd: { lt: new Date() }, plan: { tier: { not: "FREE" } } },
    });
    for (const subscription of due) {
      await applyPlan(subscription.workspaceId, "FREE", { status: "ACTIVE", currentPeriodEnd: null });
      await recordActivity({
        workspaceId: subscription.workspaceId,
        entityType: "billing",
        entityId: subscription.workspaceId,
        action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
        metadata: { to: "FREE", source: "period_end" },
      });
    }
  },
};
