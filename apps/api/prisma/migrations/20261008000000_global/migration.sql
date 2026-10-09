-- Global: generic tax ID instead of KRA PIN, country + tax wording per business, USD default

-- Organization
ALTER TABLE "Organization" RENAME COLUMN "kraPin" TO "taxId";
ALTER TABLE "Organization" ADD COLUMN "country" VARCHAR(2);
ALTER TABLE "Organization" ADD COLUMN "taxName" TEXT NOT NULL DEFAULT 'Tax';
ALTER TABLE "Organization" ADD COLUMN "taxIdLabel" TEXT NOT NULL DEFAULT 'Tax ID';
ALTER TABLE "Organization" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "Organization" ALTER COLUMN "defaultTaxRate" SET DEFAULT 0;

-- Client
ALTER TABLE "Client" RENAME COLUMN "kraPin" TO "taxId";

-- Document
ALTER TABLE "Document" RENAME COLUMN "fromKraPin" TO "fromTaxId";
ALTER TABLE "Document" RENAME COLUMN "clientKraPin" TO "clientTaxId";
ALTER TABLE "Document" ADD COLUMN "taxName" TEXT NOT NULL DEFAULT 'Tax';
ALTER TABLE "Document" ADD COLUMN "taxIdLabel" TEXT NOT NULL DEFAULT 'Tax ID';
ALTER TABLE "Document" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Checkout
ALTER TABLE "Checkout" ADD COLUMN "country" VARCHAR(2);
ALTER TABLE "Checkout" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Existing Kenyan businesses keep their Kenyan wording
UPDATE "Organization" SET "country" = 'KE', "taxName" = 'VAT', "taxIdLabel" = 'KRA PIN' WHERE "currency" = 'KES';
UPDATE "Document" SET "taxName" = 'VAT', "taxIdLabel" = 'KRA PIN' WHERE "currency" = 'KES';
