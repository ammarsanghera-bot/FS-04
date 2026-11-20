import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env.js";

export type JobHandler = (payload: unknown) => Promise<void>;

export interface JobQueue {
  enqueue(name: string, payload?: unknown, delayMs?: number): Promise<void>;
  schedule(name: string, everyMs: number): Promise<void>;
  close(): Promise<void>;
}

const handlers = new Map<string, JobHandler>();

export function registerJob(name: string, handler: JobHandler) {
  handlers.set(name, handler);
}

async function runHandler(name: string, payload: unknown) {
  const handler = handlers.get(name);
  if (!handler) {
    if (!env.isTest) console.warn(`[jobs] No handler for ${name}`);
    return;
  }
  await handler(payload);
}

class InProcessJobQueue implements JobQueue {
  private timers: NodeJS.Timeout[] = [];

  async enqueue(name: string, payload?: unknown, delayMs = 0) {
    const timer = setTimeout(() => {
      void runHandler(name, payload).catch((error) => console.error(`[jobs] ${name} failed`, error));
    }, delayMs);
    timer.unref?.();
  }

  async schedule(name: string, everyMs: number) {
    const timer = setInterval(() => {
      void runHandler(name, {}).catch((error) => console.error(`[jobs] ${name} failed`, error));
    }, everyMs);
    timer.unref?.();
    this.timers.push(timer);
    void runHandler(name, {}).catch((error) => console.error(`[jobs] ${name} failed`, error));
  }

  async close() {
    for (const timer of this.timers) clearInterval(timer);
  }
}

class BullJobQueue implements JobQueue {
  constructor(
    private queue: Queue,
    private worker: Worker,
    private connection: IORedis,
  ) {}

  async enqueue(name: string, payload?: unknown, delayMs = 0) {
    await this.queue.add(name, payload ?? {}, { delay: delayMs, removeOnComplete: 100, removeOnFail: 100 });
  }

  async schedule(name: string, everyMs: number) {
    await this.queue.add(name, {}, { repeat: { every: everyMs }, removeOnComplete: 20, removeOnFail: 20 });
  }

  async close() {
    await this.worker.close();
    await this.queue.close();
    await this.connection.quit();
  }
}

let active: JobQueue | null = null;

export async function startJobQueue() {
  if (env.isTest) {
    active = new InProcessJobQueue();
    return active;
  }

  if (env.JOBS_DRIVER === "bullmq") {
    try {
      const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, connectTimeout: 2000, lazyConnect: true });
      await connection.connect();
      await connection.ping();
      const queue = new Queue("flowboard", { connection });
      const worker = new Worker(
        "flowboard",
        async (job) => {
          await runHandler(job.name, job.data);
        },
        { connection },
      );
      active = new BullJobQueue(queue, worker, connection);
      console.info("[jobs] BullMQ worker connected");
      return active;
    } catch (error) {
      console.warn("[jobs] Redis is unavailable. Using the in-process queue.", error);
    }
  }

  active = new InProcessJobQueue();
  console.info("[jobs] In-process queue started");
  return active;
}

export async function enqueue(name: string, payload?: unknown, delayMs = 0) {
  if (!active) {
    void runHandler(name, payload).catch((error) => console.error(error));
    return;
  }
  await active.enqueue(name, payload, delayMs);
}

export async function scheduleJob(name: string, everyMs: number) {
  if (!active || env.isTest) return;
  await active.schedule(name, everyMs);
}

export async function stopJobQueue() {
  await active?.close();
  active = null;
}
