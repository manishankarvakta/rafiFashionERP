"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FiDownload } from "react-icons/fi";
import { getEfficiencyReport } from "../_actions/production-output.action";

interface EfficiencyReportViewProps {
  fromDate: string;
  toDate: string;
  warehouseId: string;
  permissions: {
    canView: boolean;
  };
}

interface ReportRow {
  employeeId: string;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  totalHours: number;
  totalTarget: number;
  totalPieces: number;
  piecesPerHour: number;
  targetAchievement: number;
  efficiencyRating: string;
}

export default function EfficiencyReportView({
  fromDate,
  toDate,
  warehouseId,
  permissions,
}: EfficiencyReportViewProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportRow[]>([]);

  // Load report data when dates or warehouse changes
  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const res = await getEfficiencyReport(fromDate, toDate, warehouseId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error(res.error || "Failed to load efficiency data");
        setData([]);
      }
      setLoading(false);
    }
    if (permissions.canView) {
      loadReport();
    }
  }, [fromDate, toDate, warehouseId, permissions.canView]);

  // Calculations for stats
  const totalPieces = data.reduce((acc, curr) => acc + curr.totalPieces, 0);
  const totalTarget = data.reduce((acc, curr) => acc + curr.totalTarget, 0);
  const totalHours = data.reduce((acc, curr) => acc + curr.totalHours, 0);
  
  const avgEfficiency = totalHours > 0 ? (totalPieces / totalHours).toFixed(2) : "0.00";
  const avgAchievement = totalTarget > 0 ? ((totalPieces / totalTarget) * 100).toFixed(2) : "0.00";

  // Excel Export
  const handleExportExcel = () => {
    try {
      const exportRows = data.map((item) => ({
        "Code": item.employeeCode,
        "Name": item.name,
        "Department": item.department,
        "Designation": item.designation,
        "Total Hours Worked": item.totalHours,
        "Target Pieces": item.totalTarget,
        "Actual Pieces Produced": item.totalPieces,
        "Avg Pieces/Hour": item.piecesPerHour,
        "Achievement Rate (%)": item.targetAchievement,
        "Rating": item.efficiencyRating,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Efficiency Report");

      // Column widths
      worksheet["!cols"] = [
        { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
        { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 16 }, 
        { wch: 20 }, { wch: 12 }
      ];

      XLSX.writeFile(workbook, `production_efficiency_${fromDate}_to_${toDate}.xlsx`);
      toast.success("Excel spreadsheet downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to export Excel.");
    }
  };

  // PDF Export
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      doc.setFontSize(16);
      doc.text("Employee Production Efficiency & Output Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Period: ${fromDate} to ${toDate}`, 14, 22);

      const tableData = data.map((item) => [
        item.employeeCode,
        item.name,
        item.department,
        `${item.totalHours.toFixed(1)} hrs`,
        item.totalTarget.toString(),
        item.totalPieces.toString(),
        `${item.piecesPerHour.toFixed(2)}/hr`,
        `${item.targetAchievement.toFixed(1)}%`,
        item.efficiencyRating,
      ]);

      autoTable(doc, {
        head: [["Code", "Name", "Department", "Hours", "Target", "Actual", "Rate", "Achievement %", "Rating"]],
        body: tableData,
        startY: 28,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] },
      });

      doc.save(`production_efficiency_${fromDate}_to_${toDate}.pdf`);
      toast.success("PDF report downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to export PDF.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Exporters Toolbar */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={loading || data.length === 0}
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 text-xs h-9"
        >
          <FiDownload />
          Excel Report
        </Button>
        <Button
          variant="outline"
          disabled={loading || data.length === 0}
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 text-xs h-9"
        >
          <FiDownload />
          PDF Report
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Pieces Produced
            </div>
            <div className="text-3xl font-extrabold pt-1">{totalPieces} pcs</div>
            <div className="text-xs text-muted-foreground pt-1">
              across {totalHours.toFixed(1)} active clock hours
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-50/30 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Average Output Rate
            </div>
            <div className="text-3xl font-extrabold pt-1">{avgEfficiency} / hr</div>
            <div className="text-xs text-muted-foreground pt-1">
              pieces per hour floor average
            </div>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30">
          <CardContent className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Target Achievement Rate
            </div>
            <div className="text-3xl font-extrabold pt-1">{avgAchievement}%</div>
            <div className="text-xs text-muted-foreground pt-1">
              against total target of {totalTarget} pcs
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Table */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold pb-4">Efficiency Leaderboard</h2>
          
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Generating report statistics...
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No data records found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[100px]">Code</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Hours Worked</TableHead>
                    <TableHead className="text-center">Target Pieces</TableHead>
                    <TableHead className="text-center">Pieces Produced</TableHead>
                    <TableHead className="text-center">Pieces / Hour</TableHead>
                    <TableHead className="text-center text-blue-600">Achievement Rate</TableHead>
                    <TableHead className="text-center">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.employeeId}>
                      <TableCell className="font-mono text-xs font-semibold">{item.employeeCode}</TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.designation}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.department}</TableCell>
                      <TableCell className="text-center text-sm font-semibold">{item.totalHours.toFixed(1)} hrs</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{item.totalTarget} pcs</TableCell>
                      <TableCell className="text-center text-sm font-semibold">{item.totalPieces} pcs</TableCell>
                      <TableCell className="text-center text-sm font-mono font-bold">
                        <span
                          className={
                            item.piecesPerHour >= 8
                              ? "text-emerald-600"
                              : item.piecesPerHour >= 5
                              ? "text-amber-600"
                              : "text-rose-600"
                          }
                        >
                          {item.piecesPerHour.toFixed(2)}/hr
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm font-mono font-bold">
                        <span
                          className={
                            item.targetAchievement >= 100
                              ? "text-emerald-600"
                              : item.targetAchievement >= 75
                              ? "text-blue-600"
                              : item.targetAchievement >= 50
                              ? "text-amber-600"
                              : "text-rose-600"
                          }
                        >
                          {item.targetAchievement.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.efficiencyRating === "HIGH"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : item.efficiencyRating === "STANDARD"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}
                        >
                          {item.efficiencyRating}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
