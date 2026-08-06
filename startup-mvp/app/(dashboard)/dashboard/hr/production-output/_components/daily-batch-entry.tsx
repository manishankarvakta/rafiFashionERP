"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { getDailyOutputsList, deleteDailyOutput, trashDailyOutputs } from "../_actions/production-output.action";
import { FiSearch, FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import OutputLogDialog from "./output-log-dialog";

interface DailyBatchEntryProps {
  fromDate: string;
  toDate: string;
  warehouseId: string;
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
  };
}

interface OutputLog {
  id: string;
  employeeId: string;
  name: string;
  employeeCode: string;
  department: string;
  designation: string;
  biometricDeviceId: string;
  date: string;
  workHours: number;
  attendanceStatus: string;
  targetProduction: number;
  piecesProduced: number;
  notes: string;
}

export default function DailyBatchEntry({
  fromDate,
  toDate,
  warehouseId,
  permissions,
}: DailyBatchEntryProps) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<OutputLog[]>([]);
  
  // Dialog/Modal states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLogData, setEditLogData] = useState<any>(null);

  // Bulk options checkbox state
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // ConfirmDialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [onConfirmHandler, setOnConfirmHandler] = useState<() => Promise<void>>(() => async () => {});
  const [actionLoading, setActionLoading] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedDesg, setSelectedDesg] = useState("ALL");

  // 1. Load output logs list
  const loadData = async () => {
    setLoading(true);
    const res = await getDailyOutputsList(fromDate, toDate, warehouseId);
    if (res.success && res.data) {
      setLogs(res.data as OutputLog[]);
    } else {
      toast.error(res.error || "Failed to load output logs");
      setLogs([]);
    }
    setSelectedLogIds([]); // Reset selections on reload
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, warehouseId]);

  // 2. Select/Deselect single checkbox
  const handleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  // 3. Select/Deselect all checkboxes
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = filteredLogs.map((log) => log.id);
      setSelectedLogIds(allFilteredIds);
    } else {
      setSelectedLogIds([]);
    }
  };

  // 4. Trigger single log deletion popup
  const handleDeleteLogTrigger = (logId: string, name: string, date: string) => {
    setConfirmTitle("Move output log to trash?");
    setConfirmDescription(`Are you sure you want to move the output log of ${name} on ${date} to trash?`);
    setOnConfirmHandler(() => async () => {
      setActionLoading(true);
      const res = await deleteDailyOutput(logId);
      if (res.success) {
        toast.success("Daily output log moved to trash successfully!");
        setSelectedLogIds((prev) => prev.filter((id) => id !== logId));
        loadData();
        setConfirmOpen(false);
      } else {
        toast.error(res.error || "Failed to move log to trash");
      }
      setActionLoading(false);
    });
    setConfirmOpen(true);
  };

  // 5. Trigger bulk deletion popup
  const handleBulkDeleteTrigger = () => {
    setConfirmTitle("Move selected logs to trash?");
    setConfirmDescription(`Are you sure you want to move the selected ${selectedLogIds.length} logs to trash?`);
    setOnConfirmHandler(() => async () => {
      setActionLoading(true);
      const res = await trashDailyOutputs(selectedLogIds);
      if (res.success) {
        toast.success(`${selectedLogIds.length} logs moved to trash successfully!`);
        setSelectedLogIds([]);
        loadData();
        setConfirmOpen(false);
      } else {
        toast.error(res.error || "Failed to move logs to trash");
      }
      setActionLoading(false);
    });
    setConfirmOpen(true);
  };

  // 6. Extract unique departments and designations for filters
  const departments = Array.from(new Set(logs.map((e) => e.department).filter(Boolean)));
  const designations = Array.from(new Set(logs.map((e) => e.designation).filter(Boolean)));

  // 7. Apply Search & Filters
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.biometricDeviceId && log.biometricDeviceId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = selectedDept === "ALL" || log.department === selectedDept;
    const matchesDesg = selectedDesg === "ALL" || log.designation === selectedDesg;

    return matchesSearch && matchesDept && matchesDesg;
  });

  const isAllSelected = filteredLogs.length > 0 && filteredLogs.every((log) => selectedLogIds.includes(log.id));

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Production Log List</h2>
            <p className="text-xs text-muted-foreground">
              Shows all daily piece targets and achievements logged within the selected date range.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Bulk Deletion Trigger */}
            {selectedLogIds.length > 0 && permissions.canEdit && (
              <Button
                variant="destructive"
                onClick={handleBulkDeleteTrigger}
                className="flex items-center gap-1.5 text-xs h-9"
              >
                <FiTrash2 className="h-3.5 w-3.5" />
                Move Selected ({selectedLogIds.length}) to Trash
              </Button>
            )}

            {permissions.canCreate && (
              <Button
                onClick={() => {
                  setEditLogData(null);
                  setDialogOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs h-9"
              >
                <FiPlus className="h-4 w-4" />
                Add Output Log
              </Button>
            )}
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-4 rounded-lg border border-border">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px] relative">
            <FiSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Name, Code or Biometric ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Dept:</span>
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-[150px] bg-background">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Designation Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Designation:</span>
            <Select value={selectedDesg} onValueChange={setSelectedDesg}>
              <SelectTrigger className="w-[160px] bg-background">
                <SelectValue placeholder="All Designations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Designations</SelectItem>
                {designations.map((desg) => (
                  <SelectItem key={desg} value={desg}>
                    {desg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading logged outputs list...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md bg-muted/5">
            No daily outputs logged within the selected filters and date range.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {/* Select All Checkbox Column */}
                  <TableHead className="w-[45px] text-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all logs"
                    />
                  </TableHead>
                  <TableHead className="w-[110px]">Log Date</TableHead>
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead className="w-[180px]">Employee Name</TableHead>
                  <TableHead className="w-[120px]">Department</TableHead>
                  <TableHead className="w-[100px] text-center">Work Hours</TableHead>
                  <TableHead className="w-[110px] text-center">Attendance</TableHead>
                  <TableHead className="w-[120px] text-center">Target Pieces</TableHead>
                  <TableHead className="w-[120px] text-center">Pieces Produced</TableHead>
                  <TableHead className="w-[100px] text-center font-semibold text-blue-600">% Achieved</TableHead>
                  <TableHead className="w-[180px]">Notes</TableHead>
                  <TableHead className="w-[120px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((row) => {
                  const isAbsent = row.attendanceStatus === "ABSENT";
                  const isChecked = selectedLogIds.includes(row.id);
                  
                  // Target Achievement calculation
                  const achievementPct =
                    row.targetProduction > 0
                      ? ((row.piecesProduced / row.targetProduction) * 100).toFixed(0)
                      : "0";

                  return (
                    <TableRow
                      key={row.id}
                      className={isChecked ? "bg-muted/40" : ""}
                    >
                      {/* Row Checkbox Column */}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleSelectLog(row.id)}
                          aria-label={`Select log for ${row.name}`}
                        />
                      </TableCell>

                      {/* Date */}
                      <TableCell className="font-mono text-xs">{row.date}</TableCell>
                      
                      {/* Code */}
                      <TableCell className="font-mono text-xs font-semibold">{row.employeeCode}</TableCell>
                      
                      {/* Name */}
                      <TableCell>
                        <div className="font-medium text-sm">{row.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.designation}
                        </div>
                      </TableCell>

                      {/* Department */}
                      <TableCell className="text-xs text-muted-foreground">
                        {row.department}
                      </TableCell>

                      {/* Work Hours */}
                      <TableCell className="text-center font-semibold text-sm">
                        {row.workHours} hrs
                      </TableCell>

                      {/* Attendance Badge */}
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isAbsent
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
                          }`}
                        >
                          {row.attendanceStatus}
                        </span>
                      </TableCell>

                      {/* Target Pieces */}
                      <TableCell className="text-center font-semibold text-sm">
                        {row.targetProduction} pcs
                      </TableCell>

                      {/* Produced Pieces */}
                      <TableCell className="text-center font-semibold text-sm">
                        {row.piecesProduced} pcs
                      </TableCell>

                      {/* Pct Achieved */}
                      <TableCell className="text-center font-mono font-bold text-sm">
                        <span
                          className={
                            Number(achievementPct) >= 100
                              ? "text-emerald-600"
                              : Number(achievementPct) >= 75
                              ? "text-blue-600"
                              : Number(achievementPct) >= 50
                              ? "text-amber-600"
                              : "text-rose-600"
                          }
                        >
                          {achievementPct}%
                        </span>
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {row.notes}
                      </TableCell>

                      {/* Action buttons */}
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditLogData(row);
                              setDialogOpen(true);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <FiEdit2 className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLogTrigger(row.id, row.name, row.date)}
                            className="h-7 w-7 p-0"
                          >
                            <FiTrash2 className="h-3.5 w-3.5 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add/Edit Modal Wrapper */}
        <OutputLogDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={loadData}
          editData={editLogData}
        />

        {/* Styled Popup Confirmation Modal */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmTitle}
          description={confirmDescription}
          confirmText="Move to Trash"
          cancelText="Cancel"
          variant="destructive"
          loading={actionLoading}
          onConfirm={onConfirmHandler}
        />
      </CardContent>
    </Card>
  );
}
