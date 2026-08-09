import React from "react";
import { getAttendanceRecordsPaginated } from "./_actions/attendance.action";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FiPlus, FiSettings } from "react-icons/fi";
import AttendanceListClient from "./_components/attendance-list";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import BiometricSyncButton from "./_components/biometric-sync-button";
import { getDepartments } from "../../employees/departments/_actions/department.action";
import { getDesignationsByDepartment } from "../../employees/_actions/designation.action";

interface AttendancePageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    productionLineId?: string;
    deviceId?: string;
    employeeId?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
    departmentId?: string;
    designation?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const params = await searchParams;
  
  const page = parseInt(params.page || "1", 10);
  const limit = parseInt(params.limit || "10", 10);
  const search = params.search || "";
  const productionLineId = params.productionLineId || undefined;
  const deviceId = params.deviceId || undefined;
  const employeeId = params.employeeId || undefined;
  const departmentId = params.departmentId || undefined;
  const designation = params.designation || undefined;
  
  // Set default date range if not provided (e.g. today)
  const today = new Date().toISOString().split("T")[0];
  const fromDate = params.fromDate || today;
  const toDate = params.toDate || today;
  const status = params.status || undefined;

  const session = await auth();
  const userId = session?.user?.id;

  // Check permissions and fetch data concurrently
  const [result, departmentsResult, designationsResult, canView, canEdit] = await Promise.all([
    getAttendanceRecordsPaginated({
      page,
      limit,
      search,
      productionLineId,
      deviceId,
      employeeId,
      fromDate,
      toDate,
      status,
      departmentId,
      designation
    }),
    getDepartments(1, 100, "", "active"),
    getDesignationsByDepartment(departmentId),
    userId ? hasPermission(userId, "hr.attendance", "view") : false,
    userId ? hasPermission(userId, "hr.attendance", "edit") : false,
  ]);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Attendance</h1>
            <p className="text-sm text-muted-foreground">Manage employee daily attendance</p>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {result.error || "Failed to load attendance"}
          </p>
        </div>
      </div>
    );
  }

  const departments = departmentsResult.success && departmentsResult.departments ? (departmentsResult.departments as any[]) : [];
  const designations = designationsResult.success && designationsResult.designations ? designationsResult.designations : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Attendance</h1>
          <p className="text-sm text-muted-foreground">Manage check-ins, check-outs, and daily status across all locations</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <BiometricSyncButton date={fromDate} />
              <Button asChild variant="outline">
                <Link href="/dashboard/hr/attendance/devices">
                  <FiSettings className="mr-2 h-4 w-4" />
                  Manage Devices
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/hr/attendance/manual-punch">
                  <FiPlus className="mr-2 h-4 w-4" />
                  Manual Punch
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <AttendanceListClient
        initialAttendances={result.attendances || []}
        pagination={result.pagination}
        departments={departments}
        designations={designations}
        filters={{
          page,
          limit,
          search,
          productionLineId: productionLineId || "",
          deviceId: deviceId || "",
          employeeId: employeeId || "",
          fromDate,
          toDate,
          status: status || "ALL",
          departmentId: departmentId || "all",
          designation: designation || "all",
        }}
        permissions={{
          view: canView,
          edit: canEdit,
        }}
      />
    </div>
  );
}
