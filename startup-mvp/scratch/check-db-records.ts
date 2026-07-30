import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    where: { status: "active", isTrash: false },
    select: { id: true, name: true, code: true }
  });

  const items = await prisma.item.findMany({
    where: { status: "active", isTrash: false },
    select: { id: true, name: true, code: true, costPrice: true, itemType: true },
    take: 10
  });

  console.log("WAREHOUSES:");
  console.log(JSON.stringify(warehouses, null, 2));
  console.log("\nITEMS:");
  console.log(JSON.stringify(items, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
