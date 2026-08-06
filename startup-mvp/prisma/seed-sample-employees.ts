import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding 5 sample active employees for daily output testing...");

  const employeesData = [
    {
      name: "Kamal Hossein",
      employeeCode: "EMP-KH-101",
      department: "Sewing Line A",
      designation: "Senior Operator",
      status: "active",
    },
    {
      name: "Fatema Khatun",
      employeeCode: "EMP-FK-102",
      department: "Sewing Line B",
      designation: "Junior Operator",
      status: "active",
    },
    {
      name: "Rashed Khan",
      employeeCode: "EMP-RK-103",
      department: "Cutting Room",
      designation: "Cutter Specialist",
      status: "active",
    },
    {
      name: "Mariam Begum",
      employeeCode: "EMP-MB-104",
      department: "Finishing",
      designation: "Ironer & Folder",
      status: "active",
    },
    {
      name: "Anisur Rahman",
      employeeCode: "EMP-AR-105",
      department: "Quality Control",
      designation: "QC Inspector",
      status: "active",
    },
  ];

  for (const emp of employeesData) {
    const existing = await prisma.employee.findFirst({
      where: { employeeCode: emp.employeeCode },
    });

    if (existing) {
      console.log(`Employee ${emp.name} (${emp.employeeCode}) already exists. Skipping.`);
    } else {
      await prisma.employee.create({
        data: emp,
      });
      console.log(`Created Employee: ${emp.name} (${emp.employeeCode})`);
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding sample employees:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
