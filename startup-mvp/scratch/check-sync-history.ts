import { prisma } from "../lib/prisma";

async function checkSyncHistory() {
  console.log("=========================================");
  console.log("🔍 BIOMETRIC SYNC AND DEVICE STATUS");
  console.log("=========================================\n");

  try {
    // 1. Check Biometric Devices
    const devices = await prisma.biometricDevice.findMany();
    console.log("📟 Biometric Devices:");
    if (devices.length > 0) {
      devices.forEach(d => {
        console.log(`- Serial: ${d.serialNumber}`);
        console.log(`  Name: ${d.name}`);
        console.log(`  IP/Port: ${d.ipAddress}:${d.port}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  Last Seen: ${d.lastSeen ? d.lastSeen.toISOString() : "Never"}`);
        if (d.lastSeen) {
          const dhakaTime = new Date(d.lastSeen.getTime() + 6 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
          console.log(`  Last Seen (Dhaka): ${dhakaTime}`);
        }
        console.log();
      });
    } else {
      console.log("No devices found.\n");
    }

    // 2. Check recent Biometric Sync Logs
    const syncLogs = await prisma.biometricSyncLog.findMany({
      orderBy: { syncTime: "desc" },
      include: {
        device: { select: { name: true, serialNumber: true } }
      },
      take: 15
    });

    console.log("🔄 Recent Biometric Sync Logs (up to 15):");
    if (syncLogs.length > 0) {
      syncLogs.forEach(log => {
        const localTime = new Date(log.syncTime.getTime() + 6 * 60 * 60 * 1000).toISOString().replace("T", " ").substring(0, 19);
        console.log(`- [${localTime} Dhaka Time]`);
        console.log(`  Device: ${log.device ? `${log.device.name} (${log.device.serialNumber})` : "N/A"}`);
        console.log(`  Vendor: ${log.vendor}`);
        console.log(`  Status: ${log.status}`);
        console.log(`  Records Count: ${log.recordsCount}`);
        console.log(`  Error Message: ${log.errorMessage || "None"}`);
        console.log();
      });
    } else {
      console.log("No sync logs found.\n");
    }

  } catch (error) {
    console.error("❌ Error querying sync history:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncHistory();
