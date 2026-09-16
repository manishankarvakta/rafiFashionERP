import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Applying WorkOrder schema additions...");

  const queries = [
    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkOrderStatus') THEN
        CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'MATERIAL_RECEIVED', 'IN_PRODUCTION', 'COMPLETED', 'DELIVERED', 'CANCELLED');
      END IF;
    END $$;`,

    `DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaterialInwardSource') THEN
        CREATE TYPE "MaterialInwardSource" AS ENUM ('PURCHASE', 'CLIENT_SUPPLIED');
      END IF;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "WorkOrder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "orderNo" TEXT NOT NULL UNIQUE,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id"),
      "itemId" TEXT NOT NULL REFERENCES "Item"("id"),
      "targetQuantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL(12,2) NOT NULL,
      "totalAmount" DECIMAL(12,2) NOT NULL,
      "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deliveryDeadline" TIMESTAMP(3),
      "notes" TEXT,
      "isTrash" BOOLEAN NOT NULL DEFAULT false,
      "producedQuantity" INTEGER NOT NULL DEFAULT 0,
      "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
      "productionStatus" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
      "productionNotes" TEXT,
      "saleInvoiceId" TEXT UNIQUE REFERENCES "Sale"("id"),
      "createdBy" TEXT NOT NULL REFERENCES "User"("id"),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "WorkOrder_clientId_idx" ON "WorkOrder"("clientId");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_itemId_idx" ON "WorkOrder"("itemId");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_productionStatus_idx" ON "WorkOrder"("productionStatus");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_isTrash_idx" ON "WorkOrder"("isTrash");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrder_createdBy_idx" ON "WorkOrder"("createdBy");`,

    `CREATE TABLE IF NOT EXISTS "WorkOrderMaterialIn" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "inwardNo" TEXT NOT NULL UNIQUE,
      "workOrderId" TEXT REFERENCES "WorkOrder"("id") ON DELETE CASCADE,
      "clientId" TEXT,
      "source" "MaterialInwardSource" NOT NULL DEFAULT 'CLIENT_SUPPLIED',
      "itemId" TEXT NOT NULL REFERENCES "Item"("id"),
      "fabricRollNo" TEXT,
      "quantity" DECIMAL(12,2) NOT NULL,
      "unit" TEXT NOT NULL,
      "notes" TEXT,
      "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIn_workOrderId_idx" ON "WorkOrderMaterialIn"("workOrderId");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIn_clientId_idx" ON "WorkOrderMaterialIn"("clientId");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialIn_itemId_idx" ON "WorkOrderMaterialIn"("itemId");`,

    `CREATE TABLE IF NOT EXISTS "WorkOrderMaterialOut" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "outwardNo" TEXT NOT NULL UNIQUE,
      "workOrderId" TEXT NOT NULL REFERENCES "WorkOrder"("id") ON DELETE CASCADE,
      "itemId" TEXT NOT NULL REFERENCES "Item"("id"),
      "quantity" DECIMAL(12,2) NOT NULL,
      "unit" TEXT NOT NULL,
      "issuedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialOut_workOrderId_idx" ON "WorkOrderMaterialOut"("workOrderId");`,
    `CREATE INDEX IF NOT EXISTS "WorkOrderMaterialOut_itemId_idx" ON "WorkOrderMaterialOut"("itemId");`,

    `CREATE TABLE IF NOT EXISTS "WorkOrderDelivery" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "challanNo" TEXT NOT NULL UNIQUE,
      "workOrderId" TEXT NOT NULL REFERENCES "WorkOrder"("id") ON DELETE CASCADE,
      "deliveredQty" INTEGER NOT NULL,
      "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "driverName" TEXT,
      "vehicleNo" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "WorkOrderDelivery_workOrderId_idx" ON "WorkOrderDelivery"("workOrderId");`,

    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'StockOut' AND column_name = 'workOrderId'
      ) THEN
        ALTER TABLE "StockOut" ADD COLUMN "workOrderId" TEXT REFERENCES "WorkOrder"("id");
      END IF;
    END $$;`,

    `CREATE INDEX IF NOT EXISTS "StockOut_workOrderId_idx" ON "StockOut"("workOrderId");`
  ];

  for (const q of queries) {
    await prisma.$executeRawUnsafe(q);
  }

  console.log("✅ WorkOrder tables and columns successfully created/verified in database!");
}

run()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
