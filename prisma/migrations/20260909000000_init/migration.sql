-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SpaceRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CASH', 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT', 'CREDIT', 'PIX', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionVisibility" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RecurrenceKind" AS ENUM ('FIXED', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "FundMovementKind" AS ENUM ('MANUAL', 'AUTO_CLOSING');

-- CreateEnum
CREATE TYPE "IncomeKind" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('INSS', 'IRRF');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "CommentSubjectType" AS ENUM ('TRANSACTION');

-- CreateEnum
CREATE TYPE "ReactionSubjectType" AS ENUM ('TRANSACTION');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'COMMENT_CREATED', 'FUND_CONTRIBUTION', 'FUND_WITHDRAWAL', 'MONTH_CLOSED', 'MEMBER_JOINED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Nosso espaço',
    "sinceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_members" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL DEFAULT 'CHECKING',
    "openingBalanceCents" BIGINT NOT NULL DEFAULT 0,
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL DEFAULT 'EXPENSE',
    "essential" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT,
    "color" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "visibility" "TransactionVisibility" NOT NULL DEFAULT 'SHARED',
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdById" TEXT NOT NULL,
    "ownerId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'DEBIT',
    "needsDetail" BOOLEAN NOT NULL DEFAULT false,
    "recurringAccountId" TEXT,
    "installmentPlanId" TEXT,
    "installmentNumber" INTEGER,
    "attachmentId" TEXT,
    "transferPairId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalCents" BIGINT NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CREDIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_accounts" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "RecurrenceKind" NOT NULL DEFAULT 'FIXED',
    "amountCents" BIGINT NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "accountId" TEXT,
    "categoryId" TEXT,
    "installmentsCount" INTEGER,
    "installmentsPaid" INTEGER DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_funds" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "targetCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_fund_movements" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "kind" "FundMovementKind" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthClosingId" TEXT,

    CONSTRAINT "emergency_fund_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_closings" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "netIncomeCents" BIGINT NOT NULL,
    "spentCents" BIGINT NOT NULL,
    "leftoverCents" BIGINT NOT NULL,
    "contributionCents" BIGINT NOT NULL,
    "byCategory" JSONB NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "IncomeKind" NOT NULL DEFAULT 'FIXED',
    "grossCents" BIGINT NOT NULL DEFAULT 0,
    "computedBaseCents" BIGINT,
    "applyInss" BOOLEAN NOT NULL DEFAULT true,
    "applyIrrf" BOOLEAN NOT NULL DEFAULT true,
    "dependents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_tables" (
    "id" TEXT NOT NULL,
    "type" "TaxType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "brackets" JSONB NOT NULL,
    "perDependentDeductionCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'RECEIPT',
    "storageKey" TEXT NOT NULL,
    "thumbKey" TEXT,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "subjectType" "CommentSubjectType" NOT NULL DEFAULT 'TRANSACTION',
    "subjectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "subjectType" "ReactionSubjectType" NOT NULL DEFAULT 'TRANSACTION',
    "subjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "actorId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "space_members_userId_idx" ON "space_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "space_members_spaceId_userId_key" ON "space_members"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_spaceId_idx" ON "invitations"("spaceId");

-- CreateIndex
CREATE INDEX "accounts_spaceId_idx" ON "accounts"("spaceId");

-- CreateIndex
CREATE INDEX "categories_spaceId_idx" ON "categories"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_attachmentId_key" ON "transactions"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transferPairId_key" ON "transactions"("transferPairId");

-- CreateIndex
CREATE INDEX "transactions_spaceId_occurredAt_idx" ON "transactions"("spaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_categoryId_idx" ON "transactions"("categoryId");

-- CreateIndex
CREATE INDEX "transactions_installmentPlanId_idx" ON "transactions"("installmentPlanId");

-- CreateIndex
CREATE INDEX "installment_plans_spaceId_idx" ON "installment_plans"("spaceId");

-- CreateIndex
CREATE INDEX "recurring_accounts_spaceId_idx" ON "recurring_accounts"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_funds_spaceId_key" ON "emergency_funds"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_fund_movements_monthClosingId_key" ON "emergency_fund_movements"("monthClosingId");

-- CreateIndex
CREATE INDEX "emergency_fund_movements_fundId_idx" ON "emergency_fund_movements"("fundId");

-- CreateIndex
CREATE UNIQUE INDEX "month_closings_spaceId_month_key" ON "month_closings"("spaceId", "month");

-- CreateIndex
CREATE INDEX "income_sources_userId_idx" ON "income_sources"("userId");

-- CreateIndex
CREATE INDEX "tax_tables_type_effectiveFrom_idx" ON "tax_tables"("type", "effectiveFrom");

-- CreateIndex
CREATE INDEX "attachments_spaceId_idx" ON "attachments"("spaceId");

-- CreateIndex
CREATE INDEX "comments_subjectType_subjectId_idx" ON "comments"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "comments_spaceId_idx" ON "comments"("spaceId");

-- CreateIndex
CREATE INDEX "reactions_subjectType_subjectId_idx" ON "reactions"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_subjectType_subjectId_userId_emoji_key" ON "reactions"("subjectType", "subjectId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "activity_events_spaceId_createdAt_idx" ON "activity_events"("spaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringAccountId_fkey" FOREIGN KEY ("recurringAccountId") REFERENCES "recurring_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installmentPlanId_fkey" FOREIGN KEY ("installmentPlanId") REFERENCES "installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transferPairId_fkey" FOREIGN KEY ("transferPairId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_accounts" ADD CONSTRAINT "recurring_accounts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_accounts" ADD CONSTRAINT "recurring_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_accounts" ADD CONSTRAINT "recurring_accounts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_funds" ADD CONSTRAINT "emergency_funds_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_movements" ADD CONSTRAINT "emergency_fund_movements_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "emergency_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_movements" ADD CONSTRAINT "emergency_fund_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_movements" ADD CONSTRAINT "emergency_fund_movements_monthClosingId_fkey" FOREIGN KEY ("monthClosingId") REFERENCES "month_closings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closings" ADD CONSTRAINT "month_closings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closings" ADD CONSTRAINT "month_closings_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_transaction_fkey" FOREIGN KEY ("subjectId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_transaction_fkey" FOREIGN KEY ("subjectId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

