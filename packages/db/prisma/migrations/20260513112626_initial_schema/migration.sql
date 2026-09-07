-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ADVISER', 'COMPLIANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('PURCHASE', 'REMORTGAGE', 'BTL', 'FURTHER_ADVANCE', 'PRODUCT_TRANSFER');

-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('ENQUIRY', 'FACT_FIND', 'RESEARCH', 'DIP', 'OFFER', 'COMPLETION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportTemplate" AS ENUM ('BTL', 'FTB', 'REMORTGAGE', 'HOME_MOVER', 'PRODUCT_TRANSFER', 'DIVORCE', 'SELF_EMPLOYED', 'VULNERABLE_OVERLAY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'ADVISER_REVIEW', 'APPROVED', 'FINALISED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('CASE_UPDATE', 'COMPLIANCE', 'AI_REPORT', 'CLIENT_REPLY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID', 'INCOME', 'FINANCIAL', 'LENDER', 'COMPLIANCE', 'OTHER');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "stripeCustomerId" TEXT,
    "settings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ADVISER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "niNumber" TEXT,
    "address" JSONB,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'EMPLOYED',
    "annualIncome" DOUBLE PRECISION,
    "isVulnerable" BOOLEAN NOT NULL DEFAULT false,
    "vulnerabilityNotes" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "portalAccessToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "stage" "CaseStage" NOT NULL DEFAULT 'ENQUIRY',
    "propertyValue" DOUBLE PRECISION,
    "loanAmount" DOUBLE PRECISION,
    "ltv" DOUBLE PRECISION,
    "termYears" INTEGER,
    "selectedLender" TEXT,
    "selectedProduct" TEXT,
    "selectedRate" DOUBLE PRECISION,
    "selectedFee" DOUBLE PRECISION,
    "adviserNotes" TEXT,
    "assignedAdviserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_finds" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "personalDetails" JSONB,
    "employmentDetails" JSONB,
    "incomeDetails" JSONB,
    "expenditureDetails" JSONB,
    "propertyDetails" JSONB,
    "existingMortgages" JSONB,
    "clientPreferences" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_finds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_considered" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "rate" DOUBLE PRECISION,
    "fee" DOUBLE PRECISION,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "reasonNotSelected" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_considered_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentUrl" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suitability_reports" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateType" "ReportTemplate" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "sections" JSONB,
    "pdfUrl" TEXT,
    "generatedBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suitability_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "caseId" TEXT,
    "clientId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "sourceType" "MessageSource" NOT NULL DEFAULT 'SYSTEM',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "caseId" TEXT,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OTHER',
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_criteria" (
    "id" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "maxLtv" DOUBLE PRECISION,
    "minIncome" DOUBLE PRECISION,
    "maxLoanAmount" DOUBLE PRECISION,
    "acceptedEmploymentTypes" TEXT[],
    "minCreditScore" INTEGER,
    "specialConditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lender_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_referenceNumber_key" ON "clients"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "clients_portalAccessToken_key" ON "clients"("portalAccessToken");

-- CreateIndex
CREATE UNIQUE INDEX "cases_referenceNumber_key" ON "cases"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "fact_finds_caseId_key" ON "fact_finds"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "lender_criteria_lenderName_key" ON "lender_criteria"("lenderName");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assignedAdviserId_fkey" FOREIGN KEY ("assignedAdviserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_finds" ADD CONSTRAINT "fact_finds_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products_considered" ADD CONSTRAINT "products_considered_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suitability_reports" ADD CONSTRAINT "suitability_reports_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suitability_reports" ADD CONSTRAINT "suitability_reports_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
