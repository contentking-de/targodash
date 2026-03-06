-- AlterTable
ALTER TABLE "EditorialPlanEntry" ADD COLUMN "ratgeberCategory" TEXT;
ALTER TABLE "EditorialPlanEntry" ADD COLUMN "funnel" TEXT;

-- CreateIndex
CREATE INDEX "EditorialPlanEntry_ratgeberCategory_idx" ON "EditorialPlanEntry"("ratgeberCategory");
CREATE INDEX "EditorialPlanEntry_funnel_idx" ON "EditorialPlanEntry"("funnel");
