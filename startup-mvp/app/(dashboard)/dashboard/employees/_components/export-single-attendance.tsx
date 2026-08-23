"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiDownload, FiFileText, FiFile, FiX } from "react-icons/fi";
import { getSingleEmployeeAttendanceForExport } from "../_actions/export.action";
import { exportToCSV } from "@/lib/utils/export-csv";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportSingleAttendanceProps {
  employeeId: string;
  employeeName: string;
}

export default function ExportSingleAttendance({
  employeeId,
  employeeName,
}: ExportSingleAttendanceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Set default date range: first day of current month to today
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [fromDate, setFromDate] = useState(firstDay.toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);

  const handleExport = async (formatType: "csv" | "pdf") => {
    try {
      setLoading(true);
      const res = await getSingleEmployeeAttendanceForExport(employeeId, fromDate, toDate);

      if (!res.success || !res.employee || !res.attendances) {
        throw new Error(res.error || "Failed to fetch attendance records");
      }

      const emp = res.employee;
      const attendances = res.attendances;
      const weekends = res.weekends || [0, 6];

      // Check if employee's shift supports breaks
      const hasBreaks = !!(emp.shift && emp.shift.breakType !== "NONE" && emp.shift.breakDuration > 0);

      // Helper: Format decimal hours to HH:MM format
      const formatDecimalToHHMM = (decimalHours: number) => {
        if (decimalHours <= 0) return "00:00";
        const h = Math.floor(decimalHours);
        const m = Math.round((decimalHours - h) * 60);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      // Helper: Calculate tenure (years, months, days)
      const calculateTenureString = (joinDateStr: string | null, reportEndDateStr: string) => {
        if (!joinDateStr) return "N/A";
        try {
          const joinDate = new Date(joinDateStr);
          const endDate = new Date(reportEndDateStr);
          let years = endDate.getFullYear() - joinDate.getFullYear();
          let months = endDate.getMonth() - joinDate.getMonth();
          let days = endDate.getDate() - joinDate.getDate();

          if (days < 0) {
            months -= 1;
            const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
            days += prevMonth.getDate();
          }
          if (months < 0) {
            years -= 1;
            months += 12;
          }
          
          const joinYear = joinDate.getFullYear();
          const joinMonth = String(joinDate.getMonth() + 1).padStart(2, "0");
          const joinDay = String(joinDate.getDate()).padStart(2, "0");
          const formattedJoinDate = `${joinDay}/${joinMonth}/${joinYear}`;

          return `${formattedJoinDate} (${years}y ${months}m ${days}d)`;
        } catch (e) {
          return "N/A";
        }
      };

      // Generate all dates in range
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const datesList: Date[] = [];
      const temp = new Date(start);

      while (temp <= end) {
        datesList.push(new Date(temp));
        temp.setDate(temp.getDate() + 1);
      }

      // Map attendances for lookup
      const attMap: Record<string, any> = {};
      attendances.forEach((att: any) => {
        const dStr = att.date.split("T")[0];
        attMap[dStr] = att;
      });

      // Format helpers
      const getLocalDateString = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const getDayName = (d: Date) => {
        return d.toLocaleDateString("en-US", { weekday: "long" });
      };

      const formatTime = (isoString: string | null) => {
        if (!isoString) return "--:--";
        const dateObj = new Date(isoString);
        return dateObj.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Dhaka",
        });
      };

      // Compile rows and statistics
      let totalWorkHrs = 0;
      let totalOtHrs = 0;
      let totalLateMins = 0;
      let totalBreakLateMins = 0;

      let presentDays = 0;
      let absentDays = 0;
      let weekendDays = 0;
      let leaveDays = 0;
      let holidayDays = 0;

      let delayDaysCount = 0;
      let oneTimePunchedCount = 0;
      let weeklyDaysPresent = 0;
      let holidayPresent = 0;
      let paidLeaveCount = 0;
      let unpaidLeaveCount = 0;

      const rows = datesList.map((d) => {
        const dStr = getLocalDateString(d);
        const dayName = getDayName(d);
        const att = attMap[dStr];

        let status = "";
        let checkInStr = "--:--";
        let checkOutStr = "--:--";
        let breakOutStr = "--:--";
        let breakInStr = "--:--";
        let workHrs = 0;
        let otHrs = 0;
        let lateMins = 0;
        let breakLateMins = 0;
        let remarks = "";

        const isWeekendFallback = weekends.includes(d.getDay());

        if (att) {
          status = att.status;
          workHrs = att.workHours || 0;
          otHrs = att.otHours || 0;
          lateMins = att.lateMinutes || 0;
          breakLateMins = att.breakLateMinutes || 0;
          checkInStr = formatTime(att.checkIn);
          checkOutStr = formatTime(att.checkOut);
          breakOutStr = formatTime(att.breakCheckOut);
          breakInStr = formatTime(att.breakCheckIn);

          if (lateMins > 0) delayDaysCount++;

          // Check for single punches (Onetime Punched)
          const hasIn = !!att.checkIn;
          const hasOut = !!att.checkOut;
          if ((hasIn && !hasOut) || (!hasIn && hasOut)) {
            oneTimePunchedCount++;
          }

          if (status === "WEEKEND") {
            weekendDays++;
            remarks = "Weekend";
            if (hasIn) weeklyDaysPresent++;
          } else if (status === "ABSENT") {
            absentDays++;
          } else if (status === "LEAVE") {
            leaveDays++;
            remarks = "Leave";
            if (att.leavePaidStatus === true) {
              paidLeaveCount++;
            } else {
              unpaidLeaveCount++;
            }
          } else if (status === "HOLIDAY") {
            holidayDays++;
            remarks = "Holiday";
            if (hasIn) holidayPresent++;
          } else {
            presentDays++;
            if (isWeekendFallback && hasIn) weeklyDaysPresent++;
          }
        } else {
          if (isWeekendFallback) {
            status = "WEEKEND";
            remarks = "Weekend";
            weekendDays++;
          } else {
            status = "N/A";
          }
        }

        totalWorkHrs += workHrs;
        totalOtHrs += otHrs;
        totalLateMins += lateMins;
        totalBreakLateMins += breakLateMins;

        // Shift string representation
        let shiftWindow = "--";
        if (emp.shift?.startTime && emp.shift?.endTime) {
          shiftWindow = `${emp.shift.startTime}-${emp.shift.endTime}`;
        }

        return {
          date: dStr,
          day: dayName,
          status,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          breakOut: breakOutStr,
          breakIn: breakInStr,
          workHours: workHrs,
          otHours: otHrs,
          lateMinutes: lateMins,
          breakLateMinutes: breakLateMins,
          shift: shiftWindow,
          group: emp.shift?.name || "General",
          remarks
        };
      });

      if (formatType === "csv") {
        // CSV Export
        const dataToExport = rows.map((r) => {
          return {
            Date: r.date,
            Day: r.day,
            Status: r.status,
            In: r.checkIn,
            Out: r.checkOut,
            Delay: r.lateMinutes,
            Regular: formatDecimalToHHMM(r.workHours),
            NOT: formatDecimalToHHMM(r.otHours),
            EOT: formatDecimalToHHMM(r.workHours + r.otHours),
            Shift: r.shift,
            Group: r.group,
            Remarks: r.remarks,
          };
        });

        // Append totals row
        const totalsRow: any = {
          Date: "TOTALS / SUMMARY",
          Day: `Present: ${presentDays} | Absent: ${absentDays} | Leave: ${leaveDays} (LWP: ${unpaidLeaveCount}/L: ${paidLeaveCount})`,
          Status: `Weekend: ${weekendDays} | Holiday: ${holidayDays}`,
          In: `Delay Days: ${delayDaysCount}`,
          Out: `Onetime Punch: ${oneTimePunchedCount}`,
          Delay: totalLateMins,
          Regular: formatDecimalToHHMM(totalWorkHrs),
          NOT: formatDecimalToHHMM(totalOtHrs),
          EOT: formatDecimalToHHMM(totalWorkHrs + totalOtHrs),
          Shift: "",
          Group: "",
          Remarks: `WE Present: ${weeklyDaysPresent} | Hol Present: ${holidayPresent}`,
        };
        dataToExport.push(totalsRow);

        exportToCSV(dataToExport, { filename: `jobcard_${emp.employeeCode || emp.name}.csv` });
        toast({ title: "Success", description: "Job Card CSV downloaded successfully" });
      } else {
        // PDF Export - Optimized for A4 Portrait single page fit (Width: 210mm, Height: 297mm)
        const doc = new jsPDF("portrait");

        // Branded Header Title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("JOB CARD REPORT", 10, 12);

        // Meta box info
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.text(`ID           :  ${emp.employeeCode || "N/A"}`, 10, 20);
        doc.text(`Name         :  ${emp.name}`, 10, 24);
        doc.text(`Designation  :  ${emp.designation || "N/A"}`, 10, 28);
        doc.text(`Department   :  ${emp.department}`, 10, 32);

        doc.text(`Section      :  ${emp.section || "N/A"}`, 85, 20);
        doc.text(`Date of Join :  ${calculateTenureString(emp.joiningDate, toDate)}`, 85, 24);

        doc.text(`Report Period:  ${fromDate} to ${toDate}`, 142, 20);
        doc.text(`Printed On   :  ${new Date().toLocaleDateString()}`, 142, 24);

        // AutoTable body data (No Break Out / Break In columns)
        const tableData = rows.map((r) => {
          return [
            r.date,
            r.day.slice(0, 3),
            r.status,
            r.checkIn,
            r.checkOut,
            r.lateMinutes > 0 ? String(r.lateMinutes) : "0",
            formatDecimalToHHMM(r.workHours),
            formatDecimalToHHMM(r.otHours),
            formatDecimalToHHMM(r.workHours + r.otHours),
            r.shift,
            r.remarks || "--",
          ];
        });

        const headers = ["Date", "Day", "Status", "In", "Out", "Delay", "Regular", "NOT", "EOT", "Shift", "Remarks"];

        autoTable(doc, {
          startY: 35,
          head: [headers],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [30, 41, 59], textColor: 255 },
          styles: { fontSize: 7, cellPadding: 1.2 },
          margin: { left: 10, right: 10 },
        });

        // Summary box after table with single page safety check
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const requiredSpace = 55;
        let finalY = (doc as any).lastAutoTable.finalY + 5;

        // Force onto next page only if it overflows the absolute physical page limit
        if (finalY + requiredSpace > pageHeight - 12) {
          doc.addPage();
          finalY = 15;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Summary statistics:", 10, finalY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        
        // Column 1 (Left X: 10)
        doc.text(`Total Days   : ${datesList.length}`, 10, finalY + 5);
        doc.text(`Present Days : ${presentDays}`, 10, finalY + 9);
        doc.text(`Absent Days  : ${absentDays}`, 10, finalY + 13);
        doc.text(`Weekly Days  : ${weekendDays}`, 10, finalY + 17);
        doc.text(`Holidays     : ${holidayDays}`, 10, finalY + 21);

        // Column 2 (Middle X: 75)
        doc.text(`Delay in Days  : ${delayDaysCount}`, 75, finalY + 5);
        doc.text(`Onetime Punch  : ${oneTimePunchedCount}`, 75, finalY + 9);
        doc.text(`Half Days      : ${rows.filter(r => r.status === "HALF_DAY").length}`, 75, finalY + 13);
        doc.text(`Weekly Present : ${weeklyDaysPresent}`, 75, finalY + 17);
        doc.text(`Holiday Present: ${holidayPresent}`, 75, finalY + 21);

        // Column 3 (Right X: 140)
        doc.text(`Leave Days     : ${leaveDays} (LWP: ${unpaidLeaveCount}/L: ${paidLeaveCount})`, 140, finalY + 5);
        doc.text(`Total Regular  : ${formatDecimalToHHMM(totalWorkHrs)}`, 140, finalY + 9);
        doc.text(`Total NOT Hours: ${formatDecimalToHHMM(totalOtHrs)}`, 140, finalY + 13);
        doc.text(`Total EOT Hours: ${formatDecimalToHHMM(totalWorkHrs + totalOtHrs)}`, 140, finalY + 17);

        // Sign off section (Optimized Y padding)
        const sigLineLength = 45;
        const authSigX = 150;
        doc.line(10, finalY + 34, 10 + sigLineLength, finalY + 34);
        doc.text("Employee Signature", 10, finalY + 38);

        doc.line(authSigX, finalY + 34, authSigX + sigLineLength, finalY + 34);
        doc.text("Authorized Signature", authSigX, finalY + 38);

        doc.save(`jobcard_${emp.employeeCode || emp.name}.pdf`);
        toast({ title: "Success", description: "Job Card PDF downloaded successfully" });
      }
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Something went wrong while exporting.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30 text-primary bg-primary/5 hover:bg-primary/10">
          <FiDownload className="mr-2 h-4 w-4" />
          Export Attendance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Attendance Sheet</DialogTitle>
          <DialogDescription>
            Select the date range and format to export the attendance details for <strong>{employeeName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="single-from-date" className="text-right">
              From Date
            </Label>
            <Input
              id="single-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="single-to-date" className="text-right">
              To Date
            </Label>
            <Input
              id="single-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 mt-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={loading}
            className="flex items-center gap-1"
          >
            <FiX className="h-4 w-4" />
            Cancel
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => handleExport("csv")}
              className="flex items-center gap-1"
            >
              <FiFileText className="h-4 w-4" />
              CSV
            </Button>
            <Button
              disabled={loading}
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-1"
            >
              <FiFile className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
