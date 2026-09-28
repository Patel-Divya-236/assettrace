-- AlterTable
ALTER TABLE "MaintenanceTicket" ADD COLUMN     "approvalReason" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "contractorId" UUID,
ADD COLUMN     "estimatedCost" DECIMAL(14,2),
ADD COLUMN     "inspectedAt" TIMESTAMP(3),
ADD COLUMN     "inspectedById" UUID,
ADD COLUMN     "inspectionNote" TEXT,
ADD COLUMN     "needsApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Contractor" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "firm" TEXT,
    "phone" TEXT NOT NULL,
    "workType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketUpdate" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "progress" INTEGER,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" UUID NOT NULL,
    "ward" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "TicketUpdate_ticketId_createdAt_idx" ON "TicketUpdate"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_ward_year_key" ON "Budget"("ward", "year");

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketUpdate" ADD CONSTRAINT "TicketUpdate_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

