-- Subscriptions: record the period each payment bought, so billing can show "covers 12 Oct – 12 Nov"
ALTER TABLE "Checkout" ADD COLUMN "periodStart" TIMESTAMP(3), ADD COLUMN "periodEnd" TIMESTAMP(3);

-- Backfill paid subscriptions: replay each business's payments in order (top-ups stack after the running end date)
DO $$
DECLARE
  r RECORD;
  prev_org UUID := NULL;
  prev_plan TEXT := NULL;
  running_end TIMESTAMP(3) := NULL;
  s TIMESTAMP(3);
  e TIMESTAMP(3);
BEGIN
  FOR r IN
    SELECT id, "organizationId" AS org, plan::text AS plan, "billingCycle"::text AS cycle, COALESCE("paidAt", "createdAt") AS at
    FROM "Checkout"
    WHERE status = 'PAID' AND purpose = 'SUBSCRIPTION' AND "organizationId" IS NOT NULL AND plan IS NOT NULL AND "billingCycle" IS NOT NULL
    ORDER BY "organizationId", COALESCE("paidAt", "createdAt")
  LOOP
    IF prev_org IS DISTINCT FROM r.org THEN
      running_end := NULL; prev_plan := NULL;
    END IF;
    IF running_end IS NOT NULL AND running_end > r.at AND prev_plan = r.plan THEN s := running_end; ELSE s := r.at; END IF;
    IF r.cycle = 'YEARLY' THEN e := s + INTERVAL '1 year'; ELSE e := s + INTERVAL '1 month'; END IF;
    UPDATE "Checkout" SET "periodStart" = s, "periodEnd" = e WHERE id = r.id;
    running_end := e; prev_org := r.org; prev_plan := r.plan;
  END LOOP;
END $$;
