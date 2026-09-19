"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { FiPrinter } from "react-icons/fi";
import { format } from "date-fns";

interface PrintEmployeeDetailsDialogProps {
  employee: any;
  orgInfo: any;
  salaryStructure?: any;
}

export default function PrintEmployeeDetailsDialog({
  employee,
  orgInfo,
  salaryStructure,
}: PrintEmployeeDetailsDialogProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Employee-Profile-${employee?.employeeCode || employee?.name || "Details"}`,
  });

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd-MMM-yyyy");
    } catch {
      return "-";
    }
  };

  const getFullAddress = (addr?: any) => {
    if (!addr) return "-";
    if (typeof addr === "string") return addr;
    const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
  };

  const formatCurrency = (amount?: number | string | null) => {
    if (amount === undefined || amount === null || isNaN(Number(amount))) return "0.00";
    return Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const grossSalary = Number(employee?.salary) || 0;
  const struct = salaryStructure || {
    basicPercent: 55,
    houseRentPercent: 26,
    medicalPercent: 5,
    transportPercent: 4,
    foodPercent: 10,
  };

  return (
    <>
      {/* Hidden Printable Template - Activated on Direct Print */}
      <div className="hidden">
        <div
          ref={componentRef}
          className="bg-white text-black font-sans p-6 w-[190mm] mx-auto min-h-[265mm] text-[11px] leading-tight flex flex-col justify-between box-border"
          style={{
            colorScheme: "light",
            backgroundColor: "#ffffff",
            color: "#111827",
          }}
        >
          {/* Strict A4 Print CSS */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm !important;
              }
              html, body {
                background: #ffffff !important;
                color: #111827 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .employee-print-sheet {
                width: 100% !important;
                max-width: 190mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .employee-print-sheet * {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              table {
                border-collapse: collapse !important;
                width: 100% !important;
              }
              th, td {
                border: 1px solid #d1d5db !important;
              }
            }
          `}} />

          {/* Main Content Area */}
          <div className="employee-print-sheet space-y-3">
            {/* Top Header / Company Branding */}
            <div className="flex justify-between items-start border-b-2 border-gray-400 pb-2">
              <div>
                <h1 className="text-xl font-bold tracking-wide text-gray-900 uppercase">
                  {orgInfo?.name || "RAFI FASHION"}
                </h1>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {orgInfo?.address || "Head Office / Factory premises"}
                  {orgInfo?.phone ? ` | Phone: ${orgInfo.phone}` : ""}
                  {orgInfo?.email ? ` | Email: ${orgInfo.email}` : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block border border-gray-600 text-gray-900 font-bold text-[10px] px-2 py-0.5 rounded tracking-wider uppercase">
                  Employee Profile
                </span>
                <p className="text-[9px] text-gray-500 mt-1">
                  ID: {employee?.employeeCode || employee?.id?.slice(-8)}
                </p>
              </div>
            </div>

            {/* Profile Summary & Photo Row */}
            <div className="flex gap-4 items-center border border-gray-300 rounded p-2.5 bg-white">
              <div className="w-[75px] h-[90px] shrink-0 rounded border border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                {employee?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employee.photo}
                    alt={employee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[9.5px] text-gray-400 font-medium text-center px-1">
                    No Photo
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 flex-1">
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Full Name</span>
                  <span className="text-[12.5px] font-bold text-gray-900 block">{employee?.name || "-"}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Employee Code</span>
                  <span className="text-[11.5px] font-mono font-bold text-gray-900 block">
                    {employee?.employeeCode || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Status</span>
                  <span className="inline-block text-[10px] font-bold uppercase text-gray-800 mt-0.5">
                    {employee?.status || "Active"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Designation</span>
                  <span className="text-[11px] font-semibold text-gray-800 block">
                    {employee?.designation || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Department</span>
                  <span className="text-[11px] font-semibold text-gray-800 block">
                    {employee?.departmentRelation?.name || employee?.department || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-gray-500 block">Joining Date</span>
                  <span className="text-[11px] font-semibold text-gray-800 block">
                    {formatDate(employee?.joiningDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 1: Personal & Contact Details */}
            <div>
              <div className="border-b border-gray-400 pb-0.5 mb-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-900">
                1. Personal & Contact Details
              </div>
              <table className="w-full text-[10px] border border-gray-300">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Phone Number</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">{employee?.phone || "-"}</td>
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Email Address</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">{employee?.email || "-"}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">National ID / NID</td>
                    <td className="p-1.5 text-gray-900 font-medium">{employee?.nationalId || "-"}</td>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Date of Birth</td>
                    <td className="p-1.5 text-gray-900 font-medium">{formatDate(employee?.dateOfBirth)}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Gender</td>
                    <td className="p-1.5 text-gray-900 font-medium">{employee?.gender || "-"}</td>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Blood Group</td>
                    <td className="p-1.5 text-gray-900 font-bold">{employee?.bloodGroup || "-"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Address</td>
                    <td colSpan={3} className="p-1.5 text-gray-900 font-medium">
                      {getFullAddress(employee?.address)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: Employment & Workplace Details */}
            <div>
              <div className="border-b border-gray-400 pb-0.5 mb-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-900">
                2. Employment & Workplace Information
              </div>
              <table className="w-full text-[10px] border border-gray-300">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Employment Type</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">
                      {employee?.employeeType?.name || employee?.type || "Regular"}
                    </td>
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Assigned Shift</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">
                      {employee?.shift
                        ? `${employee.shift.name} (${employee.shift.startTime} - ${employee.shift.endTime})`
                        : "-"}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Floor & Line</td>
                    <td className="p-1.5 text-gray-900 font-medium">
                      {[employee?.floorRelation?.name, employee?.lineRelation?.name].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Warehouse</td>
                    <td className="p-1.5 text-gray-900 font-medium">{employee?.warehouse?.name || "-"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Biometric ID</td>
                    <td className="p-1.5 text-gray-900 font-medium">{employee?.biometricDeviceId || "-"}</td>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Key Skills</td>
                    <td className="p-1.5 text-gray-900 font-medium">
                      {Array.isArray(employee?.skills) && employee.skills.length > 0
                        ? employee.skills.join(", ")
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Salary Structure & Accounts Details */}
            <div>
              <div className="border-b border-gray-400 pb-0.5 mb-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-900">
                3. Salary Structure & Accounting Information
              </div>
              <div className="border border-gray-300 p-2 bg-white">
                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-200">
                  <span className="font-bold text-[10.5px] text-gray-900">
                    Gross Monthly Salary: ৳ {formatCurrency(grossSalary)} BDT
                  </span>
                  <span className="text-[9px] text-gray-600">
                    Policy Structure: <strong>{struct?.name || "Standard"}</strong>
                  </span>
                </div>

                {/* 5-Column Salary Breakdown Table */}
                <table className="w-full text-[9px] border border-gray-300 text-center mb-1.5">
                  <thead className="bg-gray-50 font-bold text-gray-800">
                    <tr>
                      <th className="p-1 border border-gray-300">Basic ({struct.basicPercent}%)</th>
                      <th className="p-1 border border-gray-300">House Rent ({struct.houseRentPercent}%)</th>
                      <th className="p-1 border border-gray-300">Medical ({struct.medicalPercent}%)</th>
                      <th className="p-1 border border-gray-300">Transport ({struct.transportPercent}%)</th>
                      <th className="p-1 border border-gray-300">Food ({struct.foodPercent}%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-semibold text-gray-900">
                      <td className="p-1 border border-gray-300">
                        ৳ {formatCurrency((grossSalary * struct.basicPercent) / 100)}
                      </td>
                      <td className="p-1 border border-gray-300">
                        ৳ {formatCurrency((grossSalary * struct.houseRentPercent) / 100)}
                      </td>
                      <td className="p-1 border border-gray-300">
                        ৳ {formatCurrency((grossSalary * struct.medicalPercent) / 100)}
                      </td>
                      <td className="p-1 border border-gray-300">
                        ৳ {formatCurrency((grossSalary * struct.transportPercent) / 100)}
                      </td>
                      <td className="p-1 border border-gray-300">
                        ৳ {formatCurrency((grossSalary * struct.foodPercent) / 100)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                  <div className="border border-gray-200 p-1 rounded">
                    <span className="font-semibold text-gray-600 block text-[8.5px]">Salary Payable Account:</span>
                    <span className="font-medium text-gray-900">
                      {employee?.salaryPayableAccount
                        ? `${employee.salaryPayableAccount.code} - ${employee.salaryPayableAccount.name}`
                        : "-"}
                    </span>
                  </div>
                  <div className="border border-gray-200 p-1 rounded">
                    <span className="font-semibold text-gray-600 block text-[8.5px]">Advance Account:</span>
                    <span className="font-medium text-gray-900">
                      {employee?.advanceAccount
                        ? `${employee.advanceAccount.code} - ${employee.advanceAccount.name}`
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Emergency Contact & Nominee Details */}
            <div>
              <div className="border-b border-gray-400 pb-0.5 mb-1 text-[10.5px] font-bold uppercase tracking-wider text-gray-900">
                4. Emergency Contact & Nominee Details
              </div>
              <table className="w-full text-[10px] border border-gray-300">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Emergency Contact</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">
                      {(employee?.emergencyContact as any)?.name
                        ? `${(employee.emergencyContact as any).name} (${(employee.emergencyContact as any).relation || "Contact"}) - ${(employee.emergencyContact as any).phone || ""}`
                        : "-"}
                    </td>
                    <td className="w-1/6 font-semibold bg-gray-50/70 p-1.5 text-gray-700">Nominee Name</td>
                    <td className="w-2/6 p-1.5 text-gray-900 font-medium">
                      {(employee?.nominee as any)?.name || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Nominee Phone</td>
                    <td className="p-1.5 text-gray-900 font-medium">{(employee?.nominee as any)?.phone || "-"}</td>
                    <td className="font-semibold bg-gray-50/70 p-1.5 text-gray-700">Nominee Address</td>
                    <td className="p-1.5 text-gray-900 font-medium">{(employee?.nominee as any)?.address || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Signature & Verification Block (Strict Single Page Footer) */}
          <div className="pt-6 mt-auto border-t border-gray-400">
            <div className="grid grid-cols-3 gap-6 text-center text-[10px]">
              <div>
                <div className="border-t border-gray-700 pt-1 font-bold text-gray-900">
                  Employee&apos;s Signature
                </div>
                <span className="text-[8.5px] text-gray-500">Date: _______________</span>
              </div>
              <div>
                <div className="border-t border-gray-700 pt-1 font-bold text-gray-900">
                  HR & Admin Officer
                </div>
                <span className="text-[8.5px] text-gray-500">Verified & Checked</span>
              </div>
              <div>
                <div className="border-t border-gray-700 pt-1 font-bold text-gray-900">
                  Authorized Signature
                </div>
                <span className="text-[8.5px] text-gray-500">Management Approval</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[8px] text-gray-400 mt-4 pt-1 border-t border-gray-200">
              <span>System Generated Employee Document | {orgInfo?.name || "Ferrari Fashion ERP"}</span>
              <span>Print Date: {format(new Date(), "dd-MMM-yyyy hh:mm a")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visible Trigger Button - Direct Print On Click */}
      <Button
        variant="outline"
        onClick={() => handlePrint()}
        className="gap-2 bg-background hover:bg-muted border-border"
      >
        <FiPrinter className="h-4 w-4" />
        <span>Print Employee</span>
      </Button>
    </>
  );
}
