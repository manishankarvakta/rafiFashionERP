import { prisma } from "../lib/prisma";

async function compare() {
  const targetDateStr = "2026-08-19";
  const fromDate = new Date(targetDateStr + "T00:00:00.000Z");
  const toDate = new Date(targetDateStr + "T23:59:59.999Z");

  console.log(`Comparing On Duty counts for date: ${targetDateStr}...`);

  // 1. Get from Attendance Page logic
  const attendanceOnDuty = await prisma.attendance.findMany({
    where: {
      date: {
        gte: fromDate,
        lte: toDate,
      },
      checkIn: { not: null },
      checkOut: null,
    },
    select: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          status: true,
        }
      },
      checkIn: true,
    }
  });

  const attendanceOnDutyMap = new Map(attendanceOnDuty.map(a => [a.employee.id, a]));
  console.log(`Total from Attendance Page logic: ${attendanceOnDuty.length}`);

  // 2. Get from Employee Stats logic
  const activeEmployeesWithLogs = await prisma.employee.findMany({
    where: { status: "active" },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      attendanceLogs: {
        orderBy: { timestamp: "desc" },
        take: 2,
        select: { timestamp: true }
      }
    }
  });

  const statsOnDuty: any[] = [];
  const now = new Date();
  for (const emp of activeEmployeesWithLogs) {
    const logs = emp.attendanceLogs;
    if (logs && logs.length > 0) {
      const latestPunch = new Date(logs[0].timestamp);
      const hoursSinceLatest = (now.getTime() - latestPunch.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLatest <= 14) {
        if (logs.length === 1) {
          statsOnDuty.push(emp);
        } else {
          const prevPunch = new Date(logs[1].timestamp);
          const latestDateString = latestPunch.getFullYear() + "-" + latestPunch.getMonth() + "-" + latestPunch.getDate();
          const prevDateString = prevPunch.getFullYear() + "-" + prevPunch.getMonth() + "-" + prevPunch.getDate();
          if (latestDateString !== prevDateString) {
            statsOnDuty.push(emp);
          }
        }
      }
    }
  }

  const statsOnDutyMap = new Map(statsOnDuty.map(s => [s.id, s]));
  console.log(`Total from Employee Stats logic: ${statsOnDuty.length}`);

  console.log("\n--- Employees marked ON_DUTY in Attendance Page but NOT in Stats ---");
  let count1 = 0;
  for (const a of attendanceOnDuty) {
    if (!statsOnDutyMap.has(a.employee.id)) {
      count1++;
      const empWithLogs = await prisma.employee.findUnique({
        where: { id: a.employee.id },
        select: {
          status: true,
          attendanceLogs: {
            orderBy: { timestamp: "desc" },
            take: 2,
            select: { timestamp: true }
          }
        }
      });
      console.log(`Name: ${a.employee.name} (${a.employee.employeeCode}) | Status: ${a.employee.status}`);
      console.log(`  Attendance CheckIn on target date: ${a.checkIn?.toISOString()}`);
      if (empWithLogs?.attendanceLogs && empWithLogs.attendanceLogs.length > 0) {
        const latest = new Date(empWithLogs.attendanceLogs[0].timestamp);
        const hours = (now.getTime() - latest.getTime()) / (1000 * 60 * 60);
        console.log(`  Latest Biometric Log: ${latest.toISOString()} (${hours.toFixed(2)} hours ago)`);
      } else {
        console.log("  No Biometric Logs found!");
      }
    }
  }
  console.log(`Total: ${count1}`);

  console.log("\n--- Employees marked ON_DUTY in Stats but NOT in Attendance Page ---");
  let count2 = 0;
  for (const s of statsOnDuty) {
    if (!attendanceOnDutyMap.has(s.id)) {
      count2++;
      const att = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: s.id,
            date: fromDate,
          }
        }
      });
      console.log(`Name: ${s.name} (${s.employeeCode})`);
      console.log(`  Attendance Record status on target date: ${att ? att.status : "No Record"}`);
    }
  }
  console.log(`Total: ${count2}`);
}

compare()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
