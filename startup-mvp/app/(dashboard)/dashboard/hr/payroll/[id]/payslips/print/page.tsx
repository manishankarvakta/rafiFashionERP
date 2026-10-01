import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PageGuard from "@/components/permissions/page-guard";
import PrintAllClient from "./_components/print-all-client";
import { serializeDecimalAndDate } from "@/lib/utils/serialization";

interface PrintAllPageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintAllPage({ params }: PrintAllPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return <div>Unauthorized</div>;
  }

  const canView = await hasPermission(session.user.id, "hr.payroll", "view");
  if (!canView) {
    return <div>Permission Denied</div>;
  }

  // Fetch default active SalaryStructurePolicy
  const defaultPolicy = await prisma.salaryStructurePolicy.findFirst({
    where: { isDefault: true, status: "active", isTrash: false }
  });

  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: {
            include: {
              employeeType: {
                include: {
                  salaryStructurePolicy: true
                }
              },
              deviceMappings: {
                where: { isActive: true },
                select: { deviceUserId: true }
              }
            }
          }
        },
        orderBy: { employee: { name: "asc" } }
      }
    }
  });

  if (!payroll) {
    return notFound();
  }

  const { calculateSalaryBreakdown } = await import("@/lib/hr-payroll/policy-calculation");

  // Fetch monthly attendance records for all employees in this payroll run
  const startDate = new Date(payroll.year, payroll.month - 1, 1);
  const endDate = new Date(payroll.year, payroll.month, 0);
  const employeeIds = payroll.items.map(item => item.employeeId);

  const attendances = await prisma.attendance.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      employeeId: true,
      status: true,
      otHours: true
    }
  });

  const resolvedItems = payroll.items.map(item => {
    const basic = Number(item.basic);
    const houseRent = Number(item.houseRent);
    const medical = Number(item.medical);
    const transport = Number(item.transport);
    const foodAllowance = Number(item.foodAllowance);

    const isFlat = houseRent === 0 && medical === 0 && transport === 0 && foodAllowance === 0;

    let resBasic = basic;
    let resHouseRent = houseRent;
    let resMedical = medical;
    let resTransport = transport;
    let resFoodAllowance = foodAllowance;

    if (isFlat) {
      const gross = basic; // since others are 0, item.basic represents the gross base salary
      const resolvedPolicy = item.employee?.employeeType?.salaryStructurePolicy || defaultPolicy || null;

      const breakdown = calculateSalaryBreakdown({
        grossSalary: gross,
        salaryStructurePolicy: resolvedPolicy
      });

      resBasic = breakdown.basicSalary;
      resHouseRent = breakdown.houseRent;
      resMedical = breakdown.medical;
      resTransport = breakdown.transport;
      resFoodAllowance = breakdown.food;
    }

    const empAttendances = attendances.filter(a => a.employeeId === item.employeeId);
    const totalOtHours = empAttendances.reduce((acc, curr) => acc + Number(curr.otHours || 0), 0);
    const totalWorkingDays = empAttendances.filter(
      a => a.status === "PRESENT" || a.status === "LATE" || a.status === "HALF_DAY"
    ).length;
    const totalAbsentDays = empAttendances.filter(a => a.status === "ABSENT").length;
    const halfDays = empAttendances.filter(a => a.status === "HALF_DAY").length;

    return {
      ...item,
      basic: resBasic,
      houseRent: resHouseRent,
      medical: resMedical,
      transport: resTransport,
      foodAllowance: resFoodAllowance,
      otAmount: Number(item.otAmount),
      bonus: Number(item.bonus),
      grossPay: Number(item.grossPay),
      absentDeduction: Number(item.absentDeduction),
      loanDeduction: Number(item.loanDeduction),
      taxDeduction: Number(item.taxDeduction),
      pfDeduction: Number(item.pfDeduction),
      totalDeduction: Number(item.totalDeduction),
      netPay: Number(item.netPay),
      tiffinAllowance: Number(item.tiffinAllowance),
      nightAllowance: Number(item.nightAllowance),
      holidayAllowance: Number(item.holidayAllowance),
      otherAllowance: Number(item.otherAllowance),
      lateDeduction: Number(item.lateDeduction),
      otherDeduction: Number(item.otherDeduction),
      totalOtHours,
      totalWorkingDays,
      totalAbsentDays,
      halfDays,
    };
  });

  // Natural numeric sort by Biometric ID (ascending: small to large)
  resolvedItems.sort((a, b) => {
    const idA = a.employee?.biometricDeviceId || a.employee?.deviceMappings?.[0]?.deviceUserId || a.employee?.employeeCode || "";
    const idB = b.employee?.biometricDeviceId || b.employee?.deviceMappings?.[0]?.deviceUserId || b.employee?.employeeCode || "";
    if (!idA && !idB) return (a.employee?.name || "").localeCompare(b.employee?.name || "");
    if (!idA) return 1;
    if (!idB) return -1;
    const comp = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: "base" });
    if (comp !== 0) return comp;
    return (a.employee?.name || "").localeCompare(b.employee?.name || "");
  });

  const orgInfo = await prisma.organization.findFirst({
    where: { status: "active" }
  });

  const serializedPayroll = {
    ...serializeDecimalAndDate(payroll),
    items: serializeDecimalAndDate(resolvedItems)
  };

  return (
    <PageGuard permissionKey="hr.payroll" requiredOperation="view">
      <PrintAllClient 
        payroll={serializedPayroll}
        orgInfo={serializeDecimalAndDate(orgInfo)}
      />
    </PageGuard>
  );
}
