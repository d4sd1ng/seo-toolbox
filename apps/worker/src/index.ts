import { config } from "dotenv";
import { resolve } from "node:path";
import { closeBrowser } from "module-crawler";
import { createJobsWorker, processQueuedJob } from "queue";

config({ path: resolve(process.cwd(), "../../.env") });
config();

const worker = createJobsWorker(async (job) => {
  console.log("job start", job.data.type, job.data.prismaJobId);
  await processQueuedJob(job.data);
  console.log("job done", job.data.prismaJobId);
});

worker.on("failed", (job, error) => {
  console.error("job failed", job?.data.prismaJobId, error.message);
});

console.log("SEO worker listening on queue seo-jobs");

process.on("SIGINT", async () => {
  await worker.close();
  await closeBrowser();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await worker.close();
  await closeBrowser();
  process.exit(0);
});
