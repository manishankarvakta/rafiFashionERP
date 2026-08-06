"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import DailyBatchEntry from "./daily-batch-entry";
import EfficiencyReportView from "./efficiency-report-view";
import TrashBinView from "./trash-bin-view";

interface ProductionOutputClientProps {
  warehouses: Array<{ id: string; name: string; code: string }>;
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canView: boolean;
  };
}

export default function ProductionOutputClient({
  warehouses,
  permissions,
}: ProductionOutputClientProps) {
  const [activeTab, setActiveTab] = useState("batch-entry");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  
  // Date states
  const todayStr = new Date().toISOString().split("T")[0];
  const [referenceDate, setReferenceDate] = useState<string>(todayStr);
  const [activePreset, setActivePreset] = useState<string>("today");

  // Handler to set quick presets
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    if (preset === "today") {
      setReferenceDate(todayStr);
    }
  };

  // Dynamically compute the date range based on active preset and referenceDate
  let fromDate = referenceDate;
  let toDate = referenceDate;

  if (activePreset === "3days") {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 3);
    fromDate = d.toISOString().split("T")[0];
  } else if (activePreset === "7days") {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString().split("T")[0];
  }

  return (
    <div className="space-y-4 p-1">
      {/* Module Title & Filters Inline Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employee Daily Production Output</h1>
          <p className="text-sm text-muted-foreground">
            Track daily piece outputs, calculate hourly efficiency, and inspect achievement stats.
          </p>
        </div>
        
        {/* Global Toolbar Filters (Single responsive horizontal row) */}
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2.5 rounded-lg border border-border">
          {/* Warehouse Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Warehouse:</span>
            <Select
              value={selectedWarehouseId}
              onValueChange={setSelectedWarehouseId}
            >
              <SelectTrigger className="w-[150px] bg-background text-xs h-8">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Warehouses</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <Button
              variant={activePreset === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("today")}
              className="text-xs h-8 px-2.5"
            >
              Today
            </Button>
            <Button
              variant={activePreset === "3days" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("3days")}
              className="text-xs h-8 px-2.5"
            >
              3 Days
            </Button>
            <Button
              variant={activePreset === "7days" ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset("7days")}
              className="text-xs h-8 px-2.5"
            >
              7 Days
            </Button>
          </div>

          {/* Single Custom Date Picker */}
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Date:</span>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => {
                setReferenceDate(e.target.value);
                setActivePreset("custom");
              }}
              className="flex h-8 w-[130px] rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-[500px] grid-cols-3">
          <TabsTrigger value="batch-entry">Daily Logs</TabsTrigger>
          <TabsTrigger value="analytics">Efficiency Analytics</TabsTrigger>
          <TabsTrigger value="trash-bin">Trash Bin</TabsTrigger>
        </TabsList>
        
        {/* Daily Logs List Tab */}
        <TabsContent value="batch-entry" className="space-y-4 pt-4">
          <DailyBatchEntry
            fromDate={fromDate}
            toDate={toDate}
            warehouseId={selectedWarehouseId}
            permissions={permissions}
          />
        </TabsContent>

        {/* Analytics & Reports Tab */}
        <TabsContent value="analytics" className="space-y-4 pt-4">
          <EfficiencyReportView
            fromDate={fromDate}
            toDate={toDate}
            warehouseId={selectedWarehouseId}
            permissions={permissions}
          />
        </TabsContent>

        {/* Trash Bin Tab */}
        <TabsContent value="trash-bin" className="space-y-4 pt-4">
          <TrashBinView
            fromDate={fromDate}
            toDate={toDate}
            warehouseId={selectedWarehouseId}
            permissions={permissions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
