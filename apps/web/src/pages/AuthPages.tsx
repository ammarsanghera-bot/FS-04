import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@flowboard/shared";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import type { User, WorkspaceSummary } from "@/lib/types";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-stone-100 lg:flex">
        <div className="font-display text-2xl font-semibold">Flowboard</div>
        <div>
          <h1 className="font-display max-w-md text-4xl font-semibold leading-tight">A workspace for every company. None of them share a board.</h1>
          <p className="mt-4 max-w-md text-stone-300">Projects, sprints, and billing stay inside the workspace you belong to.</p>
        </div>
        {import.meta.env.DEV && (
          <div className="rounded-2xl border border-white/10 p-4 text-sm text-stone-300">
            <p className="font-semibold text-white">Local development seed</p>
            <p className="mt-1">owner@acme.flowboard.dev</p>
            <p>Password123!</p>
          </div>
        )}
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="font-display mb-6 text-3xl font-semibold">{title}</h2>
          {children}
        </div>
      </section>
    </div>
  );
}

function useSession() {
  const setSession = useAuth((state) => state.setSession);
  const navigate = useNavigate();
  return (data: { accessToken: string; user: User; workspaces: WorkspaceSummary[] }) => {
    setSession(data);
    navigate("/app");
  };
}

export function LoginPage() {
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const enter = useSession();
  return (
    <Frame title="Sign in">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            enter(await api("/api/v1/auth/login", { method: "POST", body: JSON.stringify(values) }));
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Sign in failed");
          }
        })}
      >
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...form.register("password")} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
      <p className="mt-4 text-sm text-stone-600"><Link to="/forgot-password" className="font-semibold text-primary">Forgot password</Link> · <Link to="/register">Create a workspace</Link></p>
    </Frame>
  );
}

export function RegisterPage() {
  const form = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  const enter = useSession();
  return (
    <Frame title="Create your workspace">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            enter(await api("/api/v1/auth/register", { method: "POST", body: JSON.stringify(values) }));
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : "Could not register");
          }
        })}
      >
        <div className="space-y-1"><Label htmlFor="name">Your name</Label><Input id="name" {...form.register("name")} /><FieldError message={form.formState.errors.name?.message} /></div>
        <div className="space-y-1"><Label htmlFor="workspace">Workspace</Label><Input id="workspace" {...form.register("workspaceName")} /><FieldError message={form.formState.errors.workspaceName?.message} /></div>
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div>
        <div className="space-y-1"><Label htmlFor="password">Password</Label><Input id="password" type="password" {...form.register("password")} /><FieldError message={form.formState.errors.password?.message} /></div>
        <Button type="submit" className="w-full">Create workspace</Button>
      </form>
      <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-primary">Already have an account</Link></p>
    </Frame>
  );
}

export function ForgotPage() {
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });
  return (
    <Frame title="Reset password">
      <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
        await api("/api/v1/auth/forgot-password", { method: "POST", body: JSON.stringify(values) });
        toast.success("If that account exists, a reset link was sent.");
      })}>
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" {...form.register("email")} /><FieldError message={form.formState.errors.email?.message} /></div>
        <Button type="submit">Send reset link</Button>
      </form>
    </Frame>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const form = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token: params.get("token") ?? "" } });
  const navigate = useNavigate();
  return (
    <Frame title="Choose a new password">
      <form className="space-y-4" onSubmit={form.handleSubmit(async (values) => {
        try {
          await api("/api/v1/auth/reset-password", { method: "POST", body: JSON.stringify(values) });
          toast.success("Password updated");
          navigate("/login");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Reset failed");
        }
      })}>
        <input type="hidden" {...form.register("token")} />
        <div className="space-y-1"><Label htmlFor="password">New password</Label><Input id="password" type="password" {...form.register("password")} /><FieldError message={form.formState.errors.password?.message} /></div>
        <Button type="submit">Update password</Button>
      </form>
    </Frame>
  );
}

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  return (
    <Frame title="Verify email">
      <Button onClick={async () => {
        try {
          await api("/api/v1/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
          toast.success("Email verified");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Verification failed");
        }
      }}>Confirm email</Button>
    </Frame>
  );
}

export function InvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const setWorkspace = useAuth((state) => state.setWorkspace);
  return (
    <Frame title="Accept invitation">
      <p className="mb-4 text-sm text-stone-600">Sign in with the invited email, then accept.</p>
      <Button onClick={async () => {
        try {
          const result = await api<{ workspaceId: string }>("/api/v1/invitations/accept", { method: "POST", body: JSON.stringify({ token }) });
          setWorkspace(result.workspaceId);
          navigate("/app");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Could not accept");
        }
      }}>Accept invitation</Button>
    </Frame>
  );
}
