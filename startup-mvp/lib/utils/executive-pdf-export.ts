import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface ExportPDFData {
  month: number;
  year: number;
  headcount: {
    totalActive: number;
    joinedThisMonth: number;
    resignedThisMonth: number;
  };
  payroll: {
    generated: boolean;
    status: string;
    totalBasic: number;
    totalOTAmount: number;
    totalBonus: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    totalTiffinAllowance: number;
    totalNightAllowance: number;
    totalHolidayAllowance: number;
  };
  attendance: {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    totalOTHours: number;
    averageRate: number;
  };
  loans: {
    activeLoansCount: number;
    totalOutstanding: number;
  };
  adjustments: {
    finesTotal: number;
    bonusesTotal: number;
  };
  departmentCosts: Array<{ name: string; value: number }>;
}

export function exportExecutiveReportToPDF(data: ExportPDFData) {
  const doc = new jsPDF("p", "mm", "a4");
  const monthName = format(new Date(data.year, data.month - 1, 1), "MMMM");
  const reportDate = format(new Date(), "dd-MMM-yyyy hh:mm a");

  // Branded Header Colors
  const primaryColor = [16, 185, 129]; // Emerald Green
  const textColor = [31, 41, 55]; // Gray-800
  const subTextColor = [107, 114, 128]; // Gray-500

  // -------------------------------------------------------------
  // PAGE 1: COVER PAGE & EXECUTIVE SUMMARY
  // -------------------------------------------------------------
  
  // Decorative Header Bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 15, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("HR & PAYROLL EXECUTIVE REPORT", 15, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
  doc.text(`Reporting Period: ${monthName} ${data.year}`, 15, 43);
  doc.text(`Generated On: ${reportDate}`, 15, 49);

  // Line Separator
  doc.setDrawColor(229, 231, 235);
  doc.line(15, 55, 195, 55);

  // SECTION 1: EXECUTIVE SUMMARY SUMMARY CARDS
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("1. Executive Summary KPIs", 15, 68);

  // Summary KPI Table
  const kpiRows = [
    ["Total Active Workforce", `${data.headcount.totalActive} Employees`, "Average Attendance Rate", `${data.attendance.averageRate.toFixed(1)}%`],
    ["Joined This Month", `${data.headcount.joinedThisMonth} New Joins`, "Total Resigned / Released", `${data.headcount.resignedThisMonth} Employees`],
    ["Total Gross Payroll", `${data.payroll.totalGrossPay.toLocaleString()} BDT`, "Total Net Disbursements", `${data.payroll.totalNetPay.toLocaleString()} BDT`],
    ["Overtime (OT) Expenses", `${data.payroll.totalOTAmount.toLocaleString()} BDT`, "Total Overtime Hours worked", `${data.attendance.totalOTHours.toFixed(1)} Hours`],
    ["Active Loans Outstanding", `${data.loans.totalOutstanding.toLocaleString()} BDT`, "Active Advances / Loans count", `${data.loans.activeLoansCount} Active Loans`]
  ];

  autoTable(doc, {
    startY: 74,
    head: [["Financial KPIs", "Value", "Operational KPIs", "Value"]],
    body: kpiRows,
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { fontStyle: "bold", cellWidth: 50 },
      3: { cellWidth: 40 }
    }
  });

  // Brief highlights section
  const currentY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Key Monthly Highlights:", 15, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const highlights = [
    `* Overall payroll disbursement net total stands at ${data.payroll.totalNetPay.toLocaleString()} BDT.`,
    `* Employees completed a total of ${data.attendance.totalOTHours.toFixed(1)} Overtime Hours, resulting in a total OT expense of ${data.payroll.totalOTAmount.toLocaleString()} BDT.`,
    `* Average workforce attendance rate reached ${data.attendance.averageRate.toFixed(1)}% this month.`,
    `* Employee headcount consists of ${data.headcount.totalActive} active profiles. There were ${data.headcount.joinedThisMonth} new joins and ${data.headcount.resignedThisMonth} approved resignations.`
  ];

  let textY = currentY + 6;
  highlights.forEach((line) => {
    doc.text(line, 15, textY);
    textY += 6;
  });

  // Footer on Page 1
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
  doc.text("Rafi Fashion ERP - Confidential Executive Report", 15, 285);
  doc.text("Page 1 of 2", 185, 285);

  // -------------------------------------------------------------
  // PAGE 2: DEPARTMENT COSTS & DETAILED ALLOWANCES
  // -------------------------------------------------------------
  doc.addPage();

  // Decorative Header Bar (Page 2)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 15, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("2. Department-wise Cost Distribution", 15, 28);

  const deptHeaders = [["Department Name", "Disbursed Share (BDT)", "Percentage (%)"]];
  const totalShare = data.departmentCosts.reduce((acc, curr) => acc + curr.value, 0) || 1;
  
  const deptRows = data.departmentCosts.map((d) => [
    d.name,
    `${d.value.toLocaleString()} BDT`,
    `${((d.value / totalShare) * 100).toFixed(1)}%`
  ]);

  if (deptRows.length === 0) {
    deptRows.push(["No records found", "0 BDT", "0%"]);
  }

  autoTable(doc, {
    startY: 33,
    head: deptHeaders,
    body: deptRows,
    theme: "grid",
    headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 3 }
  });

  // SECTION 3: PAYROLL ALLOWANCES AND ADJUSTMENTS
  const nextY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text("3. Allowances & Adjustments Breakdown", 15, nextY);

  const allowanceRows = [
    ["Basic Salary Sum", `${data.payroll.totalBasic.toLocaleString()} BDT`, "Late Arrival Deductions", `${data.payroll.totalDeductions.toLocaleString()} BDT`],
    ["Tiffin Allowance", `${data.payroll.totalTiffinAllowance.toLocaleString()} BDT`, "Total Fines Recovered", `${data.adjustments.finesTotal.toLocaleString()} BDT`],
    ["Night Shift Allowance", `${data.payroll.totalNightAllowance.toLocaleString()} BDT`, "Total Approved Bonuses", `${data.adjustments.bonusesTotal.toLocaleString()} BDT`],
    ["Holiday Allowance", `${data.payroll.totalHolidayAllowance.toLocaleString()} BDT`, "Active Loan Deductions", `${data.payroll.totalDeductions.toLocaleString()} BDT`]
  ];

  autoTable(doc, {
    startY: nextY + 5,
    head: [["Allowance Component", "Total Amount", "Adjustment/Deduction", "Total Amount"]],
    body: allowanceRows,
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // Verification & Signatures Block
  const sigY = (doc as any).lastAutoTable.finalY + 25;
  
  doc.setDrawColor(200, 200, 200);
  doc.line(20, sigY, 70, sigY);
  doc.line(140, sigY, 190, sigY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text("Prepared By (HR Manager)", 20, sigY + 5);
  doc.text("Approved By (MD / CEO)", 140, sigY + 5);

  // Footer on Page 2
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(subTextColor[0], subTextColor[1], subTextColor[2]);
  doc.text("Rafi Fashion ERP - Confidential Executive Report", 15, 285);
  doc.text("Page 2 of 2", 185, 285);

  // Save the PDF
  doc.save(`executive-summary-report-${monthName}-${data.year}.pdf`);
}
