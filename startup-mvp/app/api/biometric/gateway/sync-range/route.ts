import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { biometricQueue, BiometricJobType } from "@/lib/hr/biometric/queue";
import { syncTimezoneFromDb } from "@/lib/hr/shift-utils";
import { validateSyncedByUser, processBiometricLogsDirectly } from "@/lib/hr/biometric/sync-service";
import { revalidateBothPaths } from "@/lib/route-utils-server";

export async function POST(req: Request) {
  try {
    await syncTimezoneFromDb();

    // Basic security handshake
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    if (token !== (process.env.BIOMETRIC_API_KEY || "default-secret-key")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

        const body = await req.json();
    const { commandId, status, vendor, rawData, error } = body;

    console.log(`📥 [SYNC CALLBACK] Received sync-range callback: commandId=${commandId}, status=${status}, vendor=${vendor}, rawDataCount=${rawData?.length || 0}`);

    if (!commandId || !status) {
      console.warn("📥 [SYNC CALLBACK] Validation failed: missing commandId or status.");
      return NextResponse.json({ error: "commandId and status are required." }, { status: 400 });
    }

    const command = await prisma.biometricCommand.findUnique({
      where: { id: commandId }
    });

    if (!command) {
      console.warn(`📥 [SYNC CALLBACK] Command ID ${commandId} not found in database.`);
      return NextResponse.json({ error: "Command not found" }, { status: 404 });
    }

    console.log(`📥 [SYNC CALLBACK] Found corresponding BiometricCommand for Device ID: ${command.deviceId}`);

    if (status === "FAILED") {
      console.log(`📥 [SYNC CALLBACK] Processing FAILED callback state: error=${error}`);
      await prisma.biometricCommand.update({
        where: { id: commandId },
        data: {
          status: "FAILED",
          errorMessage: error || "Gateway reported failure",
          respondedAt: new Date(),
          completedAt: new Date(),
        }
      });
      return NextResponse.json({ success: true, message: "Registered command failure status" });
    }

    if (status === "COMPLETED") {
      if (!rawData || !Array.isArray(rawData)) {
        console.warn("📥 [SYNC CALLBACK] Validation failed: rawData is missing or not an array for COMPLETED status.");
        return NextResponse.json({ error: "rawData array is required for COMPLETED status" }, { status: 400 });
      }

      console.log(`📥 [SYNC CALLBACK] Processing COMPLETED state. Queueing logs.`);
      if (rawData && rawData.length > 0) {
        console.log(`📥 [SYNC CALLBACK] Raw Data Preview (First 5 records):\n`, JSON.stringify(rawData.slice(0, 5), null, 2));
      }

      // Update command to ACKNOWLEDGED state while we process it in queue
      await prisma.biometricCommand.update({
        where: { id: commandId },
        data: {
          status: "ACKNOWLEDGED",
          respondedAt: new Date(),
        }
      });

      // Safely validate requestedById against user table
      const safeSyncedBy = await validateSyncedByUser(command.requestedById);

      // Create a biometric sync log to trace this run
      const syncLog = await prisma.biometricSyncLog.create({
        data: {
          vendor: vendor || "ZKTeco",
          deviceId: command.deviceId || undefined,
          recordsCount: rawData.length,
          syncedBy: safeSyncedBy,
          status: "PENDING",
        }
      });

      console.log(`📥 [SYNC CALLBACK] Created BiometricSyncLog ID: ${syncLog.id}`);

      const isDev = process.env.NODE_ENV === "development" || process.env.BIOMETRIC_SYNC_MODE === "sync";
      let enqueued = false;

      if (!isDev) {
        try {
          // Enqueue BullMQ SYNC_LOGS job
          await biometricQueue.add(`sync-range-${commandId}`, {
            type: BiometricJobType.SYNC_LOGS,
            syncLogId: syncLog.id,
            vendor: vendor || "ZKTeco",
            rawData: rawData,
            deviceId: command.deviceId || undefined,
            commandId: command.id,
          });
          enqueued = true;
          console.log(`📥 [SYNC CALLBACK] Successfully enqueued SYNC_LOGS job in BullMQ (sync-range-${commandId})`);
        } catch (queueError) {
          console.warn("⚠️ BullMQ queue add failed, falling back to direct synchronous processing:", queueError);
        }
      }

      if (!enqueued) {
        console.log(`⚡ [SYNC CALLBACK] Dev/Fallback mode: Directly processing ${rawData.length} records...`);
        await processBiometricLogsDirectly({
          syncLogId: syncLog.id,
          vendor: vendor || "ZKTeco",
          rawData,
          deviceId: command.deviceId || undefined,
          commandId: command.id,
        });
      }

      // Revalidate HR attendance dashboard
      try {
        revalidateBothPaths("hr/attendance");
      } catch (_) {}

      return NextResponse.json({ success: true, syncLogId: syncLog.id });
    }

    return NextResponse.json({ error: "Unsupported status value" }, { status: 400 });

  } catch (error: any) {
    console.error("Gateway sync-range callback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
