"use server";

import { prisma } from "@/lib/prisma";

export async function getProductionLines() {
  try {
    let lines = await prisma.productionLine.findMany({
      where: { isTrash: false, status: "active" },
      orderBy: { name: "asc" }
    });

    // Auto-seed default lines if table is empty
    if (lines.length === 0) {
      await prisma.productionLine.createMany({
        data: [
          { name: "Line 1", code: "line-1" },
          { name: "Line 2", code: "line-2" },
          { name: "Common", code: "common" }
        ]
      });
      lines = await prisma.productionLine.findMany({
        where: { isTrash: false, status: "active" },
        orderBy: { name: "asc" }
      });
    }

    return { success: true, lines };
  } catch (error) {
    console.error("getProductionLines error:", error);
    return { success: false, lines: [] };
  }
}

export async function createProductionLine(input: { name: string; code: string }) {
  try {
    const line = await prisma.productionLine.create({
      data: {
        name: input.name,
        code: input.code
      }
    });
    return { success: true, line };
  } catch (error: any) {
    console.error("createProductionLine error:", error);
    return { success: false, error: error.message || "Failed to create line" };
  }
}
