"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  FiPieChart, 
  FiDownload, 
  FiUsers, 
  FiDollarSign, 
  FiClipboard, 
  FiAlertTriangle, 
  FiAward, 
  FiTrendingUp, 
  FiCheckCircle 
} from "react-icons/fi";
import { getHRDashboardData, HRDashboardData } from "../_actions/dashboard.action";
import { exportExecutiveReportToPDF } from "@/lib/utils/executive-pdf-export";

export default function HRDashboardClient() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  
  // Set default selected month to current month & year
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(today.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(today.getFullYear()));
  const [data, setData] = useState<HRDashboardData | null>(null);

  const fetchDashboardData = () => {
    startTransition(async () => {
      try {
        const res = await getHRDashboardData(parseInt(selectedMonth), parseInt(selectedYear));
        if (res.success && res.data) {
          setData(res.data);
        } else {
          toast({
            variant: "destructive",
            title: "Failed to load dashboard",
            description: res.error || "An unknown error occurred"
          });
        }
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || "Failed to load dashboard metrics"
        });
      }
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedYear]);

  const handleExportPDF = () => {
    if (!data) return;
    try {
      setIsExporting(true);
      exportExecutiveReportToPDF({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        ...data
      });
      toast({
        title: "Report Downloaded",
        description: "HR & Payroll Executive Summary PDF downloaded successfully."
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: err.message || "Failed to export PDF"
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!data) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading dashboard metrics...</p>
      </div>
    );
  }

  const totalShare = data.departmentCosts.reduce((acc, curr) => acc + curr.value, 0) || 1;

  // Circular gauge settings for attendance rate
  const radius = 55;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, data.attendance.averageRate)) / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Controls toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isPending}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date(2000, i, 1);
                const name = date.toLocaleString("default", { month: "long" });
                return (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isPending}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {["2024", "2025", "2026", "2027"].map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="secondary" onClick={fetchDashboardData} disabled={isPending} className="ml-2">
            Refresh
          </Button>
        </div>

        <Button 
          onClick={handleExportPDF} 
          disabled={isPending || isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm w-full sm:w-auto"
        >
          <FiDownload className="mr-2 h-4 w-4" />
          {isExporting ? "Generating PDF..." : "Download Executive Summary"}
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Net Payroll Cost */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Payroll Cost</CardTitle>
            <FiDollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.payroll.totalNetPay.toLocaleString()} BDT</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross: {data.payroll.totalGrossPay.toLocaleString()} BDT
            </p>
          </CardContent>
        </Card>

        {/* Overtime Expenses */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overtime Cost</CardTitle>
            <FiTrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.payroll.totalOTAmount.toLocaleString()} BDT</div>
            <p className="text-xs text-muted-foreground mt-1">
              Hours: {data.attendance.totalOTHours.toFixed(1)} hrs
            </p>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
            <FiClipboard className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.attendance.averageRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Absent: {data.attendance.absentCount} | Leaves: {data.attendance.leaveCount}
            </p>
          </CardContent>
        </Card>

        {/* Headcount Active */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Headcount</CardTitle>
            <FiUsers className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.headcount.totalActive} Employees</div>
            <p className="text-xs text-muted-foreground mt-1">
              New: +{data.headcount.joinedThisMonth} | Resigned: -{data.headcount.resignedThisMonth}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Department-wise Cost Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Department-wise Cost Share</CardTitle>
            <CardDescription>Payroll cost distribution by department name (Current Month).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.departmentCosts.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                No cost records found.
              </div>
            ) : (
              <div className="space-y-4">
                {data.departmentCosts.map((dept) => {
                  const pct = totalShare > 0 ? (dept.value / totalShare) * 100 : 0;
                  return (
                    <div key={dept.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="font-semibold text-foreground">{dept.name}</span>
                        <span className="text-muted-foreground">{dept.value.toLocaleString()} BDT ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Indicators: Attendance & Adjustments */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Operational Health Indicators</CardTitle>
            <CardDescription>Attendance efficiency & adjustment aggregates.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center justify-around gap-6 py-6">
            {/* Radial Gauge for Attendance */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <svg className="w-36 h-36 transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    className="stroke-secondary fill-none"
                    strokeWidth={strokeWidth}
                  />
                  {/* Gauge Ring */}
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    className="stroke-indigo-500 fill-none transition-all duration-1000 ease-out"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-xl font-bold text-foreground">{data.attendance.averageRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Attendance</div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Daily Average Attendance</span>
            </div>

            {/* Adjustments & Deductions Cards */}
            <div className="space-y-4 w-full sm:w-[200px]">
              {/* Bonuses Card */}
              <div className="p-3 border rounded-lg bg-card flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Approved Bonuses</div>
                  <div className="text-lg font-bold text-emerald-600">+{data.adjustments.bonusesTotal.toLocaleString()}</div>
                </div>
                <FiAward className="h-5 w-5 text-emerald-500" />
              </div>

              {/* Fines Card */}
              <div className="p-3 border rounded-lg bg-card flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Approved Fines</div>
                  <div className="text-lg font-bold text-red-500">-{data.adjustments.finesTotal.toLocaleString()}</div>
                </div>
                <FiAlertTriangle className="h-5 w-5 text-red-400" />
              </div>

              {/* Outstanding Loan Balance */}
              <div className="p-3 border rounded-lg bg-card flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Active Loan Balance</div>
                  <div className="text-base font-bold text-foreground">{data.loans.totalOutstanding.toLocaleString()}</div>
                </div>
                <FiCheckCircle className="h-5 w-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
