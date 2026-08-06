import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const warehouses = await prisma.warehouse.findMany({
    where: { status: "active", isTrash: false }
  });

  const items = await prisma.item.findMany({
    where: { status: "active", isTrash: false },
    include: { variants: true }
  });

  console.log(`Found ${warehouses.length} warehouses and ${items.length} items. Seeding stock...`);

  let count = 0;
  for (const warehouse of warehouses) {
    for (const item of items) {
      if (item.variants && item.variants.length > 0) {
        // If it has variants, seed stock for each variant
        for (const variant of item.variants) {
          const qty = Math.floor(Math.random() * 500) + 100; // random stock between 100 and 600
          await prisma.stock.upsert({
            where: {
              variantId_warehouseId: {
                variantId: variant.id,
                warehouseId: warehouse.id
              }
            },
            update: {
              quantity: qty
            },
            create: {
              variantId: variant.id,
              warehouseId: warehouse.id,
              quantity: qty
            }
          });
          count++;
        }
      } else {
        // Otherwise seed for base item
        const qty = Math.floor(Math.random() * 800) + 200; // random stock between 200 and 1000
        await prisma.stock.upsert({
          where: {
            itemId_warehouseId: {
              itemId: item.id,
              warehouseId: warehouse.id
            }
          },
          update: {
            quantity: qty
          },
          create: {
            itemId: item.id,
            warehouseId: warehouse.id,
            quantity: qty
          }
        });
        count++;
      }
    }
  }

  console.log(`Stock seeding completed! Created/updated ${count} stock records.`);
}

main()
  .catch(e => {
    console.error("Error seeding stock:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
