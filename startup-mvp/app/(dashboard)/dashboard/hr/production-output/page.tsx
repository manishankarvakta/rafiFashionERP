import React, { Suspense } from "react";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PageGuard from "@/components/permissions/page-guard";
import ProductionOutputClient from "./_components/production-output-client";

export const metadata: Metadata = {
  title: "Employee Daily Production Output | ERP",
  description: "Track employee daily output logs and analyze efficiency metrics",
};

export default async function ProductionOutputPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role;

  const isAdmin = userRole ? ["admin", "super admin", "superadmin"].includes(userRole.toLowerCase()) : false;

  // 1. Fetch permissions
  const [canCreate, canEdit, canView] = await Promise.all([
    userId ? (isAdmin || hasPermission(userId, "hr.production-output", "create")) : Promise.resolve(false),
    userId ? (isAdmin || hasPermission(userId, "hr.production-output", "edit")) : Promise.resolve(false),
    userId ? (isAdmin || hasPermission(userId, "hr.production-output", "view")) : Promise.resolve(false),
  ]);

  // 2. Fetch master metadata for selects
  const warehouses = await prisma.warehouse.findMany({
    where: { status: "active", isTrash: false },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });

  return (
    <PageGuard permissionKey="hr.production-output">
      <Suspense fallback={<div className="p-6">Loading production output dashboard...</div>}>
        <ProductionOutputClient
          warehouses={warehouses}
          permissions={{ canCreate, canEdit, canView }}
        />
      </Suspense>
    </PageGuard>
  );
}
