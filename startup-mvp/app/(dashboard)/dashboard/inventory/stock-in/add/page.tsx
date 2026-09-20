"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiSave, FiPackage, FiPlus, FiTrash2, 
  FiCheckCircle, FiInfo, FiUser, FiLayers
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MaterialInwardSource } from "@prisma/client";
import { createStockIn, getStockInFormData } from "../_actions/stock-in.action";

interface RawMaterialRow {
  id: string;
  itemId: string;
  quantity: number | string;
  unit: string;
  notes: string;
}

const UNIT_OPTIONS = [
  "Kg", "Yards", "Meters", "Rolls", "Gross", "Pcs", "Cones", "Dozen", "Packs", "Boxes", "Liters"
];

export default function CreateStockInPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [workOrderId, setWorkOrderId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const [materialRows, setMaterialRows] = useState<RawMaterialRow[]>([
    {
      id: "row-" + Date.now(),
      itemId: "",
      quantity: 1,
      unit: "Kg",
      notes: "",
    }
  ]);

  useEffect(() => {
    async function loadData() {
      setLoadingInit(true);
      const res = await getStockInFormData();
      if (res.success) {
        setWarehouses(res.warehouses || []);
        setWorkOrders(res.workOrders || []);
        setItems(res.items || []);
        setUnits(res.units || []);
        if (res.warehouses && res.warehouses.length > 0) {
          setWarehouseId(res.warehouses[0].id);
        }
        if (res.units && res.units.length > 0) {
          setMaterialRows((prev) =>
            prev.map((r) => ({ ...r, unit: r.unit || res.units[0].symbol }))
          );
        }
      }
      setLoadingInit(false);
    }
    loadData();
  }, []);

  // Filter master items for Raw Materials
  const rawMaterialItems = items.filter((it) => it.itemType === "RAW_MATERIAL");
  
  const selectedWorkOrder = workOrders.find((w) => w.id === workOrderId);
  const orderAssignedMaterials: any[] = selectedWorkOrder?.rawMaterials?.map((rm: any) => rm.item).filter(Boolean) || [];
  
  // If a Work Order with assigned materials is selected, strictly restrict dropdown to those materials!
  const selectableRawMaterials = (selectedWorkOrder && orderAssignedMaterials.length > 0)
    ? orderAssignedMaterials
    : (rawMaterialItems.length > 0 ? rawMaterialItems : items);

  const handleAutoFillAssignedMaterials = () => {
    if (!selectedWorkOrder || orderAssignedMaterials.length === 0) return;
    const rows: RawMaterialRow[] = orderAssignedMaterials.map((it: any, index: number) => ({
      id: "row-" + Date.now() + "-" + index,
      itemId: it.id,
      quantity: 1,
      unit: it.unit?.symbol || "Pcs",
      notes: "",
    }));
    setMaterialRows(rows);
    toast.success(`Loaded ${rows.length} assigned raw materials for ${selectedWorkOrder.orderNo}`);
  };

  const handleAddRow = () => {
    const defaultUnit = units.length > 0 ? units[0].symbol : "Kg";
    setMaterialRows((prev) => [
      ...prev,
      {
        id: "row-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        itemId: "",
        quantity: 1,
        unit: defaultUnit,
        notes: "",
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (materialRows.length === 1) {
      toast.error("At least one raw material item is required.");
      return;
    }
    setMaterialRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowChange = (id: string, field: keyof RawMaterialRow, value: any) => {
    setMaterialRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === "itemId") {
          const selectedItem = items.find((it) => it.id === value);
          if (selectedItem?.unit?.symbol) {
            updated.unit = selectedItem.unit.symbol;
          }
        }
        return updated;
      })
    );
  };

  const totalInwardQty = materialRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!warehouseId) {
      toast.error("Please select a destination warehouse.");
      return;
    }

    const validRows = materialRows.filter((r) => r.itemId && Number(r.quantity) > 0);
    if (validRows.length === 0) {
      toast.error("Please select at least one Raw Material item and enter a valid quantity.");
      return;
    }

    // Duplicate check in material rows
    const itemIds = validRows.map((r) => r.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      toast.error("Duplicate raw material items detected in the list. Please combine them into a single row with the total quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createStockIn({
        source: selectedWorkOrder ? MaterialInwardSource.CLIENT_SUPPLIED : MaterialInwardSource.PURCHASE,
        warehouseId,
        workOrderId: workOrderId || null,
        clientId: selectedWorkOrder?.clientId || null,
        challanNo: challanNo.trim() || null,
        receivedDate: receivedDate ? new Date(receivedDate).toISOString() : null,
        notes: notes.trim() || null,
        items: validRows.map((r) => {
          const itemObj = items.find((it) => it.id === r.itemId);
          return {
            itemId: r.itemId,
            materialName: itemObj?.name || null,
            materialCategory: itemObj?.category?.name || "RAW_MATERIAL",
            quantity: Number(r.quantity),
            unit: r.unit || itemObj?.unit?.symbol || "Pcs",
            notes: r.notes?.trim() || null,
          };
        }),
      });

      if (res.success) {
        toast.success(`Stock Inward (${res.inwardNo}) recorded successfully!`);
        router.push("/dashboard/inventory/stock-in");
      } else {
        toast.error(res.error || "Failed to record stock inward.");
      }
    } catch (error: any) {
      console.error("Create stock in error:", error);
      toast.error("An unexpected error occurred while saving stock in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory/stock-in">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <FiArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <FiPackage className="text-primary" />
              Record Stock In
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Receive raw materials into warehouse inventory against client work orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/inventory/stock-in">
            <Button variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || loadingInit}
            className="gap-2 shadow-sm"
          >
            <FiSave className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Stock In"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Work Order & Warehouse Details */}
        <Card className="bg-white dark:bg-card border shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FiLayers className="text-primary" />
              1. Work Order & Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Work Order Select */}
              <div className="space-y-1.5">
                <Label htmlFor="workOrderId" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Select Work Order (Optional)
                </Label>
                <select
                  id="workOrderId"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  disabled={loadingInit}
                >
                  <option value="">-- General Stock In (No Specific Order) --</option>
                  {workOrders.map((wo) => {
                    const receivedCount = wo.materialsIn?.length || 0;
                    const statusLabel = receivedCount > 0 
                      ? `[Received: ${receivedCount} items]` 
                      : `[Pending Material]`;
                    return (
                      <option key={wo.id} value={wo.id}>
                        {wo.orderNo} {statusLabel} • {wo.item?.name || wo.orderTitle || "Order"} - {wo.client?.name || "Client"}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-muted-foreground">Select an order to link raw materials to its client.</p>
              </div>

              {/* Destination Warehouse */}
              <div className="space-y-1.5">
                <Label htmlFor="warehouseId" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Destination Warehouse / Store <span className="text-red-500">*</span>
                </Label>
                <select
                  id="warehouseId"
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  disabled={loadingInit}
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">Warehouse where raw materials will be stocked.</p>
              </div>
            </div>

            {/* Auto-detected Client Info Box */}
            {selectedWorkOrder && (
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FiUser className="text-primary h-4 w-4" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      Client: {selectedWorkOrder.client?.name || "N/A"}
                    </span>
                    {selectedWorkOrder.client?.phone && (
                      <span className="text-muted-foreground">({selectedWorkOrder.client.phone})</span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    Order No: <strong className="text-foreground">{selectedWorkOrder.orderNo}</strong>
                    {selectedWorkOrder.item?.name && (
                      <> | Product: <strong className="text-foreground">{selectedWorkOrder.item.name}</strong></>
                    )}
                    {selectedWorkOrder.targetQuantity && (
                      <> | Target: <strong className="text-foreground">{selectedWorkOrder.targetQuantity} {selectedWorkOrder.unit || "Pcs"}</strong></>
                    )}
                  </div>
                </div>

                {/* Assigned Materials for this Order */}
                {orderAssignedMaterials.length > 0 ? (
                  <div className="pt-2 border-t border-primary/10 space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                        <FiCheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Assigned Materials for this Order ({orderAssignedMaterials.length}):</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAutoFillAssignedMaterials}
                        className="h-6 text-[11px] gap-1 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium px-2 py-0"
                      >
                        ⚡ Auto-fill Assigned Materials
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {orderAssignedMaterials.map((it: any) => (
                        <span key={it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100/70 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800">
                          {it.name} {it.code ? `(${it.code})` : ""} {it.unit?.symbol ? `• ${it.unit.symbol}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-primary/10 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <FiInfo className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>No specific raw materials were pre-assigned to this order. You can select any raw material from inventory.</span>
                  </div>
                )}

                {/* Existing Materials Inward Alert if any */}
                {selectedWorkOrder.materialsIn && selectedWorkOrder.materialsIn.length > 0 && (
                  <div className="pt-2 border-t border-primary/10 flex items-start gap-2 text-[11px] text-muted-foreground">
                    <FiInfo className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <strong className="font-semibold text-foreground">Previously Received: </strong>
                      <span>
                        {selectedWorkOrder.materialsIn.map((m: any) => `${m.item?.name || m.materialName || 'Material'}: ${m.quantity} ${m.unit}`).join(", ")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Received Date & Challan No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="receivedDate" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Received Date
                </Label>
                <Input
                  id="receivedDate"
                  type="date"
                  className="h-9 text-xs"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="challanNo" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Challan / Gate Pass # (Optional)
                </Label>
                <Input
                  id="challanNo"
                  placeholder="e.g. DC-2026-901"
                  className="h-9 text-xs"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Raw Materials List */}
        <Card className="bg-white dark:bg-card border shadow-xs">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FiPackage className="text-primary" />
                2. Raw Materials List
                {selectedWorkOrder && orderAssignedMaterials.length > 0 && (
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Restricted to {orderAssignedMaterials.length} Assigned Materials
                  </span>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedWorkOrder && orderAssignedMaterials.length > 0
                  ? `Only materials assigned to Order ${selectedWorkOrder.orderNo} are selectable.`
                  : "Select raw material items from inventory and enter inward quantities."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="gap-1.5 text-xs h-8"
            >
              <FiPlus /> Add Raw Material
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b font-semibold text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[280px]">Raw Material Item *</th>
                    <th className="p-3 w-36">Quantity *</th>
                    <th className="p-3 min-w-[180px]">Remarks / Notes</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {materialRows.map((row, idx) => {
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        
                        {/* Raw Material Item Dropdown */}
                        <td className="p-3">
                          <select
                            required
                            className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                            value={row.itemId}
                            onChange={(e) => handleRowChange(row.id, "itemId", e.target.value)}
                          >
                            <option value="">-- Select Raw Material --</option>
                            {selectableRawMaterials.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.code}) {item.category?.name ? `• ${item.category.name}` : ""}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            placeholder="0.00"
                            className="h-8 text-xs font-bold"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.id, "quantity", e.target.value)}
                          />
                        </td>

                        {/* Row Notes */}
                        <td className="p-3">
                          <Input
                            placeholder="Optional note"
                            className="h-8 text-xs text-muted-foreground"
                            value={row.notes || ""}
                            onChange={(e) => handleRowChange(row.id, "notes", e.target.value)}
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="p-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(row.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions & Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="gap-1.5 text-xs"
              >
                <FiPlus /> Add Another Raw Material
              </Button>

              <div className="flex items-center gap-6 text-xs text-gray-700 dark:text-gray-300">
                <span>Total Items: <strong className="text-foreground">{materialRows.length}</strong></span>
                <span>Total Inward Quantity: <strong className="text-primary text-sm font-bold">{totalInwardQty.toLocaleString()}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Notes & Save */}
        <Card className="bg-white dark:bg-card border shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
              3. Inward Remarks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <textarea
              id="notes"
              rows={2}
              className="w-full p-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Received raw materials in store room B..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Link href="/dashboard/inventory/stock-in">
                <Button variant="outline" type="button" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={isSubmitting || loadingInit}
                className="gap-2 px-6 shadow-sm"
              >
                <FiCheckCircle className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Stock In"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
