import { prisma } from "../lib/prisma";
import {
  getActiveEmployees,
  getDailyOutputsList,
  saveEmployeeDailyOutput,
  deleteDailyOutput,
  getEfficiencyReport,
  getTrashedDailyOutputs,
  restoreDailyOutputs,
  permanentlyDeleteDailyOutputs,
} from "../app/(dashboard)/dashboard/hr/production-output/_actions/production-output.action";

async function runTest() {
  console.log("🚀 Starting Employee Production Efficiency Custom CRUD Integration Test...");

  // 1. Fetch active employees list
  console.log("Fetching active employees...");
  const empListResult = await getActiveEmployees();
  if (!empListResult.success || !empListResult.data.length) {
    throw new Error("No active employees found to perform the test.");
  }
  const employee = empListResult.data[0];
  console.log(`Using Employee: ${employee.name} (${employee.employeeCode})`);

  // 2. Set up test parameters
  const testDateStr = "2026-07-30";
  const testDate = new Date(testDateStr);

  // 3. Clear existing test data for the date to avoid collisions
  await prisma.attendance.deleteMany({
    where: { employeeId: employee.id, date: testDate },
  });
  await prisma.employeeDailyOutput.deleteMany({
    where: { employeeId: employee.id, date: testDate },
  });

  // 4. Create check-in attendance record with 8 hours of work
  console.log("Seeding attendance record with 8.00 work hours...");
  await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date: testDate,
      workHours: 8.00,
      status: "PRESENT",
    },
  });

  // 5. Mock Server Action: Save Daily Output Log (50 target pieces, 48 actual pieces)
  console.log("Logging daily production output (50 target, 48 actual)...");
  const saveResult = await saveEmployeeDailyOutput(
    employee.id,
    50,
    48,
    "Test note",
    testDateStr
  );
  if (!saveResult.success) {
    throw new Error(`saveEmployeeDailyOutput failed: ${saveResult.error}`);
  }

  // 6. Test retrieval of logged outputs list
  console.log("Retrieving logged outputs list for date range...");
  const logsResult = await getDailyOutputsList(testDateStr, testDateStr);
  if (!logsResult.success) {
    throw new Error(`getDailyOutputsList failed: ${logsResult.error}`);
  }

  const targetLog = logsResult.data.find((log) => log.employeeId === employee.id);
  if (!targetLog) {
    throw new Error("Logged output record not found in returned list.");
  }

  console.log("Asserting daily output values...");
  console.log(`- Date: ${targetLog.date} (Expected: ${testDateStr})`);
  console.log(`- Target: ${targetLog.targetProduction} (Expected: 50)`);
  console.log(`- Pieces: ${targetLog.piecesProduced} (Expected: 48)`);
  console.log(`- Notes: "${targetLog.notes}" (Expected: "Test note")`);

  if (targetLog.targetProduction !== 50) throw new Error("Incorrect target pieces returned.");
  if (targetLog.piecesProduced !== 48) throw new Error("Incorrect pieces produced returned.");
  if (targetLog.notes !== "Test note") throw new Error("Incorrect notes returned.");

  // 7. Test Efficiency calculations via Report action
  console.log("Fetching efficiency calculations report...");
  const reportResult = await getEfficiencyReport(testDateStr, testDateStr);
  if (!reportResult.success) {
    throw new Error(`getEfficiencyReport failed: ${reportResult.error}`);
  }

  const reportRow = reportResult.data.find((item) => item.employeeId === employee.id);
  if (!reportRow) {
    throw new Error("Employee not found in report summary list.");
  }

  console.log("Asserting efficiency calculations...");
  console.log(`- Pieces/Hour: ${reportRow.piecesPerHour} (Expected: 6.00)`);
  console.log(`- Target Achievement: ${reportRow.targetAchievement}% (Expected: 96.00%)`);
  console.log(`- Rating: ${reportRow.efficiencyRating} (Expected: STANDARD)`);

  if (reportRow.piecesPerHour !== 6.00) throw new Error("Efficiency Pieces/Hour calculation is incorrect.");
  if (reportRow.targetAchievement !== 96.00) throw new Error("Target achievement calculation is incorrect.");
  if (reportRow.efficiencyRating !== "STANDARD") throw new Error("Efficiency rating classification is incorrect.");

  // 8. Test Soft Delete
  console.log("Testing soft deletion...");
  const deleteResult = await deleteDailyOutput(targetLog.id);
  if (!deleteResult.success) {
    throw new Error(`deleteDailyOutput soft delete failed: ${deleteResult.error}`);
  }

  console.log("Retrieving logged list again to check filtering...");
  const logsAfterDeleteResult = await getDailyOutputsList(testDateStr, testDateStr);
  if (!logsAfterDeleteResult.success) {
    throw new Error(`getDailyOutputsList retrieval failed`);
  }
  const deletedLogSearch = logsAfterDeleteResult.data.find((log) => log.id === targetLog.id);
  if (deletedLogSearch) {
    throw new Error("Soft-deleted log was incorrectly returned in active logs list.");
  }
  console.log("- Log filter assertion: PASS (Soft-deleted record is correctly hidden)");

  // 9. Test Trash Bin list view
  console.log("Retrieving trash bin logs list...");
  const trashLogsResult = await getTrashedDailyOutputs(testDateStr, testDateStr);
  if (!trashLogsResult.success || !trashLogsResult.data) {
    throw new Error("getTrashedDailyOutputs retrieval failed");
  }
  const trashedLog = trashLogsResult.data.find((log) => log.id === targetLog.id);
  if (!trashedLog) {
    throw new Error("Soft-deleted log was not found in the trash bin logs list.");
  }
  console.log("- Trash bin list assertion: PASS (Soft-deleted record is visible in trash bin)");

  // 10. Test Restore action
  console.log("Testing restore action...");
  const restoreResult = await restoreDailyOutputs([targetLog.id]);
  if (!restoreResult.success) {
    throw new Error(`restoreDailyOutputs failed: ${restoreResult.error}`);
  }

  const logsAfterRestoreResult = await getDailyOutputsList(testDateStr, testDateStr);
  if (!logsAfterRestoreResult.success) {
    throw new Error(`getDailyOutputsList retrieval failed after restore`);
  }
  const restoredLogSearch = logsAfterRestoreResult.data.find((log) => log.id === targetLog.id);
  if (!restoredLogSearch) {
    throw new Error("Restored log was not returned in active logs list.");
  }
  console.log("- Restore assertion: PASS (Record returned back to active logs list)");

  // 11. Test Permanent Delete action
  console.log("Testing permanent delete action...");
  const permanentDeleteResult = await permanentlyDeleteDailyOutputs([targetLog.id]);
  if (!permanentDeleteResult.success) {
    throw new Error(`permanentlyDeleteDailyOutputs failed: ${permanentDeleteResult.error}`);
  }

  console.log("Querying database directly to assert deletion...");
  const dbRecordAfterPermanentDelete = await prisma.employeeDailyOutput.findUnique({
    where: { id: targetLog.id },
  });
  if (dbRecordAfterPermanentDelete) {
    throw new Error("Record still exists in database after permanent delete.");
  }
  console.log("- Permanent delete assertion: PASS (Record hard-deleted from database)");

  // 12. Clean up attendance
  console.log("Cleaning up integration test attendance...");
  await prisma.attendance.delete({
    where: { employeeId_date: { employeeId: employee.id, date: testDate } },
  });

  console.log("🎉 ALL TESTS PASSED - SYSTEM FUNCTIONING PERFECTLY!");
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
  });
