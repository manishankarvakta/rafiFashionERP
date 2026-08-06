"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Fetch distinct designations for a given department
 * If departmentId is "all" or undefined, it fetches unique designations globally
 */
export async function getDesignationsByDepartment(departmentId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        designations: [],
        error: "Unauthorized",
      };
    }

    const where: any = {
      status: { not: "trash" },
      designation: { not: null },
    };

    if (departmentId && departmentId !== "all") {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { name: true }
      });
      if (dept) {
        where.OR = [
          { departmentId: departmentId },
          { department: { equals: dept.name, mode: "insensitive" } }
        ];
      } else {
        where.departmentId = departmentId;
      }
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        designation: true,
      },
      distinct: ["designation"],
    });

    const designations = employees
      .map((e) => e.designation)
      .filter((d): d is string => !!d && d.trim() !== "")
      .sort();

    return {
      success: true,
      designations,
    };
  } catch (error) {
    console.error("getDesignationsByDepartment error:", error);
    return {
      success: false,
      designations: [],
      error: error instanceof Error ? error.message : "Failed to fetch designations",
    };
  }
}
