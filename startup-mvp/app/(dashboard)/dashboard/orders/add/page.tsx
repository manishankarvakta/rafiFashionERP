"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiSave, FiLayers, FiUser, FiPackage, FiInfo, FiCheckCircle, FiPlus, FiTrash2
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { createBatchWorkOrders, getClientsAndItemsForSelect } from "../_actions/work-order.action";
import { QuickCreateReadyProductModal } from "../_components/quick-create-ready-product-modal";

interface OrderItemRow {
  id: string;
  itemId: string;
  orderTitle?: string;
  styleNo?: string;
  quantity: string | number;
  unitPrice: string | number;
  unit?: string;
  notes?: string;
}

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Create Modal State
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [targetRowIdForNewProduct, setTargetRowIdForNewProduct] = useState<string | null>(null);

  // Form State
  const [clientId, setClientId] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  const [orderRows, setOrderRows] = useState<OrderItemRow[]>([
    {
      id: "row-" + Date.now(),
      itemId: "",
      quantity: "",
      unitPrice: "",
      unit: "Pcs",
      notes: "",
    }
  ]);

  useEffect(() => {
    async function loadData() {
      setLoadingInit(true);
      const res = await getClientsAndItemsForSelect();
      if (res.success) {
        setClients(res.clients || []);
        setItems(res.items || []);
      }
      setLoadingInit(false);
    }
    loadData();
  }, []);

  // Filter items to show only Ready Products
  const readyProductItems = items.filter((it) => it.itemType === "READY_PRODUCT");
  // Fallback to all items if no item is marked specifically as READY_PRODUCT yet
  const selectableProducts = readyProductItems.length > 0 ? readyProductItems : items;

  const selectedClient = clients.find((c) => c.id === clientId);

  const handleAddRow = () => {
    setOrderRows((prev) => [
      ...prev,
      {
        id: "row-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        itemId: "",
        quantity: "",
        unitPrice: "",
        unit: "Pcs",
        notes: "",
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (orderRows.length === 1) {
      toast.error("At least one product item is required.");
      return;
    }
    setOrderRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowChange = (id: string, field: keyof OrderItemRow, value: any) => {
    setOrderRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === "itemId") {
          const selectedItem = items.find((it) => it.id === value);
          if (selectedItem?.unit?.symbol) {
            updated.unit = selectedItem.unit.symbol;
          }
          if (selectedItem?.name && !updated.orderTitle) {
            updated.orderTitle = selectedItem.name;
          }
          if (selectedItem) {
            const defaultPrice = Number(selectedItem.costPrice || selectedItem.salesPrice || 0);
            if (defaultPrice > 0 && (!row.unitPrice || Number(row.unitPrice) === 0)) {
              updated.unitPrice = defaultPrice;
            }
          }
        }
        return updated;
      })
    );
  };

  const handleProductCreated = (newItem: any) => {
    setItems((prev) => {
      if (prev.some((it) => it.id === newItem.id)) return prev;
      return [newItem, ...prev];
    });

    const rowIdToUpdate = targetRowIdForNewProduct || orderRows[0]?.id;
    if (rowIdToUpdate) {
      setOrderRows((prev) =>
        prev.map((row) => {
          if (row.id === rowIdToUpdate) {
            return {
              ...row,
              itemId: newItem.id,
              unit: newItem.unit?.symbol || row.unit || "Pcs",
              orderTitle: newItem.name,
              styleNo: newItem.code || row.styleNo || "",
              unitPrice: Number(newItem.costPrice || newItem.salesPrice || 0) || row.unitPrice || "",
            };
          }
          return row;
        })
      );
    }
    setTargetRowIdForNewProduct(null);
  };

  const handleOpenQuickCreate = (targetRowId?: string) => {
    if (targetRowId) {
      setTargetRowIdForNewProduct(targetRowId);
    } else {
      // Find first empty row or create new row
      const emptyRow = orderRows.find((r) => !r.itemId);
      if (emptyRow) {
        setTargetRowIdForNewProduct(emptyRow.id);
      } else {
        const newRowId = "row-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
        setOrderRows((prev) => [
          ...prev,
          {
            id: newRowId,
            itemId: "",
            quantity: "",
            unitPrice: "",
            unit: "Pcs",
            notes: "",
          }
        ]);
        setTargetRowIdForNewProduct(newRowId);
      }
    }
    setIsQuickCreateOpen(true);
  };

  const [assignedRawMaterialIds, setAssignedRawMaterialIds] = useState<string[]>([]);

  const handleToggleRawMaterial = (itemId: string) => {
    setAssignedRawMaterialIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllRawMaterials = () => {
    const rawIds = items.filter((it) => it.itemType === "RAW_MATERIAL").map((it) => it.id);
    setAssignedRawMaterialIds(rawIds);
  };

  const handleClearAllRawMaterials = () => {
    setAssignedRawMaterialIds([]);
  };

  const totalTargetQty = orderRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalOrderCost = orderRows.reduce(
    (sum, r) => sum + ((Number(r.quantity) || 0) * (Number(r.unitPrice) || 0)),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error("Please select a client / customer.");
      return;
    }

    const validRows = orderRows.filter((r) => r.itemId || r.orderTitle || (Number(r.quantity) > 0) || (Number(r.unitPrice) > 0));
    if (validRows.length === 0) {
      toast.error("Please add at least one ready product or garment item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBatchWorkOrders({
        clientId,
        deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline).toISOString() : null,
        notes: generalNotes.trim() || null,
        rawMaterialIds: assignedRawMaterialIds,
        items: validRows.map((r) => {
          const itemObj = items.find((it) => it.id === r.itemId);
          return {
            itemId: r.itemId || null,
            orderTitle: r.orderTitle || itemObj?.name || null,
            styleNo: r.styleNo || itemObj?.code || null,
            targetQuantity: r.quantity !== "" && r.quantity !== undefined && r.quantity !== null ? Number(r.quantity) : 0,
            unitPrice: r.unitPrice !== "" && r.unitPrice !== undefined && r.unitPrice !== null ? Number(r.unitPrice) : 0,
            unit: r.unit || itemObj?.unit?.symbol || "Pcs",
            notes: r.notes?.trim() || null,
            rawMaterialIds: assignedRawMaterialIds,
          };
        }),
      });

      if (res.success && res.workOrders) {
        toast.success(
          res.count === 1
            ? `Work Order ${res.workOrders[0].orderNo} created successfully!`
            : `Successfully created ${res.count} work orders for this client!`
        );
        router.push("/dashboard/orders");
      } else {
        toast.error(res.error || "Failed to create work orders.");
      }
    } catch (error: any) {
      console.error("Create order submit error:", error);
      toast.error("An unexpected error occurred while creating order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 pb-20 bg-gray-50/50 min-h-screen">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/orders">
            <Button variant="outline" size="icon" className="h-9 w-9 border-gray-300">
              <FiArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <FiLayers className="text-gray-700" />
              Create Work Order
            </h1>
            <p className="text-xs text-gray-500">
              Register manufacturing orders and ready products for customer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/orders">
            <Button variant="ghost" disabled={isSubmitting} className="text-gray-600">
              Cancel
            </Button>
          </Link>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || loadingInit}
            className="gap-2 px-6 bg-gray-900 hover:bg-black text-white font-medium shadow-sm"
          >
            <FiSave className="h-4 w-4" />
            {isSubmitting ? "Creating..." : "Save Work Order"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Client & Timeline Information (Full Width) */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-100 pb-4">
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FiUser className="text-gray-700" />
              1. Client & Timeline Information
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-0.5">
              Select the client / customer placing the manufacturing order.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Full-Width Client Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="clientId" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Select Client / Customer <span className="text-red-500">*</span>
              </Label>
              <select
                id="clientId"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={loadingInit}
              >
                <option value="">-- Select Client / Customer --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""} {c.phone ? `- ${c.phone}` : ""}
                  </option>
                ))}
              </select>

              {/* Client Info Banner */}
              {selectedClient && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700 flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-gray-400 block font-medium">Customer Name</span>
                    <strong className="text-gray-900">{selectedClient.name}</strong>
                  </div>
                  {selectedClient.phone && (
                    <div className="border-l border-gray-200 pl-4">
                      <span className="text-gray-400 block font-medium">Phone</span>
                      <strong className="text-gray-900">{selectedClient.phone}</strong>
                    </div>
                  )}
                  {selectedClient.company && (
                    <div className="border-l border-gray-200 pl-4">
                      <span className="text-gray-400 block font-medium">Company</span>
                      <strong className="text-gray-900">{selectedClient.company}</strong>
                    </div>
                  )}
                  {selectedClient.address && (
                    <div className="border-l border-gray-200 pl-4">
                      <span className="text-gray-400 block font-medium">Address</span>
                      <span className="text-gray-700">{selectedClient.address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Deadline & General Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="deliveryDeadline" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Expected Delivery Deadline (Optional)
                </Label>
                <Input
                  id="deliveryDeadline"
                  type="date"
                  className="h-10 text-xs border-gray-300 focus:ring-gray-900"
                  value={deliveryDeadline}
                  onChange={(e) => setDeliveryDeadline(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="generalNotes" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Order Remarks / Notes (Optional)
                </Label>
                <Input
                  id="generalNotes"
                  placeholder="e.g. Client requested express delivery..."
                  className="h-10 text-xs border-gray-300 focus:ring-gray-900"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Ordered Items / Garments List (Multi-row Table) */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiPackage className="text-gray-700" />
                2. Ordered Ready Products & Garments
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Add one or multiple products ordered by this client.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenQuickCreate()}
                className="gap-1.5 text-xs h-8 border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium shadow-2xs"
              >
                <FiPlus className="text-emerald-600 font-bold" /> New Ready Product
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="gap-1.5 text-xs h-8 border-gray-300 hover:bg-gray-50 font-medium"
              >
                <FiPlus /> Add Row
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse bg-white">
                <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-700">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[280px]">Ready Product / Garment *</th>
                    <th className="p-3 w-32">Quantity (Optional)</th>
                    <th className="p-3 w-36">Cost / Unit (৳)</th>
                    <th className="p-3 min-w-[180px]">Item Notes / Remarks</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderRows.map((row, idx) => {
                    const rowQty = Number(row.quantity) || 0;
                    const rowPrice = Number(row.unitPrice) || 0;
                    const rowSubtotal = rowQty * rowPrice;
                    const selectedProd = selectableProducts.find((p) => p.id === row.itemId);

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Row Index */}
                        <td className="p-3 align-top text-center">
                          <div className="h-9 flex items-center justify-center text-gray-400 font-mono text-xs">
                            {idx + 1}
                          </div>
                        </td>
                        
                        {/* Ready Product Dropdown with Quick Create Trigger */}
                        <td className="p-3 align-top">
                          <div className="flex items-center gap-1.5">
                            <select
                              required
                              className="w-full h-9 px-2.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 font-medium"
                              value={row.itemId}
                              onChange={(e) => handleRowChange(row.id, "itemId", e.target.value)}
                            >
                              <option value="">-- Select Ready Product / Garment --</option>
                              {selectableProducts.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.code}) {item.category?.name ? `• ${item.category.name}` : ""}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Quick Create Ready Product"
                              onClick={() => handleOpenQuickCreate(row.id)}
                              className="h-9 w-9 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 shrink-0 border border-dashed border-gray-300 rounded-md"
                            >
                              <FiPlus className="h-4 w-4" />
                            </Button>
                          </div>
                          {selectedProd?.category?.name && (
                            <span className="text-[11px] text-gray-500 font-medium mt-1 block truncate">
                              Category: {selectedProd.category.name}
                            </span>
                          )}
                        </td>

                        {/* Quantity (Optional) */}
                        <td className="p-3 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0 (Optional)"
                            className="h-9 text-xs font-bold border-gray-300 focus:ring-gray-900"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.id, "quantity", e.target.value)}
                          />
                          {selectedProd?.unit?.symbol && (
                            <span className="text-[11px] text-gray-500 font-medium mt-1 block">
                              Unit: {selectedProd.unit.symbol}
                            </span>
                          )}
                        </td>

                        {/* Making Cost / Unit Price (৳) */}
                        <td className="p-3 align-top">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="h-9 text-xs font-semibold border-gray-300 focus:ring-gray-900"
                            value={row.unitPrice}
                            onChange={(e) => handleRowChange(row.id, "unitPrice", e.target.value)}
                          />
                          {rowSubtotal > 0 && (
                            <span className="text-[11px] text-emerald-700 font-semibold mt-1 block whitespace-nowrap">
                              Sub: ৳{rowSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        {/* Row Notes */}
                        <td className="p-3 align-top">
                          <Input
                            placeholder="e.g. Size M & L, White color..."
                            className="h-9 text-xs text-gray-700 border-gray-300 focus:ring-gray-900"
                            value={row.notes || ""}
                            onChange={(e) => handleRowChange(row.id, "notes", e.target.value)}
                          />
                        </td>

                        {/* Delete Row */}
                        <td className="p-3 align-top text-center">
                          <div className="h-9 flex items-center justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveRow(row.id)}
                              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions & Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="gap-1.5 text-xs h-8 border-gray-300 hover:bg-gray-50 font-medium"
                >
                  <FiPlus /> Add Row
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenQuickCreate()}
                  className="gap-1.5 text-xs h-8 border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium"
                >
                  <FiPlus className="text-emerald-600" /> New Ready Product
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-gray-700">
                <span>Total Products: <strong className="text-gray-900">{orderRows.length}</strong></span>
                <span>Total Quantity: <strong className="text-gray-900 text-sm font-bold">{totalTargetQty.toLocaleString()} Pcs</strong></span>
                <span>Total Making Cost: <strong className="text-emerald-700 text-sm font-bold">৳{totalOrderCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Assign Raw Materials for this Order */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="bg-white border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiLayers className="text-gray-700" />
                3. Assign Raw Materials (For Stock-In Restriction)
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Select the raw materials required for this order. When recording Stock-In later, only these assigned materials will be selectable under this order.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllRawMaterials}
                className="text-xs h-8 border-gray-300 hover:bg-gray-50 font-medium"
              >
                Select All
              </Button>
              {assignedRawMaterialIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAllRawMaterials}
                  className="text-xs h-8 border-gray-300 hover:bg-gray-50 text-red-600 font-medium"
                >
                  Clear ({assignedRawMaterialIds.length})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            {items.filter((it) => it.itemType === "RAW_MATERIAL").length === 0 ? (
              <div className="p-6 text-center border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                No Raw Materials found in the system. You can create raw materials in Master Items.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1 border border-gray-100 rounded-lg bg-gray-50/50">
                  {items.filter((it) => it.itemType === "RAW_MATERIAL").map((raw) => {
                    const isSelected = assignedRawMaterialIds.includes(raw.id);
                    return (
                      <div
                        key={raw.id}
                        onClick={() => handleToggleRawMaterial(raw.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 select-none ${
                          isSelected
                            ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 shadow-2xs"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-semibold truncate flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-emerald-600" : "bg-gray-300"}`} />
                            {raw.name}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-2">
                            <span>Code: {raw.code}</span>
                            {raw.category?.name && <span>• {raw.category.name}</span>}
                            {raw.unit?.symbol && <span>• ({raw.unit.symbol})</span>}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mt-0.5 pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 pt-1">
                  <span>
                    Assigned: <strong className="text-gray-900 font-bold">{assignedRawMaterialIds.length}</strong> of {items.filter((it) => it.itemType === "RAW_MATERIAL").length} Raw Materials
                  </span>
                  {assignedRawMaterialIds.length > 0 && (
                    <span className="text-emerald-700 font-medium">
                      ✓ Stock-in for this order will be strictly restricted to these {assignedRawMaterialIds.length} materials.
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/dashboard/orders">
            <Button variant="outline" type="button" disabled={isSubmitting} className="border-gray-300">
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit" 
            disabled={isSubmitting || loadingInit}
            className="gap-2 px-8 bg-gray-900 hover:bg-black text-white font-medium shadow-sm"
          >
            <FiCheckCircle className="h-4 w-4" />
            {isSubmitting ? "Creating Orders..." : "Save Work Order"}
          </Button>
        </div>
      </form>

      {/* Quick Create Ready Product Modal */}
      <QuickCreateReadyProductModal
        open={isQuickCreateOpen}
        onOpenChange={setIsQuickCreateOpen}
        onSuccess={handleProductCreated}
      />
    </div>
  );
}


