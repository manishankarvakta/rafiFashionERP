"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getActiveEmployees, saveEmployeeDailyOutput } from "../_actions/production-output.action";

interface Employee {
  id: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  designation: string | null;
}

interface OutputLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    employeeId: string;
    name: string;
    date: string;
    targetProduction: number;
    piecesProduced: number;
    notes: string;
  } | null;
}

export default function OutputLogDialog({
  open,
  onOpenChange,
  onSuccess,
  editData,
}: OutputLogDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const todayStr = new Date().toISOString().split("T")[0];
  const [logDate, setLogDate] = useState(todayStr);
  const [targetPieces, setTargetPieces] = useState<number>(0);
  const [piecesProduced, setPiecesProduced] = useState<number>(0);
  const [notes, setNotes] = useState("");

  // Load employees list on open
  useEffect(() => {
    if (open) {
      async function loadEmployees() {
        setLoadingEmployees(true);
        const res = await getActiveEmployees();
        if (res.success && res.data) {
          setEmployees(res.data);
        } else {
          toast.error("Failed to load active employees list");
        }
        setLoadingEmployees(false);
      }
      loadEmployees();
    }
  }, [open]);

  // Populate data when in edit mode
  useEffect(() => {
    if (open && editData) {
      setSelectedEmployeeId(editData.employeeId);
      setLogDate(editData.date);
      setTargetPieces(editData.targetProduction);
      setPiecesProduced(editData.piecesProduced);
      setNotes(editData.notes || "");
    } else if (open && !editData) {
      // Reset form
      setSelectedEmployeeId("");
      setLogDate(todayStr);
      setTargetPieces(0);
      setPiecesProduced(0);
      setNotes("");
    }
  }, [open, editData]);

  // Convert employee array to options for SearchableSelect
  const employeeOptions = employees.map((emp) => ({
    value: emp.id,
    label: emp.name,
    description: `${emp.employeeCode || "N/A"} - ${emp.department || "No Dept"}`
  }));

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    if (!logDate) {
      toast.error("Please select a date");
      return;
    }

    setSaving(true);
    const res = await saveEmployeeDailyOutput(
      selectedEmployeeId,
      Number(targetPieces) || 0,
      Number(piecesProduced) || 0,
      notes || null,
      logDate
    );

    if (res.success) {
      toast.success(editData ? "Log updated successfully!" : "Log added successfully!");
      onSuccess();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Failed to save daily output log");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {editData ? "Edit Output Log" : "Add Output Log"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Employee Selector & Search */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Select Employee <span className="text-rose-500">*</span>
              </label>
              
              {editData ? (
                <Input value={editData.name} disabled className="bg-muted h-9 text-sm" />
              ) : (
                <SearchableSelect
                  options={employeeOptions}
                  value={selectedEmployeeId}
                  onValueChange={(val) => setSelectedEmployeeId(val || "")}
                  placeholder="-- Choose Employee --"
                  searchPlaceholder="Type name or code to search..."
                  emptyMessage="No matching employees found."
                  disabled={loadingEmployees}
                />
              )}
            </div>

            {/* Log Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Log Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={logDate}
                disabled={editData !== null}
                onChange={(e) => setLogDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:bg-muted disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* Target Production & Pieces Produced Inline Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Target Production */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Target Production
                </label>
                <Input
                  type="number"
                  min="0"
                  value={targetPieces || ""}
                  onChange={(e) => setTargetPieces(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 50"
                />
              </div>

              {/* Pieces Produced */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Pieces Produced
                </label>
                <Input
                  type="number"
                  min="0"
                  value={piecesProduced || ""}
                  onChange={(e) => setPiecesProduced(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="e.g. 48"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Notes / Remarks
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. machine maintenance delay"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
