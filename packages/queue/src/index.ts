import { Queue, Worker, type Job as BullJob, type Processor } from "bullmq";
import { assertJobLimits, incrementQuota, prisma, type JobType } from "db";
import IORedis from "ioredis";

export const QUEUE_NAME = "seo-jobs";

export type QueueJobPayload = {
  prismaJobId: string;
  type: JobType;
  projectId: string;
  workspaceId: string;
  moduleId: string;
  payload: Record<string, unknown>;
};

let queue: Queue<QueueJobPayload> | null = null;

export function redisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
}

export function jobsQueue() {
  if (!queue) {
    queue = new Queue<QueueJobPayload>(QUEUE_NAME, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 4000 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    });
  }
  return queue;
}

export async function enqueueJob(input: {
  workspaceId: string;
  projectId: string;
  type: JobType;
  moduleId: string;
  payload: Record<string, unknown>;
}) {
  await assertJobLimits(input.workspaceId, input.type);

  const row = await prisma.job.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      type: input.type,
      moduleId: input.moduleId,
      status: "queued",
      payload: input.payload,
    },
  });

  await incrementQuota(input.workspaceId, input.type);

  await jobsQueue().add(
    input.type,
    {
      prismaJobId: row.id,
      type: input.type,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      moduleId: input.moduleId,
      payload: input.payload,
    },
    { jobId: row.id },
  );

  return row;
}

export function createJobsWorker(
  processor: Processor<QueueJobPayload>,
) {
  return new Worker<QueueJobPayload>(QUEUE_NAME, processor, {
    connection: redisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  });
}

export { processQueuedJob } from "./process";
export type { BullJob };
