"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export interface HRDashboardData {
  headcount: {
    totalActive: number;
    joinedThisMonth: number;
    resignedThisMonth: number;
  };
  payroll: {
    generated: boolean;
    status: string;
    totalBasic: number;
    totalOTAmount: number;
    totalBonus: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    totalTiffinAllowance: number;
    totalNightAllowance: number;
    totalHolidayAllowance: number;
  };
  attendance: {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    totalOTHours: number;
    averageRate: number;
  };
  loans: {
    activeLoansCount: number;
    totalOutstanding: number;
  };
  adjustments: {
    finesTotal: number;
    bonusesTotal: number;
  };
  departmentCosts: Array<{ name: string; value: number }>;
}

export async function getHRDashboardData(month: number, year: number): Promise<{ success: boolean; data?: HRDashboardData; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasViewPerm = await hasPermission(session.user.id, "hr.payroll", "view");
    if (!hasViewPerm) {
      return { success: false, error: "You do not have permission to view HR dashboard data" };
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Headcount Stats
    const totalActive = await prisma.employee.count({
      where: { status: "active" }
    });

    const joinedThisMonth = await prisma.employee.count({
      where: {
        status: "active",
        joiningDate: { gte: startDate, lte: endDate }
      }
    });

    const resignedThisMonth = await prisma.resignation.count({
      where: {
        status: "APPROVED",
        effectiveDate: { gte: startDate, lte: endDate }
      }
    });

    // 2. Payroll Stats
    const payroll = await prisma.payroll.findFirst({
      where: { month, year, isTrash: false },
      include: {
        items: {
          include: {
            employee: {
              include: {
                departmentRelation: true
              }
            }
          }
        }
      }
    });

    let payrollSummary = {
      generated: false,
      status: "N/A",
      totalBasic: 0,
      totalOTAmount: 0,
      totalBonus: 0,
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
      totalTiffinAllowance: 0,
      totalNightAllowance: 0,
      totalHolidayAllowance: 0,
    };

    const deptCostMap = new Map<string, number>();

    if (payroll) {
      payrollSummary.generated = true;
      payrollSummary.status = payroll.status;
      
      payroll.items.forEach((item) => {
        payrollSummary.totalBasic += Number(item.basic) || 0;
        payrollSummary.totalOTAmount += Number(item.otAmount) || 0;
        payrollSummary.totalBonus += (Number(item.bonus) || 0) + (Number(item.customBonus) || 0);
        payrollSummary.totalGrossPay += Number(item.grossPay) || 0;
        payrollSummary.totalDeductions += Number(item.totalDeduction) || 0;
        payrollSummary.totalNetPay += Number(item.netPay) || 0;
        payrollSummary.totalTiffinAllowance += Number(item.tiffinAllowance) || 0;
        payrollSummary.totalNightAllowance += Number(item.nightAllowance) || 0;
        payrollSummary.totalHolidayAllowance += Number(item.holidayAllowance) || 0;

        const deptName = item.employee?.departmentRelation?.name || item.employee?.department || "General";
        const currentSum = deptCostMap.get(deptName) || 0;
        deptCostMap.set(deptName, currentSum + (Number(item.netPay) || 0));
      });
    } else {
      // If payroll is not generated, fallback to standard salaries for active employees to build the donut chart
      const activeEmployees = await prisma.employee.findMany({
        where: { status: "active" },
        include: { departmentRelation: true }
      });
      activeEmployees.forEach((emp) => {
        const deptName = emp.departmentRelation?.name || emp.department || "General";
        const currentSum = deptCostMap.get(deptName) || 0;
        deptCostMap.set(deptName, currentSum + (Number(emp.salary) || 0));
      });
    }

    const departmentCosts = Array.from(deptCostMap.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value)
    })).sort((a, b) => b.value - a.value);

    // 3. Attendance Stats
    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let totalOTHours = 0;

    attendances.forEach((att) => {
      if (att.status === "ABSENT") {
        absentCount += 1;
      } else if (att.status === "LEAVE") {
        leaveCount += 1;
      } else if (["PRESENT", "LATE", "HALF_DAY"].includes(att.status)) {
        presentCount += 1;
      }
      totalOTHours += Number(att.otHours) || 0;
    });

    const activeWorkDaysCount = presentCount + absentCount;
    const averageRate = activeWorkDaysCount > 0 ? (presentCount / activeWorkDaysCount) * 100 : 100;

    // 4. Loans & Advances
    const loansAggregate = await prisma.employeeLoan.aggregate({
      _sum: { remainingBalance: true },
      _count: { id: true },
      where: { status: "APPROVED", remainingBalance: { gt: 0 } }
    });

    const loans = {
      activeLoansCount: loansAggregate._count.id || 0,
      totalOutstanding: Number(loansAggregate._sum.remainingBalance) || 0
    };

    // 5. Fines & Bonuses
    const finesSum = await prisma.employeeFine.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED", fineDate: { gte: startDate, lte: endDate } }
    });

    const bonusesSum = await prisma.employeeBonus.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED", bonusDate: { gte: startDate, lte: endDate } }
    });

    const adjustments = {
      finesTotal: Number(finesSum._sum.amount) || 0,
      bonusesTotal: Number(bonusesSum._sum.amount) || 0
    };

    return {
      success: true,
      data: {
        headcount: { totalActive, joinedThisMonth, resignedThisMonth },
        payroll: payrollSummary,
        attendance: { presentCount, absentCount, leaveCount, totalOTHours, averageRate },
        loans,
        adjustments,
        departmentCosts
      }
    };
  } catch (error: any) {
    console.error("getHRDashboardData error:", error);
    return { success: false, error: error.message || "Failed to fetch HR dashboard data" };
  }
}
