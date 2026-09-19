"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiSave, FiLayers, FiUser, FiPackage, FiInfo, FiCheckCircle, FiPlus
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getWorkOrderById, updateWorkOrder, getClientsAndItemsForSelect } from "../../_actions/work-order.action";
import { QuickCreateReadyProductModal } from "../../_components/quick-create-ready-product-modal";

export default function EditWorkOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: "",
    itemId: "",
    targetQuantity: 100,
    unitPrice: 0,
    unit: "Pcs",
    deliveryDeadline: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!orderId) return;
      setLoadingInit(true);

      const [orderRes, selectRes] = await Promise.all([
        getWorkOrderById(orderId),
        getClientsAndItemsForSelect(),
      ]);

      if (selectRes.success) {
        setClients(selectRes.clients || []);
        setItems(selectRes.items || []);
      }

      if (orderRes.success && orderRes.order) {
        const o = orderRes.order;
        setOrder(o);
        setFormData({
          clientId: o.clientId || "",
          itemId: o.itemId || "",
          targetQuantity: Number(o.targetQuantity || 100),
          unitPrice: Number(o.unitPrice || 0),
          unit: o.unit || "Pcs",
          deliveryDeadline: o.deliveryDeadline ? new Date(o.deliveryDeadline).toISOString().split("T")[0] : "",
        });
      } else {
        toast.error(orderRes.error || "Failed to load order data");
      }

      setLoadingInit(false);
    }
    loadData();
  }, [orderId]);

  // Filter items to show only Ready Products
  const readyProductItems = items.filter((it) => it.itemType === "READY_PRODUCT");
  const selectableProducts = readyProductItems.length > 0 ? readyProductItems : items;

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "itemId") {
        const selectedItem = items.find((it) => it.id === value);
        if (selectedItem?.unit?.symbol) {
          updated.unit = selectedItem.unit.symbol;
        }
        if (selectedItem) {
          const defaultPrice = Number(selectedItem.costPrice || selectedItem.salesPrice || 0);
          if (defaultPrice > 0 && (!prev.unitPrice || Number(prev.unitPrice) === 0)) {
            updated.unitPrice = defaultPrice;
          }
        }
      }
      return updated;
    });
  };

  const handleProductCreated = (newItem: any) => {
    setItems((prev) => {
      if (prev.some((it) => it.id === newItem.id)) return prev;
      return [newItem, ...prev];
    });

    setFormData((prev) => ({
      ...prev,
      itemId: newItem.id,
      unit: newItem.unit?.symbol || prev.unit || "Pcs",
      unitPrice: Number(newItem.costPrice || newItem.salesPrice || 0) || prev.unitPrice || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientId) {
      toast.error("Please select a client for this order.");
      return;
    }

    if (!formData.targetQuantity || Number(formData.targetQuantity) <= 0) {
      toast.error("Please enter a valid target quantity greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateWorkOrder(orderId, {
        clientId: formData.clientId,
        itemId: formData.itemId || null,
        unit: formData.unit || "Pcs",
        targetQuantity: Number(formData.targetQuantity),
        unitPrice: Number(formData.unitPrice) || 0,
        deliveryDeadline: formData.deliveryDeadline ? new Date(formData.deliveryDeadline).toISOString() : null,
      });

      if (res.success && res.workOrder) {
        toast.success(`Work Order ${res.workOrder.orderNo} updated successfully!`);
        router.push(`/dashboard/orders/${orderId}`);
      } else {
        toast.error(res.error || "Failed to update work order.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("An unexpected error occurred while updating order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === formData.clientId);
  const selectedProduct = items.find((it) => it.id === formData.itemId);

  if (loadingInit) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
        <p>Loading order details for editing...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold">Order not found</h2>
        <Link href="/dashboard/orders">
          <Button className="mt-4 gap-2">
            <FiArrowLeft /> Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 pb-20">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/orders/${orderId}`}>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <FiArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <FiLayers className="text-primary" />
                Edit Work Order
              </h1>
              <Badge variant="secondary" className="font-semibold text-xs">{order.orderNo}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Modify client details, ordered ready product, target quantity, and delivery deadline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/orders/${orderId}`}>
            <Button variant="ghost" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="gap-2 shadow-sm"
          >
            <FiSave className="h-4 w-4" />
            {isSubmitting ? "Saving Changes..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client & Product Information */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FiUser className="text-primary" />
              Client & Ordered Product
            </CardTitle>
            <CardDescription>
              Select the customer and link the Ready Product being manufactured.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Client Select */}
            <div className="space-y-2">
              <Label htmlFor="clientId" className="font-semibold text-gray-800 dark:text-gray-200">
                Client / Customer <span className="text-red-500">*</span>
              </Label>
              <select
                id="clientId"
                required
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.clientId}
                onChange={(e) => handleChange("clientId", e.target.value)}
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""} {c.phone ? `- ${c.phone}` : ""}
                  </option>
                ))}
              </select>
              {selectedClient && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <FiInfo className="text-sky-500" /> Client Contact: {selectedClient.phone || "No phone"} | Company: {selectedClient.company || "Individual"}
                </p>
              )}
            </div>

            {/* Ready Product Select with Quick Create */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="itemId" className="font-semibold text-gray-800 dark:text-gray-200">
                  Ordered Ready Product (Garment)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsQuickCreateOpen(true)}
                  className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                >
                  <FiPlus className="h-3.5 w-3.5" /> New Product
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  id="itemId"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.itemId}
                  onChange={(e) => handleChange("itemId", e.target.value)}
                >
                  <option value="">-- Select Ready Product / Garment --</option>
                  {selectableProducts.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code}) {it.category?.name ? `• ${it.category.name}` : ""}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Quick Create Ready Product"
                  onClick={() => setIsQuickCreateOpen(true)}
                  className="h-10 w-10 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 shrink-0 border border-dashed border-gray-300 rounded-md"
                >
                  <FiPlus className="h-4 w-4" />
                </Button>
              </div>
              {selectedProduct && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <FiPackage className="text-emerald-500" /> Linked Item Code: <strong>{selectedProduct.code}</strong>
                </p>
              )}
            </div>

            {/* Target Quantity & Unit */}
            <div className="space-y-2">
              <Label htmlFor="targetQuantity" className="font-semibold text-gray-800 dark:text-gray-200">
                Order Quantity & Unit <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="targetQuantity"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 500"
                  className="font-bold flex-1"
                  value={formData.targetQuantity}
                  onChange={(e) => handleChange("targetQuantity", e.target.value)}
                />
                <select
                  id="unit"
                  className="w-32 h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formData.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Dozen">Dozen</option>
                  <option value="Sets">Sets</option>
                  <option value="Pairs">Pairs</option>
                  <option value="Kg">Kg</option>
                  <option value="Yards">Yards</option>
                  <option value="Meters">Meters</option>
                </select>
              </div>
            </div>

            {/* Making Cost / Unit Price */}
            <div className="space-y-2">
              <Label htmlFor="unitPrice" className="font-semibold text-gray-800 dark:text-gray-200">
                Making Cost / Unit Rate (৳)
              </Label>
              <div className="space-y-1">
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="font-semibold"
                  value={formData.unitPrice}
                  onChange={(e) => handleChange("unitPrice", e.target.value)}
                />
                {Number(formData.targetQuantity) > 0 && Number(formData.unitPrice) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Estimated Total Cost: <strong className="text-emerald-600">৳{(Number(formData.targetQuantity) * Number(formData.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Delivery Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deliveryDeadline" className="font-semibold text-gray-800 dark:text-gray-200">
                Expected Delivery Deadline
              </Label>
              <Input
                id="deliveryDeadline"
                type="date"
                value={formData.deliveryDeadline}
                onChange={(e) => handleChange("deliveryDeadline", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/dashboard/orders/${orderId}`}>
            <Button variant="outline" type="button" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="gap-2 px-6 shadow-sm"
          >
            <FiCheckCircle className="h-4 w-4" />
            {isSubmitting ? "Saving Changes..." : "Save Changes"}
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
