"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiSave, FiPackage, FiCheckCircle, FiInfo, FiUser, FiLayers
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MaterialInwardSource } from "@prisma/client";
import { getStockInById, updateStockIn, getStockInFormData } from "../../_actions/stock-in.action";

const UNIT_OPTIONS = [
  "Kg", "Yards", "Meters", "Rolls", "Gross", "Pcs", "Cones", "Dozen", "Packs", "Boxes", "Liters"
];

export default function EditStockInPage() {
  const params = useParams();
  const router = useRouter();
  const inwardId = params.id as string;

  const [inward, setInward] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [workOrderId, setWorkOrderId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unit, setUnit] = useState("Kg");
  const [receivedDate, setReceivedDate] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!inwardId) return;
      setLoadingInit(true);

      const [inwRes, formRes] = await Promise.all([
        getStockInById(inwardId),
        getStockInFormData(),
      ]);

      if (formRes.success) {
        setWorkOrders(formRes.workOrders || []);
        setItems(formRes.items || []);
        setUnits(formRes.units || []);
      }

      if (inwRes.success && inwRes.inward) {
        const inw = inwRes.inward;
        setInward(inw);
        setWorkOrderId(inw.workOrderId || "");
        setItemId(inw.itemId || "");
        setQuantity(Number(inw.quantity) || 1);
        setUnit(inw.unit || "Kg");
        setReceivedDate(inw.receivedDate ? new Date(inw.receivedDate).toISOString().split("T")[0] : "");
        setChallanNo(inw.challanNo || "");
        setNotes(inw.notes || "");
      } else {
        toast.error(inwRes.error || "Failed to load inward record.");
      }

      setLoadingInit(false);
    }

    loadData();
  }, [inwardId]);

  // Filter master items for Raw Materials
  const rawMaterialItems = items.filter((it) => it.itemType === "RAW_MATERIAL");
  const selectableRawMaterials = rawMaterialItems.length > 0 ? rawMaterialItems : items;

  const selectedWorkOrder = workOrders.find((w) => w.id === workOrderId);
  const selectedItem = items.find((it) => it.id === itemId);

  const handleItemChange = (newItemId: string) => {
    setItemId(newItemId);
    const foundItem = items.find((it) => it.id === newItemId);
    if (foundItem?.unit?.symbol) {
      setUnit(foundItem.unit.symbol);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemId) {
      toast.error("Please select a Raw Material item.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      toast.error("Please enter a valid quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const itemObj = items.find((it) => it.id === itemId);
      const res = await updateStockIn(inwardId, {
        source: selectedWorkOrder ? MaterialInwardSource.CLIENT_SUPPLIED : MaterialInwardSource.PURCHASE,
        workOrderId: workOrderId || null,
        clientId: selectedWorkOrder?.clientId || null,
        itemId,
        materialName: itemObj?.name || null,
        materialCategory: itemObj?.category?.name || "RAW_MATERIAL",
        quantity: Number(quantity),
        unit: unit || itemObj?.unit?.symbol || "Pcs",
        challanNo: challanNo.trim() || null,
        receivedDate: receivedDate ? new Date(receivedDate).toISOString() : null,
        notes: notes.trim() || null,
      });

      if (res.success) {
        toast.success(`Stock Inward (${inward?.inwardNo}) updated successfully!`);
        router.push("/dashboard/inventory/stock-in");
      } else {
        toast.error(res.error || "Failed to update stock inward.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("An unexpected error occurred while updating stock in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
        <p>Loading inward details...</p>
      </div>
    );
  }

  if (!inward) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Stock Inward Record Not Found</h2>
        <Link href="/dashboard/inventory/stock-in">
          <Button className="mt-4 gap-2">
            <FiArrowLeft /> Back to Stock In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory/stock-in">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <FiArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <FiPackage className="text-primary" />
                Edit Stock In
              </h1>
              <Badge variant="secondary" className="font-semibold text-xs">{inward.inwardNo}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Update linked work order, raw material, and received inward quantity.
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
            {isSubmitting ? "Updating..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Work Order Link */}
        <Card className="bg-white dark:bg-card border shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FiLayers className="text-primary" />
              1. Work Order & Inward Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Work Order Select */}
            <div className="space-y-1.5">
              <Label htmlFor="workOrderId" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Linked Work Order
              </Label>
              <select
                id="workOrderId"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={workOrderId}
                onChange={(e) => setWorkOrderId(e.target.value)}
              >
                <option value="">-- General Stock In (No Specific Order) --</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.orderNo} • {wo.item?.name || wo.orderTitle || "Order"} - {wo.client?.name || "Client"}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-detected Client Info Box */}
            {selectedWorkOrder && (
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-1.5">
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
                  </div>
                </div>
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

        {/* Card 2: Raw Material Information */}
        <Card className="bg-white dark:bg-card border shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FiPackage className="text-primary" />
              2. Raw Material Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {/* Raw Material Item Dropdown */}
            <div className="space-y-1.5">
              <Label htmlFor="itemId" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Raw Material Item <span className="text-red-500">*</span>
              </Label>
              <select
                id="itemId"
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                value={itemId}
                onChange={(e) => handleItemChange(e.target.value)}
              >
                <option value="">-- Select Raw Material Item --</option>
                {selectableRawMaterials.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code}) {item.category?.name ? `• ${item.category.name}` : ""}
                  </option>
                ))}
              </select>
              {selectedItem && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Item Code: <strong>{selectedItem.code}</strong> {selectedItem.category?.name ? `| Category: ${selectedItem.category.name}` : ""}
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="quantity" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="0.00"
                className="h-9 text-xs font-bold"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
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
          <CardContent className="p-4 sm:p-6 space-y-4">
            <textarea
              id="notes"
              rows={2}
              className="w-full p-3 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Received raw materials in good condition..."
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
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
