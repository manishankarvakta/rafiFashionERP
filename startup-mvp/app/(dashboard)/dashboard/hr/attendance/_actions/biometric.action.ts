"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { syncBiometricLogs } from "@/lib/hr/biometric/sync-service";
import { revalidateBothPaths } from "@/lib/route-utils-server";
import { biometricQueue, BiometricJobType } from "@/lib/hr/biometric/queue";
import { Prisma } from "@prisma/client";

/**
 * Sync Biometric Logs (External JSON/CSV trigger)
 */
export async function triggerBiometricSync(input: {
  vendor: string;
  rawData: any[];
  deviceId?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canSync = await hasPermission(session.user.id, "hr.attendance", "create");
    if (!canSync) return { success: false, error: "Permission denied" };

    const result = await syncBiometricLogs({
      ...input,
      syncedBy: session.user.id,
    });

    if (result.success) {
      revalidateBothPaths("hr/attendance");
    }

    return result;
  } catch (error) {
    return { success: false, error: "Action failed" };
  }
}

/**
 * Process Raw Logs into Attendance Records
 */
export async function triggerAttendanceProcessing(startDate: Date, endDate: Date) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canProcess = await hasPermission(session.user.id, "hr.attendance", "edit");
    if (!canProcess) return { success: false, error: "Permission denied" };

    // Enqueue background processing job
    await biometricQueue.add(`process-${Date.now()}`, {
      type: BiometricJobType.PROCESS_ATTENDANCE,
      startDate: startDate,
      endDate: endDate,
    });

    return { success: true, message: "Attendance processing started in the background" };
  } catch (error) {
    console.error("triggerAttendanceProcessing error:", error);
    return { success: false, error: "Failed to start processing" };
  }
}

/**
 * Get Sync Logs
 */
export async function getBiometricSyncLogs(limit = 10) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const logs = await prisma.biometricSyncLog.findMany({
      take: limit,
      orderBy: { syncTime: "desc" },
      include: { user: { select: { name: true } } },
    });

    return { success: true, logs };
  } catch (error) {
    return { success: false, error: "Failed to fetch logs" };
  }
}

/**
 * Trigger Active Pull from all TCP/IP (Direct) Devices
 */
export async function triggerActiveDeviceSync() {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canSync = await hasPermission(session.user.id, "hr.attendance", "create");
    if (!canSync) return { success: false, error: "Permission denied" };

    // Fetch all active IP devices
    const devices = await prisma.biometricDevice.findMany({
      where: { status: "active", connectionType: "IP" },
    });

    if (devices.length === 0) {
      return { success: false, error: "No active TCP/IP devices configured." };
    }

    const { pullLogsFromDevice } = await import("@/lib/hr/biometric/zklib-service");

    let totalPulled = 0;
    let failedDevices = 0;

    for (const device of devices) {
      if (!device.ipAddress) {
        failedDevices++;
        continue;
      }

      // Update ping time
      await prisma.biometricDevice.update({
        where: { id: device.id },
        data: { lastPingAt: new Date() }
      });

      const port = device.port || 4370;
      const pullResult = await pullLogsFromDevice(device.ipAddress, port);

      if (pullResult.success && pullResult.logs && pullResult.logs.length > 0) {
        // Enqueue the downloaded logs using existing queue logic
        await syncBiometricLogs({
          vendor: device.vendor || "ZKTeco",
          rawData: pullResult.logs,
          deviceId: device.id,
          syncedBy: session.user.id,
        });
        totalPulled += pullResult.logs.length;
      } else if (!pullResult.success) {
        failedDevices++;
      }
    }

    revalidateBothPaths("hr/attendance");

    if (failedDevices > 0 && totalPulled === 0) {
      return { success: false, error: `Failed to connect to ${failedDevices} device(s).` };
    }

    return { 
      success: true, 
      message: `Successfully queued ${totalPulled} logs from devices.`,
      totalPulled
    };

  } catch (error: any) {
    console.error("triggerActiveDeviceSync error:", error);
    return { success: false, error: "Action failed" };
  }
}

/**
 * Queue historical log re-sync command for all active devices matching options
 */
export async function triggerBulkRangeSync(fromDate: string, toDate: string, warehouseId?: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canEdit = await hasPermission(session.user.id, "hr.attendance", "edit");
    if (!canEdit) return { success: false, error: "Permission denied" };

    if (!fromDate || !toDate) {
      return { success: false, error: "From Date and To Date are required" };
    }

    console.log(`📡 [SERVER ACTION] triggerBulkRangeSync starting: fromDate=${fromDate}, toDate=${toDate}, warehouseId=${warehouseId || "ALL"}`);

    const deviceWhere: Prisma.BiometricDeviceWhereInput = {
      isActive: true,
    };

    if (warehouseId && warehouseId !== "all") {
      deviceWhere.warehouseId = warehouseId;
    }

    const devices = await prisma.biometricDevice.findMany({
      where: deviceWhere,
    });

    console.log(`📡 [SERVER ACTION] Found ${devices.length} active device(s) matching filter.`);

    if (devices.length === 0) {
      return { success: false, error: "No active biometric devices found." };
    }

    let queuedCount = 0;
    for (const device of devices) {
      // Check if there is already a QUEUED or SENT sync range command for this device in this exact range
      const existing = await prisma.biometricCommand.findFirst({
        where: {
          deviceId: device.id,
          commandType: "SYNC_RANGE",
          status: { in: ["QUEUED", "SENT"] },
          payloadJson: {
            contains: `"fromDate":"${fromDate}"`
          }
        }
      });

      if (existing) {
        console.log(`📡 [SERVER ACTION] Device ${device.name} (SN: ${device.serialNumber}) already has command pending. Skipping duplicate.`);
        continue;
      }

      await prisma.biometricCommand.create({
        data: {
          deviceId: device.id,
          deviceSerialNumber: device.serialNumber || "",
          commandType: "SYNC_RANGE",
          commandText: `Sync logs from ${fromDate} to ${toDate}`,
          payloadJson: JSON.stringify({ fromDate, toDate }),
          status: "QUEUED",
          requestedById: session.user.id,
        },
      });
      console.log(`📡 [SERVER ACTION] Enqueued SYNC_RANGE command for device ${device.name} (SN: ${device.serialNumber})`);
      queuedCount++;
    }

    revalidateBothPaths("hr/attendance");

    console.log(`📡 [SERVER ACTION] Finished. Enqueued ${queuedCount} command(s) successfully.`);

    if (queuedCount === 0) {
      return { 
        success: true, 
        message: "Sync range commands are already queued or sent for the selected devices/range." 
      };
    }

    return { 
      success: true, 
      message: `Successfully enqueued sync commands for ${queuedCount} active device(s).` 
    };

  } catch (error: any) {
    console.error("triggerBulkRangeSync error:", error);
    return { success: false, error: error.message || "Failed to trigger sync range" };
  }
}

