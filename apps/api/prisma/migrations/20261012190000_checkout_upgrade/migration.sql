-- Upgrades (monthly → yearly, or a higher plan) credit unused paid time against the new plan
ALTER TABLE "Checkout" ADD COLUMN "isUpgrade" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "credit" DECIMAL(18,2);
