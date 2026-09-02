const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== Biometric Sync Diagnostic Report ===');
  
  // 1. Check last 10 Sync Logs
  try {
    const syncLogs = await prisma.biometricSyncLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log('\n--- Recent Biometric Sync Logs ---');
    if (syncLogs.length === 0) {
      console.log('No sync logs found.');
    } else {
      syncLogs.forEach(log => {
        console.log(`ID: ${log.id} | Status: ${log.status} | Records: ${log.recordsCount} | Time: ${log.createdAt} | Error: ${log.errorMessage}`);
      });
    }
  } catch (e) {
    console.error('Error fetching biometricSyncLog:', e.message);
  }

  // 2. Check last 10 Unmapped Biometric Logs
  try {
    const unmapped = await prisma.unmappedBiometricLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    console.log('\n--- Recent Unmapped Biometric Logs ---');
    if (unmapped.length === 0) {
      console.log('No unmapped logs found.');
    } else {
      unmapped.forEach(log => {
        console.log(`DeviceUser: ${log.deviceUserId} | PunchTime: ${log.punchTime} | Reason: ${log.reason} | Status: ${log.status}`);
      });
    }
  } catch (e) {
    console.error('Error fetching unmappedBiometricLog:', e.message);
  }

  // 3. Check if target employees exist
  const targetPins = ['1370', '1384', '1377', '1385', '1379', '1382'];
  try {
    const employees = await prisma.employee.findMany({
      where: {
        biometricDeviceId: { in: targetPins }
      },
      select: {
        id: true,
        name: true,
        biometricDeviceId: true
      }
    });
    console.log('\n--- Employee Biometric Configurations ---');
    if (employees.length === 0) {
      console.log(`No employees found with biometricDeviceIds in [${targetPins.join(', ')}].`);
    } else {
      employees.forEach(emp => {
        console.log(`Name: ${emp.name} | ID: ${emp.id} | BiometricID: ${emp.biometricDeviceId}`);
      });
    }
  } catch (e) {
    console.error('Error fetching employees:', e.message);
  }

  // 4. Check active device mappings for targets
  try {
    const mappings = await prisma.employeeDeviceMap.findMany({
      where: {
        deviceUserId: { in: targetPins }
      },
      select: {
        deviceId: true,
        deviceUserId: true,
        employeeId: true,
        isActive: true,
        syncStatus: true
      }
    });
    console.log('\n--- Employee-Device Mappings for target PINs ---');
    if (mappings.length === 0) {
      console.log('No mappings found for target PINs.');
    } else {
      mappings.forEach(m => {
        console.log(`DeviceID: ${m.deviceId} | UserID: ${m.deviceUserId} | EmployeeID: ${m.employeeId} | Active: ${m.isActive} | Sync: ${m.syncStatus}`);
      });
    }
  } catch (e) {
    console.error('Error fetching employeeDeviceMap:', e.message);
  }

  // 5. Check recent Attendance Logs
  try {
    const attLogs = await prisma.attendanceLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        employee: {
          select: {
            name: true
          }
        }
      }
    });
    console.log('\n--- Recent Attendance Logs in Database ---');
    if (attLogs.length === 0) {
      console.log('No attendance logs found.');
    } else {
      attLogs.forEach(log => {
        console.log(`Employee: ${log.employee?.name || 'Unknown'} | Time: ${log.timestamp} | Source: ${log.source}`);
      });
    }
  } catch (e) {
    console.error('Error fetching attendanceLog:', e.message);
  }

  process.exit(0);
}

diagnose();
