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

interface OrderItemRow {
  id: string;
  itemId: string;
  orderTitle?: string;
  styleNo?: string;
  quantity: string | number;
  unit?: string;
  notes?: string;
}

export default function CreateWorkOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [clientId, setClientId] = useState("");
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");

  const [orderRows, setOrderRows] = useState<OrderItemRow[]>([
    {
      id: "row-" + Date.now(),
      itemId: "",
      quantity: "",
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
        }
        return updated;
      })
    );
  };

  const totalTargetQty = orderRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error("Please select a client / customer.");
      return;
    }

    const validRows = orderRows.filter((r) => r.itemId || r.orderTitle || (Number(r.quantity) > 0));
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
        items: validRows.map((r) => {
          const itemObj = items.find((it) => it.id === r.itemId);
          return {
            itemId: r.itemId || null,
            orderTitle: r.orderTitle || itemObj?.name || null,
            styleNo: r.styleNo || itemObj?.code || null,
            targetQuantity: r.quantity !== "" && r.quantity !== undefined && r.quantity !== null ? Number(r.quantity) : 0,
            unit: r.unit || itemObj?.unit?.symbol || "Pcs",
            notes: r.notes?.trim() || null,
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="gap-1.5 text-xs h-8 border-gray-300 hover:bg-gray-50 font-medium"
            >
              <FiPlus /> Add Product
            </Button>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse bg-white">
                <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-700">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 min-w-[280px]">Ready Product / Garment *</th>
                    <th className="p-3 w-40">Quantity (Optional)</th>
                    <th className="p-3 min-w-[200px]">Item Notes / Remarks</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderRows.map((row, idx) => {
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                        
                        {/* Ready Product Dropdown */}
                        <td className="p-3">
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
                        </td>

                        {/* Quantity (Optional) */}
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0 (Optional)"
                            className="h-9 text-xs font-bold border-gray-300 focus:ring-gray-900"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.id, "quantity", e.target.value)}
                          />
                        </td>

                        {/* Row Notes */}
                        <td className="p-3">
                          <Input
                            placeholder="e.g. Size M & L, White color..."
                            className="h-9 text-xs text-gray-700 border-gray-300 focus:ring-gray-900"
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
                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
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
                className="gap-1.5 text-xs h-8 border-gray-300 hover:bg-gray-50 font-medium"
              >
                <FiPlus /> Add Another Product
              </Button>

              <div className="flex items-center gap-6 text-xs text-gray-700">
                <span>Total Products: <strong className="text-gray-900">{orderRows.length}</strong></span>
                <span>Total Quantity: <strong className="text-gray-900 text-sm font-bold">{totalTargetQty.toLocaleString()} Pcs</strong></span>
              </div>
            </div>
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
    </div>
  );
}

