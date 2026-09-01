import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTimezoneFromDb } from "@/lib/hr/shift-utils";

export async function POST(req: Request) {
  try {
    await syncTimezoneFromDb();
    
    console.log(`\n======================================================`);
    console.log(`💓 [HEARTBEAT INCOMING] Request received at: ${new Date().toLocaleTimeString()}`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("⚠️ [HEARTBEAT] Missing or invalid Authorization header:", authHeader);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const expectedKey = process.env.BIOMETRIC_API_KEY || "default-secret-key";
    if (token !== expectedKey) {
      console.warn(`⚠️ [HEARTBEAT] API key mismatch. Received: ${token.substring(0, 10)}... | Expected: ${expectedKey.substring(0, 10)}...`);
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const body = await req.json();
    console.log("💓 [HEARTBEAT RECEIVED FROM TS-BIOMETRIC]:\n", JSON.stringify(body, null, 2));
    const { gatewayId, status, pendingLogs, failedLogs, activeDevices, deviceSerials } = body;

    console.log(`💓 [HEARTBEAT SUMMARY] Gateway: ${gatewayId} | Status: ${status} | Pending: ${pendingLogs} | Failed: ${failedLogs} | Active Devices: ${activeDevices} | Serials: ${JSON.stringify(deviceSerials || [])}`);

    let commandToSend = null;

    // Update lastPingAt for devices mapped to this gateway location OR matching reported serial numbers OR fallback to all active devices
    if (gatewayId) {
      // Check if there are devices explicitly mapped to this gatewayId or reported serials
      const explicitlyMappedDevicesCount = await prisma.biometricDevice.count({
        where: {
          isActive: true,
          OR: [
            { location: gatewayId },
            ...(Array.isArray(deviceSerials) && deviceSerials.length > 0
              ? [{ serialNumber: { in: deviceSerials } }]
              : []),
          ],
        },
      });

      // Define device matching condition:
      // If explicit matches exist, use them.
      // Otherwise, fallback gracefully to match active devices so commands don't stay stuck in QUEUED.
      const deviceMatchCondition = explicitlyMappedDevicesCount > 0
        ? {
            isActive: true,
            OR: [
              { location: gatewayId },
              ...(Array.isArray(deviceSerials) && deviceSerials.length > 0
                ? [{ serialNumber: { in: deviceSerials } }]
                : []),
            ],
          }
        : {
            isActive: true,
          };

      await prisma.biometricDevice.updateMany({
        where: deviceMatchCondition,
        data: {
          lastPingAt: new Date(),
        },
      }).catch(() => null);

      // 1. Reset commands stuck in SENT status for over 5 minutes for this gateway or devices
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await prisma.biometricCommand.updateMany({
        where: {
          status: "SENT",
          sentAt: { lt: fiveMinutesAgo },
          device: deviceMatchCondition,
        },
        data: {
          status: "QUEUED",
          sentAt: null,
        },
      }).catch((e) => {
        console.error("Failed to reset stuck biometric commands:", e.message);
      });

      // 2. Find oldest QUEUED or PENDING command for any active device matching this gateway
      const pendingCommand = await prisma.biometricCommand.findFirst({
        where: {
          status: { in: ["QUEUED", "PENDING"] },
          device: deviceMatchCondition,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          commandType: true,
          deviceId: true,
          deviceSerialNumber: true,
          payloadJson: true,
        },
      });

      if (pendingCommand) {
        console.log(`💓 [HEARTBEAT] Found pending command ID: ${pendingCommand.id} of type ${pendingCommand.commandType} for Gateway: ${gatewayId}`);
        // Update the command to SENT and register sentAt
        await prisma.biometricCommand.update({
          where: { id: pendingCommand.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        // Parse payload
        let payload = {};
        if (pendingCommand.payloadJson) {
          try {
            payload = JSON.parse(pendingCommand.payloadJson);
          } catch (e) {
            console.error("Failed to parse command payloadJson:", e);
          }
        }

        commandToSend = {
          id: pendingCommand.id,
          commandType: pendingCommand.commandType,
          deviceId: pendingCommand.deviceId,
          serialNumber: pendingCommand.deviceSerialNumber,
          ...payload,
        };
        console.log("💓 [HEARTBEAT] Dispatched command payload to Gateway:\n", JSON.stringify(commandToSend, null, 2));
      } else {
        console.log(`💓 [HEARTBEAT] No pending command found for Gateway: ${gatewayId}`);
      }
    }

    if (commandToSend) {
      return NextResponse.json({ success: true, command: commandToSend });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gateway heartbeat error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

