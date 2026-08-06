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
import { getTrashedDailyOutputs, restoreDailyOutputs, permanentlyDeleteDailyOutputs } from "../_actions/production-output.action";
import { FiSearch, FiRefreshCw, FiTrash2 } from "react-icons/fi";

interface TrashBinViewProps {
  fromDate: string;
  toDate: string;
  warehouseId: string;
  permissions: {
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

export default function TrashBinView({
  fromDate,
  toDate,
  warehouseId,
  permissions,
}: TrashBinViewProps) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<OutputLog[]>([]);
  
  // Bulk selection checkboxes
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // ConfirmDialog states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  const [confirmVariant, setConfirmVariant] = useState<"default" | "destructive" | "outline">("default");
  const [onConfirmHandler, setOnConfirmHandler] = useState<() => Promise<void>>(() => async () => {});
  const [actionLoading, setActionLoading] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedDesg, setSelectedDesg] = useState("ALL");

  // Load trashed output logs
  const loadData = async () => {
    setLoading(true);
    const res = await getTrashedDailyOutputs(fromDate, toDate, warehouseId);
    if (res.success && res.data) {
      setLogs(res.data as OutputLog[]);
    } else {
      toast.error(res.error || "Failed to load trashed output logs");
      setLogs([]);
    }
    setSelectedLogIds([]); // Clear selection on load
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [fromDate, toDate, warehouseId]);

  // Select single row
  const handleSelectLog = (logId: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  // Select all rows
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = filteredLogs.map((log) => log.id);
      setSelectedLogIds(allFilteredIds);
    } else {
      setSelectedLogIds([]);
    }
  };

  // Trigger restore dialog
  const handleRestoreTrigger = (ids: string[], isBulk: boolean) => {
    setConfirmTitle("Restore daily output log(s)?");
    setConfirmDescription(
      isBulk
        ? `Are you sure you want to restore the selected ${ids.length} output logs to the active dashboard?`
        : "Are you sure you want to restore this output log to the active dashboard?"
    );
    setConfirmVariant("default");
    setOnConfirmHandler(() => async () => {
      setActionLoading(true);
      const res = await restoreDailyOutputs(ids);
      if (res.success) {
        toast.success(isBulk ? `${ids.length} logs restored successfully!` : "Log restored successfully!");
        loadData();
        setConfirmOpen(false);
      } else {
        toast.error(res.error || "Failed to restore logs");
      }
      setActionLoading(false);
    });
    setConfirmOpen(true);
  };

  // Trigger permanent delete dialog
  const handlePermanentDeleteTrigger = (ids: string[], isBulk: boolean) => {
    setConfirmTitle("Permanently delete daily output log(s)?");
    setConfirmDescription(
      isBulk
        ? `Are you sure you want to delete the selected ${ids.length} output logs permanently? This action cannot be undone.`
        : "Are you sure you want to delete this output log permanently? This action cannot be undone."
    );
    setConfirmVariant("destructive");
    setOnConfirmHandler(() => async () => {
      setActionLoading(true);
      const res = await permanentlyDeleteDailyOutputs(ids);
      if (res.success) {
        toast.success(isBulk ? `${ids.length} logs deleted permanently!` : "Log deleted permanently!");
        loadData();
        setConfirmOpen(false);
      } else {
        toast.error(res.error || "Failed to permanently delete logs");
      }
      setActionLoading(false);
    });
    setConfirmOpen(true);
  };

  // Filters setup
  const departments = Array.from(new Set(logs.map((e) => e.department).filter(Boolean)));
  const designations = Array.from(new Set(logs.map((e) => e.designation).filter(Boolean)));

  // Filter logs list
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
            <h2 className="text-lg font-semibold text-rose-600 dark:text-rose-400">Trash Bin - Production Logs</h2>
            <p className="text-xs text-muted-foreground">
              Review, restore, or permanently delete logged targets and achievements from the database.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedLogIds.length > 0 && permissions.canEdit && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleRestoreTrigger(selectedLogIds, true)}
                  className="flex items-center gap-1.5 text-xs h-9"
                >
                  <FiRefreshCw className="h-3.5 w-3.5" />
                  Restore Selected ({selectedLogIds.length})
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handlePermanentDeleteTrigger(selectedLogIds, true)}
                  className="flex items-center gap-1.5 text-xs h-9"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                  Delete Permanently ({selectedLogIds.length})
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-4 rounded-lg border border-border">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px] relative">
            <FiSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trashed logs..."
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
            Loading trashed logs list...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md bg-muted/5">
            Trash bin is empty for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {/* Select All Checkbox */}
                  <TableHead className="w-[45px] text-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      aria-label="Select all trashed logs"
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
                      {/* Checkbox */}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleSelectLog(row.id)}
                          aria-label={`Select log for ${row.name}`}
                        />
                      </TableCell>

                      {/* Date */}
                      <TableCell className="font-mono text-xs text-rose-600/90">{row.date}</TableCell>
                      
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
                        <span>{achievementPct}%</span>
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                        {row.notes}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestoreTrigger([row.id], false)}
                            className="h-7 w-7 p-0"
                            title="Restore"
                          >
                            <FiRefreshCw className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePermanentDeleteTrigger([row.id], false)}
                            className="h-7 w-7 p-0"
                            title="Delete Permanently"
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

        {/* Confirmation Modal */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmTitle}
          description={confirmDescription}
          confirmText={confirmVariant === "destructive" ? "Delete Permanently" : "Restore Log"}
          cancelText="Cancel"
          variant={confirmVariant}
          loading={actionLoading}
          onConfirm={onConfirmHandler}
        />
      </CardContent>
    </Card>
  );
}
