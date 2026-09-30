CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitBucket_ipHash_tool_periodStart_key"
    ON "RateLimitBucket"("ipHash", "tool", "periodStart");

CREATE INDEX "RateLimitBucket_periodStart_idx"
    ON "RateLimitBucket"("periodStart");
