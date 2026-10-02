ALTER TABLE "Workspace"
    ADD COLUMN "stripeCustomerId" TEXT,
    ADD COLUMN "stripeSubscriptionId" TEXT,
    ADD COLUMN "stripePriceId" TEXT;

CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");
