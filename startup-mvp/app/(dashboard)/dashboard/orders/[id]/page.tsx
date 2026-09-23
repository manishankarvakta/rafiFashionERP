"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiCheckCircle, FiClock, FiTruck, 
  FiAlertCircle, FiTrendingUp, FiUser, FiBox, 
  FiPlus, FiPrinter, FiEdit2, FiPackage, FiTrash2,
  FiArrowDownLeft, FiArrowUpRight, FiLayers, FiFileText,
  FiDollarSign, FiCalendar, FiCheckSquare, FiInfo
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  getWorkOrderById, 
  updateWorkOrderProduction, 
  createWorkOrderDelivery, 
  deleteWorkOrder,
  addProductionEntry,
  deleteProductionEntry,
  closeWorkOrderProduction,
  generateWorkOrderInvoice
} from "../_actions/work-order.action";
import { toast } from "sonner";
import { WorkOrderStatus } from "@prisma/client";

interface MaterialBalanceItem {
  itemId: string;
  itemName: string;
  itemCode?: string;
  unit: string;
  totalIn: number;
  totalOut: number;
  balance: number;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // In-Order Direct Production Update State
  const [producedQty, setProducedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [prodStatus, setProdStatus] = useState<WorkOrderStatus>(WorkOrderStatus.PENDING);
  const [prodNotes, setProdNotes] = useState<string>("");
  const [isUpdatingProd, setIsUpdatingProd] = useState(false);

  // Batch / Daily Production Entry Modal State
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchData, setBatchData] = useState({
    producedQty: 0,
    rejectedQty: 0,
    productionDate: new Date().toISOString().split("T")[0],
    shiftOrLine: "",
    notes: "",
  });
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Short-Close / Complete Order Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosingOrder, setIsClosingOrder] = useState(false);

  // Sales Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // Delivery Modal State
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
  const [deliveryData, setDeliveryData] = useState({
    deliveredQty: 0,
    driverName: "",
    vehicleNo: "",
    notes: "",
  });
  const [isDelivering, setIsDelivering] = useState(false);

  // Delete Order State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);

  // Direct In-Page Print State & Handler
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);

  const handleDirectPrintInvoice = (saleId: string) => {
    setIsPrintingInvoice(true);
    const oldIframe = document.getElementById("print-invoice-iframe");
    if (oldIframe) {
      oldIframe.remove();
    }

    // Register callback for child iframe (supported by PrintButton.tsx)
    (window as any).triggerIframePrint = () => {
      const iframeElement = document.getElementById("print-invoice-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
      setIsPrintingInvoice(false);
    };

    const iframe = document.createElement("iframe");
    iframe.id = "print-invoice-iframe";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "800px";
    iframe.style.height = "600px";
    iframe.style.border = "0";
    iframe.src = `/print/invoice/${saleId}`;

    document.body.appendChild(iframe);

    // Fallback print trigger in case child script callback is delayed
    iframe.onload = () => {
      setTimeout(() => {
        const iframeElement = document.getElementById("print-invoice-iframe") as HTMLIFrameElement;
        if (iframeElement && iframeElement.contentWindow && (window as any).triggerIframePrint) {
          iframeElement.contentWindow.focus();
          iframeElement.contentWindow.print();
          delete (window as any).triggerIframePrint;
          setIsPrintingInvoice(false);
        }
      }, 2000);
    };
  };

  const [printingChallanId, setPrintingChallanId] = useState<string | null>(null);

  const handleDirectPrintChallan = (challanId: string) => {
    setPrintingChallanId(challanId);
    const oldIframe = document.getElementById("print-challan-iframe");
    if (oldIframe) {
      oldIframe.remove();
    }

    (window as any).triggerIframePrint = () => {
      const iframeElement = document.getElementById("print-challan-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
      setPrintingChallanId(null);
    };

    const iframe = document.createElement("iframe");
    iframe.id = "print-challan-iframe";
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "800px";
    iframe.style.height = "600px";
    iframe.style.border = "0";
    iframe.src = `/print/delivery-challan/${challanId}`;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        const iframeElement = document.getElementById("print-challan-iframe") as HTMLIFrameElement;
        if (iframeElement && iframeElement.contentWindow && (window as any).triggerIframePrint) {
          iframeElement.contentWindow.focus();
          iframeElement.contentWindow.print();
          delete (window as any).triggerIframePrint;
          setPrintingChallanId(null);
        }
      }, 2000);
    };
  };

  const fetchOrder = async () => {
    setLoading(true);
    const res = await getWorkOrderById(orderId);
    if (res.success && res.order) {
      setOrder(res.order);
      setProducedQty(Number(res.order.producedQuantity || 0));
      setRejectedQty(Number(res.order.rejectedQuantity || 0));
      setProdStatus(res.order.productionStatus as WorkOrderStatus);
      setProdNotes(res.order.productionNotes || "");
    } else {
      toast.error(res.error || "Failed to load order");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  // Direct quick production update handler
  const handleSaveProduction = async () => {
    setIsUpdatingProd(true);
    const res = await updateWorkOrderProduction(orderId, {
      producedQuantity: Number(producedQty),
      rejectedQuantity: Number(rejectedQty),
      productionStatus: prodStatus,
      productionNotes: prodNotes,
    });

    if (res.success) {
      toast.success("Production progress updated successfully!");
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to update production");
    }
    setIsUpdatingProd(false);
  };

  // Batch production entry submission
  const handleLogBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchData.producedQty || Number(batchData.producedQty) <= 0) {
      toast.error("Please enter a valid completed quantity greater than 0.");
      return;
    }

    setIsSubmittingBatch(true);
    const res = await addProductionEntry({
      workOrderId: orderId,
      producedQty: Number(batchData.producedQty),
      rejectedQty: Number(batchData.rejectedQty || 0),
      productionDate: batchData.productionDate || null,
      shiftOrLine: batchData.shiftOrLine || null,
      notes: batchData.notes || null,
    });

    if (res.success) {
      toast.success(`Batch output ${res.entry?.entryNo || ""} logged successfully!`);
      setIsBatchOpen(false);
      setBatchData({
        producedQty: 0,
        rejectedQty: 0,
        productionDate: new Date().toISOString().split("T")[0],
        shiftOrLine: "",
        notes: "",
      });
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to log batch output");
    }
    setIsSubmittingBatch(false);
  };

  // Delete production batch entry
  const handleDeleteBatch = async (entryId: string) => {
    if (!confirm("Are you sure you want to remove this production batch entry?")) return;
    setDeletingBatchId(entryId);
    const res = await deleteProductionEntry(entryId);
    if (res.success) {
      toast.success("Batch entry removed and totals recalculated.");
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to remove batch entry");
    }
    setDeletingBatchId(null);
  };

  // Short-close / mark complete
  const handleCloseOrder = async () => {
    setIsClosingOrder(true);
    const res = await closeWorkOrderProduction(orderId, closingNotes);
    if (res.success) {
      toast.success("Work order production completed & closed.");
      setIsCloseModalOpen(false);
      setClosingNotes("");
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to close order production");
    }
    setIsClosingOrder(false);
  };

  // Generate sales invoice
  const handleGenerateInvoice = async () => {
    setIsGeneratingInvoice(true);
    const res = await generateWorkOrderInvoice(orderId, { notes: invoiceNotes });
    if (res.success) {
      toast.success(`Invoice ${res.sale?.saleNumber || ""} generated for actual output!`);
      setIsInvoiceModalOpen(false);
      setInvoiceNotes("");
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to generate invoice");
    }
    setIsGeneratingInvoice(false);
  };

  // Delivery handler
  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryData.deliveredQty || deliveryData.deliveredQty <= 0) {
      toast.error("Please enter a valid delivery quantity");
      return;
    }

    setIsDelivering(true);
    const res = await createWorkOrderDelivery(orderId, {
      deliveredQty: Number(deliveryData.deliveredQty),
      driverName: deliveryData.driverName || null,
      vehicleNo: deliveryData.vehicleNo || null,
      notes: deliveryData.notes || null,
    });

    if (res.success && res.delivery) {
      toast.success(`Delivery Challan ${res.delivery.challanNo} created!`);
      setIsDeliveryOpen(false);
      setDeliveryData({ deliveredQty: 0, driverName: "", vehicleNo: "", notes: "" });
      fetchOrder();
    } else {
      toast.error(res.error || "Failed to create delivery");
    }
    setIsDelivering(false);
  };

  const handleDeleteOrder = async () => {
    setIsDeletingOrder(true);
    const res = await deleteWorkOrder(orderId);
    if (res.success) {
      toast.success(`Work Order ${order?.orderNo} deleted successfully.`);
      router.push("/dashboard/orders");
    } else {
      toast.error(res.error || "Failed to delete work order.");
      setIsDeletingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-gray-500 bg-white min-h-[400px] flex flex-col items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full mb-3"></div>
        <p className="text-sm font-medium text-gray-600">Loading work order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center bg-white border border-gray-200 rounded-xl max-w-lg mx-auto my-12 shadow-sm">
        <FiAlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Order not found</h2>
        <p className="text-sm text-gray-500 mt-1">This work order might have been deleted or moved.</p>
        <Link href="/dashboard/orders">
          <Button className="mt-5 gap-2 bg-gray-900 hover:bg-black text-white">
            <FiArrowLeft /> Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const targetQty = Number(order.targetQuantity || 1);
  const currentProduced = Number(order.producedQuantity || producedQty || 0);
  const progressPercent = Math.min(100, Math.round((currentProduced / targetQty) * 100));
  const remainingQty = Math.max(0, targetQty - currentProduced);
  const totalDelivered = (order.deliveries || []).reduce((sum: number, d: any) => sum + Number(d.deliveredQty || 0), 0);
  const unitPrice = Number(order.unitPrice || 0);
  
  // Actual billing quantity is delivered qty (if delivered) or produced qty or target qty
  const billingQty = totalDelivered > 0 ? totalDelivered : (currentProduced > 0 ? currentProduced : targetQty);
  const totalBillableAmount = billingQty * unitPrice;
  const isOrderConfirmed = order.productionStatus === "COMPLETED" || order.productionStatus === "DELIVERED";
  const isFinalized = Boolean(order.saleInvoice) || isOrderConfirmed;

  // Calculate Material Balance (Stock In vs Stock Out)
  const materialSummaryMap = new Map<string, MaterialBalanceItem>();

  (order.materialsIn || []).forEach((mat: any) => {
    const key = mat.itemId || mat.item?.id || mat.item?.name || 'unknown';
    const name = mat.item?.name || "Raw Material";
    const code = mat.item?.code || "";
    const unit = mat.unit || mat.item?.unit?.symbol || "Pcs";
    const qty = Number(mat.quantity || 0);

    if (!materialSummaryMap.has(key)) {
      materialSummaryMap.set(key, {
        itemId: key,
        itemName: name,
        itemCode: code,
        unit,
        totalIn: qty,
        totalOut: 0,
        balance: qty,
      });
    } else {
      const entry = materialSummaryMap.get(key)!;
      entry.totalIn += qty;
      entry.balance = entry.totalIn - entry.totalOut;
    }
  });

  (order.materialsOut || []).forEach((mat: any) => {
    const key = mat.itemId || mat.item?.id || mat.item?.name || 'unknown';
    const name = mat.item?.name || "Raw Material";
    const code = mat.item?.code || "";
    const unit = mat.unit || mat.item?.unit?.symbol || "Pcs";
    const qty = Number(mat.quantity || 0);

    if (!materialSummaryMap.has(key)) {
      materialSummaryMap.set(key, {
        itemId: key,
        itemName: name,
        itemCode: code,
        unit,
        totalIn: 0,
        totalOut: qty,
        balance: -qty,
      });
    } else {
      const entry = materialSummaryMap.get(key)!;
      entry.totalOut += qty;
      entry.balance = entry.totalIn - entry.totalOut;
    }
  });

  const materialSummary = Array.from(materialSummaryMap.values());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium">Completed</Badge>;
      case "IN_PRODUCTION":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 font-medium">In Production</Badge>;
      case "MATERIAL_RECEIVED":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50 font-medium">Material Received</Badge>;
      case "DELIVERED":
        return <Badge className="bg-slate-900 text-white border-slate-900 hover:bg-slate-900 font-medium">Delivered & Closed</Badge>;
      default:
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-medium">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto bg-gray-50/50 min-h-screen">
      {/* Top Navigation & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <Link href="/dashboard/orders" className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors">
          <FiArrowLeft className="w-4 h-4" /> Back to Orders List
        </Link>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href={`/dashboard/orders/${orderId}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm font-medium">
              <FiEdit2 className="h-4 w-4 text-gray-500" /> Edit Order
            </Button>
          </Link>

          {order.productionStatus !== "COMPLETED" && order.productionStatus !== "DELIVERED" && (
            <Button
              onClick={() => setIsCloseModalOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50 font-medium shadow-sm"
            >
              <FiCheckSquare className="w-4 h-4 text-amber-600" /> Complete / Close
            </Button>
          )}

          <Button 
            onClick={() => {
              setDeliveryData((prev) => ({
                ...prev,
                deliveredQty: Math.max(0, currentProduced - totalDelivered),
              }));
              setIsDeliveryOpen(true);
            }} 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm font-medium"
          >
            <FiTruck className="h-4 w-4 text-gray-500" /> Create Delivery Challan
          </Button>

          {order.saleInvoice ? (
            <Button 
              onClick={() => handleDirectPrintInvoice(order.saleInvoice.id)}
              disabled={isPrintingInvoice}
              size="sm" 
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
            >
              <FiPrinter className="h-4 w-4" /> 
              {isPrintingInvoice ? "Preparing Print..." : "Print Sales Invoice"}
            </Button>
          ) : (
            <Button 
              onClick={() => {
                if (!isOrderConfirmed) {
                  toast.error("Please complete or close the order before generating the invoice.");
                  return;
                }
                setIsInvoiceModalOpen(true);
              }}
              disabled={!isOrderConfirmed}
              size="sm" 
              className={`gap-1.5 font-medium shadow-sm ${
                isOrderConfirmed 
                  ? "bg-gray-900 hover:bg-black text-white" 
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 hover:bg-gray-100"
              }`}
              title={!isOrderConfirmed ? "Order must be completed/confirmed before issuing invoice" : ""}
            >
              <FiFileText className="h-4 w-4" /> Generate Final Invoice
            </Button>
          )}

          <Button 
            onClick={() => setIsDeleteOpen(true)}
            variant="outline" 
            size="sm" 
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shadow-sm font-medium"
          >
            <FiTrash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* 1. ORDER & CLIENT OVERVIEW BANNER */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-gray-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Work Order</span>
                <h1 className="text-2xl font-bold text-gray-900">{order.orderNo}</h1>
                {getStatusBadge(order.productionStatus)}
                {order.styleNo && (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                    Style: {order.styleNo}
                  </Badge>
                )}
                {order.saleInvoice && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-semibold">
                    Invoiced: {order.saleInvoice.saleNumber}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Created on {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Quick Stats Summary */}
            <div className="flex items-center gap-6 divide-x divide-gray-200 text-center">
              <div>
                <span className="text-xs text-gray-500 font-medium block">Target Qty</span>
                <span className="text-xl font-bold text-gray-900">{targetQty} {order.unit || "Pcs"}</span>
              </div>
              <div className="pl-6">
                <span className="text-xs text-gray-500 font-medium block">Total Produced</span>
                <span className="text-xl font-bold text-emerald-600">{currentProduced} {order.unit || "Pcs"}</span>
              </div>
              <div className="pl-6">
                <span className="text-xs text-gray-500 font-medium block">Delivered</span>
                <span className="text-xl font-bold text-blue-600">{totalDelivered} {order.unit || "Pcs"}</span>
              </div>
              <div className="pl-6">
                <span className="text-xs text-gray-500 font-medium block">Rate / Pc</span>
                <span className="text-xl font-bold text-gray-900">৳{unitPrice}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 text-sm">
            {/* Client Details */}
            <div className="bg-gray-50/70 p-4 rounded-lg border border-gray-100 space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Client / Customer</span>
              <span className="text-base font-bold text-gray-900 block">{order.client?.name || "N/A"}</span>
              {order.client?.phone && <span className="text-xs text-gray-600 block">Phone: {order.client.phone}</span>}
              {order.client?.company && <span className="text-xs text-gray-500 block">{order.client.company}</span>}
            </div>

            {/* Product / Garment Details */}
            <div className="bg-gray-50/70 p-4 rounded-lg border border-gray-100 space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Ready Product / Style</span>
              <span className="text-base font-bold text-gray-900 block">
                {order.orderTitle || order.item?.name || "Ready Garment"}
              </span>
              {order.item?.code && <span className="text-xs text-gray-600 block">Item Code: {order.item.code}</span>}
            </div>

            {/* Timeline & Details */}
            <div className="bg-gray-50/70 p-4 rounded-lg border border-gray-100 space-y-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">Delivery Deadline</span>
              <span className="text-base font-bold text-gray-900 block">
                {order.deliveryDeadline ? new Date(order.deliveryDeadline).toLocaleDateString() : "Not specified"}
              </span>
              {order.notes && (
                <span className="text-xs text-gray-500 block truncate" title={order.notes}>
                  Notes: {order.notes}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLUMNS: PRODUCTION BATCH MANAGER & RAW MATERIALS STOCK */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. PRODUCTION BATCH MANAGER & TIMELINE */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FiTrendingUp className="text-gray-700" /> Production Output & Batch Progress
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">
                    Log daily batches completed from cutting & sewing. Keep track of individual production runs.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={() => setIsBatchOpen(true)}
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 shadow-sm"
                  >
                    <FiPlus className="w-3.5 h-3.5" /> Log Batch Output
                  </Button>
                </div>
              </div>

              {/* Progress Bar & Summary Pill */}
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">
                    Production Progress: <strong className="text-gray-900">{currentProduced}</strong> of {targetQty} {order.unit || "Pcs"}
                  </span>
                  <span className={`font-bold ${isFinalized ? "text-emerald-600" : "text-gray-900"}`}>
                    {isFinalized ? "100% Complete" : `${progressPercent}% Complete`}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      isFinalized || progressPercent >= 100
                        ? "bg-emerald-500" 
                        : "bg-gray-900"
                    }`}
                    style={{ width: isFinalized ? "100%" : `${Math.min(100, progressPercent)}%` }}
                  ></div>
                </div>

                {/* Sub stats */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Target: <strong>{targetQty}</strong></span>
                  <span>Remaining: <strong className={isFinalized || remainingQty === 0 ? "text-emerald-600" : "text-amber-600"}>
                    {isFinalized ? `0 ${order.unit || "Pcs"} (Finalized)` : `${remainingQty} ${order.unit || "Pcs"}`}
                  </strong></span>
                  <span>Total Defects / Rejected: <strong className="text-red-600">{order.rejectedQuantity || 0}</strong></span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Batch History Timeline Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <FiClock className="text-gray-500" /> Production Batch History Cards ({order.productionEntries?.length || 0})
                  </h4>
                  <span className="text-[11px] text-gray-400">
                    Individual recorded output entries
                  </span>
                </div>

                {(!order.productionEntries || order.productionEntries.length === 0) ? (
                  <div className="p-8 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200 space-y-2">
                    <FiBox className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs font-semibold text-gray-700">No daily production batches logged yet</p>
                    <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                      Click <strong>"Log Batch Output"</strong> above each time a quantity (e.g. 20 pcs, 50 pcs) is finished on the production line.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {order.productionEntries.map((entry: any) => (
                      <div 
                        key={entry.id} 
                        className="p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200 font-mono text-[11px]">
                            {entry.entryNo}
                          </Badge>
                          <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <FiCalendar className="w-3 h-3 text-gray-400" />
                            {new Date(entry.productionDate).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
                          <div>
                            <span className="text-[11px] text-gray-400 block font-medium">Batch Output</span>
                            <span className="text-lg font-bold text-emerald-600">
                              +{entry.producedQty} <span className="text-xs font-normal text-gray-600">{order.unit || "Pcs"}</span>
                            </span>
                          </div>

                          {entry.rejectedQty > 0 && (
                            <div className="text-right">
                              <span className="text-[11px] text-gray-400 block font-medium">Defects</span>
                              <span className="text-xs font-semibold text-red-600">
                                {entry.rejectedQty} pcs
                              </span>
                            </div>
                          )}
                        </div>

                        {entry.shiftOrLine && (
                          <div className="text-[11px] text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                            <strong>Line/Shift:</strong> {entry.shiftOrLine}
                          </div>
                        )}

                        {entry.notes && (
                          <p className="text-[11px] text-gray-500 italic truncate" title={entry.notes}>
                            "{entry.notes}"
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                          <span>By: {entry.createdByUser?.name || "Production Line"}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(entry.id)}
                            disabled={deletingBatchId === entry.id}
                            className="text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 font-medium hover:underline"
                          >
                            <FiTrash2 className="w-3 h-3" />
                            {deletingBatchId === entry.id ? "Deleting..." : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Quick Adjustment Collapsible Form */}
              <div className="border-t border-gray-100 pt-4">
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center justify-between list-none">
                    <span>⚙️ Direct Quick Adjustment (Manual Total Override)</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  
                  <div className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">Total Completed Qty *</Label>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 font-bold text-sm"
                          value={producedQty}
                          onChange={(e) => setProducedQty(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">Total Defect Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          className="h-9 font-bold text-sm text-red-600"
                          value={rejectedQty}
                          onChange={(e) => setRejectedQty(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-700">Order Status</Label>
                        <select
                          className="w-full h-9 px-3 rounded-md border border-gray-300 text-xs bg-white text-gray-900 font-medium"
                          value={prodStatus}
                          onChange={(e) => setProdStatus(e.target.value as WorkOrderStatus)}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="MATERIAL_RECEIVED">Material Received</option>
                          <option value="IN_PRODUCTION">In Production</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DELIVERED">Delivered</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-700">Overall Production Notes</Label>
                      <textarea
                        className="w-full p-2 rounded-md border border-gray-300 text-xs bg-white text-gray-900"
                        rows={2}
                        value={prodNotes}
                        onChange={(e) => setProdNotes(e.target.value)}
                        placeholder="Overall notes..."
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        size="sm" 
                        onClick={handleSaveProduction} 
                        disabled={isUpdatingProd} 
                        className="gap-1.5 bg-gray-900 hover:bg-black text-white text-xs"
                      >
                        <FiCheckCircle className="w-3.5 h-3.5" />
                        {isUpdatingProd ? "Saving..." : "Save Manual Adjustment"}
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>

          {/* 3. ORDER RAW MATERIALS BALANCE (Stock In vs Stock Out) */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FiLayers className="text-gray-700" /> Raw Materials Stock Balance
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">
                    Comparison of received raw materials (Stock In) vs materials issued for production (Stock Out).
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/dashboard/inventory/stock-in/add">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm font-medium">
                      <FiPlus /> New Stock In
                    </Button>
                  </Link>
                  <Link href={`/dashboard/inventory/stock-out/add?workOrderId=${order.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50 shadow-sm font-medium">
                      <FiArrowUpRight /> New Stock Out
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Assigned Raw Materials Badges */}
              {order.rawMaterials && order.rawMaterials.length > 0 && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <FiCheckCircle className="text-emerald-600" /> Assigned Raw Materials for this Order ({order.rawMaterials.length}):
                    </span>
                    <Link href="/dashboard/inventory/stock-in/add">
                      <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 border-emerald-300 bg-white hover:bg-emerald-100 text-emerald-800 font-medium px-2 py-0">
                        Stock In Materials
                      </Button>
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {order.rawMaterials.map((rm: any) => (
                      <span key={rm.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                        {rm.item?.name} {rm.item?.code ? `(${rm.item.code})` : ""} {rm.item?.unit?.symbol ? `• ${rm.item.unit.symbol}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials Balance Summary Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                  Summary per Raw Material
                </h4>
                {materialSummary.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50/60 rounded-lg border border-dashed border-gray-200 text-xs text-gray-500">
                    No raw materials linked to this order yet. Use <strong>Stock In</strong> to receive materials for this order.
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden text-xs bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold">
                        <tr>
                          <th className="p-3">Raw Material Item</th>
                          <th className="p-3 text-right">Total Stock In (Received)</th>
                          <th className="p-3 text-right">Total Stock Out (Issued)</th>
                          <th className="p-3 text-right">Available Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-800">
                        {materialSummary.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-3 font-semibold text-gray-900">
                              {item.itemName}
                              {item.itemCode && <span className="text-[11px] text-gray-400 block font-normal">{item.itemCode}</span>}
                            </td>
                            <td className="p-3 text-right font-medium text-blue-700">
                              +{item.totalIn} {item.unit}
                            </td>
                            <td className="p-3 text-right font-medium text-amber-700">
                              -{item.totalOut} {item.unit}
                            </td>
                            <td className="p-3 text-right font-bold text-gray-900">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                item.balance > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600"
                              }`}>
                                {item.balance} {item.unit}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail Logs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Stock In Log */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                      <FiArrowDownLeft className="text-blue-600" /> Stock In Receipts ({order.materialsIn?.length || 0})
                    </span>
                  </div>
                  {(!order.materialsIn || order.materialsIn.length === 0) ? (
                    <p className="text-[11px] text-gray-400 italic py-2">No Stock In records</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {order.materialsIn.map((mat: any) => (
                        <div key={mat.id} className="p-2 bg-white border border-gray-200 rounded text-xs flex justify-between items-center shadow-2xs">
                          <div>
                            <div className="font-semibold text-gray-900">{mat.item?.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {mat.inwardNo} • {new Date(mat.receivedDate).toLocaleDateString()}
                              {mat.fabricRollNo && ` • Roll #${mat.fabricRollNo}`}
                            </div>
                          </div>
                          <span className="font-bold text-blue-700">+{Number(mat.quantity)} {mat.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stock Out Log */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <FiArrowUpRight className="text-amber-600" /> Stock Out Issuances ({order.materialsOut?.length || 0})
                    </span>
                  </div>
                  {(!order.materialsOut || order.materialsOut.length === 0) ? (
                    <p className="text-[11px] text-gray-400 italic py-2">No Stock Out records</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {order.materialsOut.map((mat: any) => (
                        <div key={mat.id} className="p-2 bg-white border border-gray-200 rounded text-xs flex justify-between items-center shadow-2xs">
                          <div>
                            <div className="font-semibold text-gray-900">{mat.item?.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {mat.outwardNo} • {new Date(mat.issuedDate).toLocaleDateString()}
                            </div>
                          </div>
                          <span className="font-bold text-amber-700">-{Number(mat.quantity)} {mat.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT 1 COLUMN: DELIVERY CHALLANS & INVOICE / BILLING SETTLEMENT */}
        <div className="space-y-6">

          {/* 4. FINAL INVOICE & ACCOUNTS BILLING CARD */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FiDollarSign className="text-gray-700" /> Billing & Sales Invoice
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 mt-0.5">
                Client ledger settlement & official invoice generation.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {order.saleInvoice ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">
                      Invoice Generated
                    </span>
                    <Badge className="bg-emerald-600 text-white font-mono text-xs">
                      {order.saleInvoice.saleNumber}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Grand Total:</span>
                      <strong className="text-emerald-950 text-sm">৳{Number(order.saleInvoice.grandTotal || 0).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Invoice Status:</span>
                      <span className="font-semibold text-emerald-800">{order.saleInvoice.status}</span>
                    </div>
                    {order.saleInvoice.voucher && (
                      <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                        <span className="text-gray-600">Accounts Voucher:</span>
                        <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-mono text-[10px]">
                          {order.saleInvoice.voucher.voucherNumber || "Posted"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <Button 
                      onClick={() => handleDirectPrintInvoice(order.saleInvoice.id)}
                      disabled={isPrintingInvoice}
                      size="sm" 
                      className="w-full gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium shadow-sm"
                    >
                      <FiPrinter className="w-3.5 h-3.5" /> 
                      {isPrintingInvoice ? "Opening Print..." : "Print Invoice"}
                    </Button>
                    <Link href="/dashboard/accounts/vouchers" className="text-center text-[11px] text-emerald-800 hover:text-emerald-950 hover:underline font-medium">
                      View in Accounts Ledger →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Target Quantity:</span>
                      <strong className="text-gray-900">{targetQty} pcs</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Actual Output (Delivered/Produced):</span>
                      <strong className="text-emerald-700">{billingQty} pcs</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Unit Rate:</span>
                      <strong className="text-gray-900">৳{unitPrice} / pc</strong>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 text-sm">
                      <span className="font-bold text-gray-900">Billable Amount:</span>
                      <strong className="text-emerald-700 font-bold">৳{totalBillableAmount.toLocaleString()}</strong>
                    </div>
                  </div>

                  {!isOrderConfirmed ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-900">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          Order Not Confirmed / Completed
                        </div>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          This order is currently <strong>{order.productionStatus}</strong>. Please finish production batches or click <strong>Complete / Close</strong> at the top to confirm and finalize this order before generating the invoice.
                        </p>
                      </div>

                      <Button
                        disabled
                        className="w-full gap-2 bg-gray-100 text-gray-400 border border-gray-200 text-xs font-medium h-9 cursor-not-allowed hover:bg-gray-100"
                        title="Order must be completed or confirmed first"
                      >
                        <FiFileText className="w-4 h-4" />
                        Generate Final Invoice & Settle
                      </Button>
                    </div>
                  ) : (
                    <>
                      {currentProduced < targetQty && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                          <FiInfo className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            Target was {targetQty} pcs, but {currentProduced} pcs produced. Final invoice will be calculated exactly on <strong>{billingQty} pcs</strong>.
                          </span>
                        </div>
                      )}

                      <Button
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="w-full gap-2 bg-gray-900 hover:bg-black text-white text-xs font-medium h-9 shadow-sm"
                      >
                        <FiFileText className="w-4 h-4" />
                        Generate Final Invoice & Settle
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. DELIVERY CHALLANS */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FiTruck className="text-gray-700" /> Delivery Challans
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">
                    Dispatched finished goods to customer.
                  </CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs gap-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  onClick={() => {
                    setDeliveryData((prev) => ({
                      ...prev,
                      deliveredQty: Math.max(0, currentProduced - totalDelivered),
                    }));
                    setIsDeliveryOpen(true);
                  }}
                >
                  <FiPlus /> New Challan
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-500 font-medium">Delivered / Target:</span>
                <span className="font-bold text-gray-900">
                  {totalDelivered} / {order.targetQuantity} pcs
                </span>
              </div>

              {(!order.deliveries || order.deliveries.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  No delivery challans created yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {order.deliveries.map((del: any) => (
                    <div key={del.id} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center justify-between text-xs shadow-2xs">
                      <div>
                        <div className="font-bold text-gray-900">{del.challanNo}</div>
                        <div className="text-gray-500 mt-0.5">
                          Qty: <strong className="text-gray-800">{del.deliveredQty} pcs</strong> • {new Date(del.deliveryDate).toLocaleDateString()}
                        </div>
                        {del.vehicleNo && <div className="text-[11px] text-gray-400">Vehicle: {del.vehicleNo}</div>}
                      </div>

                      <Button 
                        onClick={() => handleDirectPrintChallan(del.id)}
                        disabled={printingChallanId === del.id}
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2.5 text-xs gap-1 text-gray-700 hover:text-black hover:bg-gray-100"
                      >
                        <FiPrinter className="w-3.5 h-3.5" /> 
                        {printingChallanId === del.id ? "Printing..." : "Print"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL 1: LOG DAILY / BATCH PRODUCTION OUTPUT */}
      <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiTrendingUp className="text-emerald-600" /> Log Production Batch Output
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Record completed pieces and rejected units from today's production run.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLogBatch} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Completed Qty (Pcs) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 20"
                  className="border-gray-300 font-bold text-sm focus:ring-gray-900"
                  value={batchData.producedQty || ""}
                  onChange={(e) => setBatchData({ ...batchData, producedQty: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Defects / Rejected (Pcs)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="border-gray-300 text-red-600 font-bold text-sm focus:border-red-500"
                  value={batchData.rejectedQty || ""}
                  onChange={(e) => setBatchData({ ...batchData, rejectedQty: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Production Date</Label>
                <Input
                  type="date"
                  value={batchData.productionDate}
                  onChange={(e) => setBatchData({ ...batchData, productionDate: e.target.value })}
                  className="border-gray-300 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Shift / Line (Optional)</Label>
                <Input
                  placeholder="e.g. Line 1 / Shift A"
                  value={batchData.shiftOrLine}
                  onChange={(e) => setBatchData({ ...batchData, shiftOrLine: e.target.value })}
                  className="border-gray-300 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Notes / Remarks</Label>
              <textarea
                className="w-full p-2.5 rounded-md border border-gray-300 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                rows={2}
                placeholder="e.g. Cutting finished, 20 t-shirts stitched and passed QC..."
                value={batchData.notes}
                onChange={(e) => setBatchData({ ...batchData, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBatchOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingBatch} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                {isSubmittingBatch ? "Logging Output..." : "Save Batch Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: COMPLETE / SHORT-CLOSE ORDER */}
      <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiCheckSquare className="text-amber-600" /> Complete / Close Work Order
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Lock production output and mark this order as Completed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-900">
              <div className="font-semibold flex items-center gap-1.5">
                <FiInfo className="text-amber-700" /> Order Summary upon Closing:
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800">
                <li>Target Quantity: <strong>{targetQty} {order.unit || "Pcs"}</strong></li>
                <li>Actual Produced Output: <strong>{currentProduced} {order.unit || "Pcs"}</strong></li>
                {currentProduced < targetQty && (
                  <li className="text-red-700 font-semibold">
                    Short-closing at {currentProduced} pcs (Deficit of {targetQty - currentProduced} pcs).
                  </li>
                )}
                <li>Final invoicing will bill the client for the actual <strong>{currentProduced} pcs</strong>.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Closing Reason / Remarks</Label>
              <textarea
                className="w-full p-2.5 rounded-md border border-gray-300 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                rows={2}
                placeholder="e.g. Raw materials finished, order finalized at 800 pcs..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCloseModalOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button 
                onClick={handleCloseOrder} 
                disabled={isClosingOrder} 
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                {isClosingOrder ? "Closing Order..." : "Confirm & Complete Order"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: GENERATE FINAL SALES INVOICE */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiFileText className="text-emerald-600" /> Generate Final Sales Invoice
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Create official wholesale sales invoice & post to client ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Client / Customer:</span>
                <strong className="text-gray-900">{order.client?.name}</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Garment / Style:</span>
                <strong className="text-gray-900">{order.orderTitle || order.item?.name}</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Billing Quantity (Actual):</span>
                <strong className="text-emerald-700">{billingQty} pcs</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Unit Rate:</span>
                <strong className="text-gray-900">৳{unitPrice}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm">
                <span className="font-bold text-gray-900">Grand Total Invoice:</span>
                <strong className="text-emerald-700 font-bold">৳{totalBillableAmount.toLocaleString()}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Invoice Remarks (Optional)</Label>
              <textarea
                className="w-full p-2.5 rounded-md border border-gray-300 text-xs bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                rows={2}
                placeholder="Notes to appear on invoice..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsInvoiceModalOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateInvoice} 
                disabled={isGeneratingInvoice} 
                className="bg-gray-900 hover:bg-black text-white font-medium"
              >
                {isGeneratingInvoice ? "Generating..." : "Confirm & Issue Invoice"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CREATE DELIVERY CHALLAN */}
      <Dialog open={isDeliveryOpen} onOpenChange={setIsDeliveryOpen}>
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FiTruck className="text-gray-700" /> Create Delivery Challan
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Dispatch completed goods to client with gate pass details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDelivery} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Quantity to Deliver (Pcs) *</Label>
              <Input
                type="number"
                min="1"
                max={Math.max(1, currentProduced)}
                value={deliveryData.deliveredQty}
                onChange={(e) => setDeliveryData({ ...deliveryData, deliveredQty: Number(e.target.value) })}
                required
                className="border-gray-300 focus:ring-gray-900"
              />
              <span className="text-[11px] text-gray-500 block">
                Produced ready to dispatch: {Math.max(0, currentProduced - totalDelivered)} pcs
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Driver / Carrier Name</Label>
                <Input
                  placeholder="e.g. Driver Name"
                  value={deliveryData.driverName}
                  onChange={(e) => setDeliveryData({ ...deliveryData, driverName: e.target.value })}
                  className="border-gray-300"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Vehicle / Truck No</Label>
                <Input
                  placeholder="e.g. DHA-11-2345"
                  value={deliveryData.vehicleNo}
                  onChange={(e) => setDeliveryData({ ...deliveryData, vehicleNo: e.target.value })}
                  className="border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Delivery Notes</Label>
              <textarea
                className="w-full p-2.5 rounded-md border border-gray-300 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                rows={2}
                placeholder="Gate pass instructions, carton count..."
                value={deliveryData.notes}
                onChange={(e) => setDeliveryData({ ...deliveryData, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDeliveryOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button type="submit" disabled={isDelivering} className="bg-gray-900 hover:bg-black text-white">
                {isDelivering ? "Creating..." : "Generate Challan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: DELETE CONFIRMATION */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <FiAlertCircle className="h-5 w-5" /> Delete Work Order
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Are you sure you want to delete work order <strong className="text-gray-900">{order.orderNo}</strong>? This action will remove it from active orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isDeletingOrder} className="border-gray-300">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder} disabled={isDeletingOrder} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeletingOrder ? "Deleting..." : "Yes, Delete Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
