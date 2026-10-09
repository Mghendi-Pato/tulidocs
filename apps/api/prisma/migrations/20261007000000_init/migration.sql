-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SYSTEM_ADMIN', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTE', 'INVOICE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK', 'CASH', 'CARD', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckoutPurpose" AS ENUM ('DOCUMENT_UNLOCK', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "CheckoutProvider" AS ENUM ('MPESA', 'CARD');

-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "kraPin" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "mpesaPaybill" TEXT,
    "mpesaAccount" TEXT,
    "mpesaTill" TEXT,
    "bankDetails" TEXT,
    "defaultTemplate" TEXT NOT NULL DEFAULT 'classic',
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "defaultTerms" TEXT,
    "defaultNotes" TEXT,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 14,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "quotePrefix" TEXT NOT NULL DEFAULT 'QUO',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'RCT',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "billingCycle" "BillingCycle",
    "planExpiresAt" TIMESTAMP(3),
    "etimsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "etimsBranchId" TEXT DEFAULT '00',
    "etimsDeviceSerial" TEXT,
    "etimsCmcKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "organizationId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("organizationId","type")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "kraPin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "guestToken" TEXT,
    "type" "DocumentType" NOT NULL DEFAULT 'INVOICE',
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "number" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'classic',
    "accent" TEXT NOT NULL DEFAULT '#2451d6',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT,
    "fromPhone" TEXT,
    "fromAddress" TEXT,
    "fromKraPin" TEXT,
    "fromLogo" TEXT,
    "clientId" UUID,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "clientKraPin" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "paymentInfo" TEXT,
    "paymentMethod" "PaymentMethod",
    "paymentRef" TEXT,
    "sourceId" UUID,
    "unlockedAt" TIMESTAMP(3),
    "unlockedHash" TEXT,
    "etimsInvoiceNo" TEXT,
    "etimsReceiptNo" TEXT,
    "etimsSignature" TEXT,
    "etimsQrUrl" TEXT,
    "etimsSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentItem" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkout" (
    "id" UUID NOT NULL,
    "purpose" "CheckoutPurpose" NOT NULL,
    "provider" "CheckoutProvider" NOT NULL,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "organizationId" UUID,
    "documentId" UUID,
    "guestToken" TEXT,
    "plan" "Plan",
    "billingCycle" "BillingCycle",
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
    "phone" TEXT,
    "email" TEXT,
    "providerRef" TEXT,
    "receipt" TEXT,
    "failureReason" TEXT,
    "raw" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_name_idx" ON "Client"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Document_organizationId_type_issueDate_idx" ON "Document"("organizationId", "type", "issueDate");

-- CreateIndex
CREATE INDEX "Document_organizationId_status_idx" ON "Document"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Document_guestToken_idx" ON "Document"("guestToken");

-- CreateIndex
CREATE UNIQUE INDEX "Document_organizationId_type_number_key" ON "Document"("organizationId", "type", "number");

-- CreateIndex
CREATE INDEX "DocumentItem_documentId_position_idx" ON "DocumentItem"("documentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Checkout_providerRef_key" ON "Checkout"("providerRef");

-- CreateIndex
CREATE INDEX "Checkout_organizationId_createdAt_idx" ON "Checkout"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Checkout_status_createdAt_idx" ON "Checkout"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentItem" ADD CONSTRAINT "DocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
