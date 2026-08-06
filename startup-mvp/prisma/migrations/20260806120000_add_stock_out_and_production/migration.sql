-- CreateEnum
CREATE TYPE "StockOutStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "VoucherType" ADD VALUE 'STOCK_OUT';

-- CreateTable
CREATE TABLE "StockOut" (
    "id" TEXT NOT NULL,
    "stockOutNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StockOutStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "voucherId" TEXT,
    "isTrash" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockOutItem" (
    "id" TEXT NOT NULL,
    "stockOutId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isTrash" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_daily_outputs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "target_production" INTEGER NOT NULL DEFAULT 0,
    "pieces_produced" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "is_trash" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_daily_outputs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "productionLineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockOut_stockOutNo_key" ON "StockOut"("stockOutNo");
CREATE UNIQUE INDEX "StockOut_voucherId_key" ON "StockOut"("voucherId");
CREATE INDEX "StockOut_warehouseId_idx" ON "StockOut"("warehouseId");
CREATE INDEX "StockOut_createdById_idx" ON "StockOut"("createdById");
CREATE INDEX "StockOut_voucherId_idx" ON "StockOut"("voucherId");
CREATE INDEX "StockOut_isTrash_idx" ON "StockOut"("isTrash");

-- CreateIndex
CREATE INDEX "StockOutItem_stockOutId_idx" ON "StockOutItem"("stockOutId");
CREATE INDEX "StockOutItem_itemId_idx" ON "StockOutItem"("itemId");
CREATE INDEX "StockOutItem_variantId_idx" ON "StockOutItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionLine_name_key" ON "ProductionLine"("name");
CREATE UNIQUE INDEX "ProductionLine_code_key" ON "ProductionLine"("code");

-- CreateIndex
CREATE INDEX "employee_daily_outputs_employee_id_idx" ON "employee_daily_outputs"("employee_id");
CREATE INDEX "employee_daily_outputs_date_idx" ON "employee_daily_outputs"("date");
CREATE UNIQUE INDEX "employee_daily_outputs_employee_id_date_key" ON "employee_daily_outputs"("employee_id", "date");

-- CreateIndex
CREATE INDEX "Employee_productionLineId_idx" ON "Employee"("productionLineId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_productionLineId_fkey" FOREIGN KEY ("productionLineId") REFERENCES "ProductionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOut" ADD CONSTRAINT "StockOut_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockOut" ADD CONSTRAINT "StockOut_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockOut" ADD CONSTRAINT "StockOut_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockOutItem" ADD CONSTRAINT "StockOutItem_stockOutId_fkey" FOREIGN KEY ("stockOutId") REFERENCES "StockOut"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockOutItem" ADD CONSTRAINT "StockOutItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockOutItem" ADD CONSTRAINT "StockOutItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_daily_outputs" ADD CONSTRAINT "employee_daily_outputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_daily_outputs" ADD CONSTRAINT "employee_daily_outputs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
