"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FiArrowLeft, FiCheckCircle, FiClock, FiTruck, 
  FiAlertCircle, FiTrendingUp, FiUser, FiBox, 
  FiPlus, FiPrinter, FiEdit2, FiPackage, FiTrash2,
  FiArrowDownLeft, FiArrowUpRight, FiLayers
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
  deleteWorkOrder
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

  // In-Order Production Update State
  const [producedQty, setProducedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [prodStatus, setProdStatus] = useState<WorkOrderStatus>(WorkOrderStatus.PENDING);
  const [prodNotes, setProdNotes] = useState<string>("");
  const [isUpdatingProd, setIsUpdatingProd] = useState(false);

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

  // Direct in-order production update handler
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
  const progressPercent = Math.min(100, Math.round((producedQty / targetQty) * 100));
  const remainingQty = Math.max(0, targetQty - producedQty);
  const totalDelivered = (order.deliveries || []).reduce((sum: number, d: any) => sum + Number(d.deliveredQty || 0), 0);

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
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Completed</Badge>;
      case "IN_PRODUCTION":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">In Production</Badge>;
      case "MATERIAL_RECEIVED":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50">Material Received</Badge>;
      case "DELIVERED":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100">Delivered</Badge>;
      default:
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">Pending</Badge>;
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

          <Button 
            onClick={() => {
              setDeliveryData((prev) => ({
                ...prev,
                deliveredQty: Math.max(0, producedQty - totalDelivered),
              }));
              setIsDeliveryOpen(true);
            }} 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm font-medium"
          >
            <FiTruck className="h-4 w-4 text-gray-500" /> Create Delivery Challan
          </Button>

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

      {/* 1. ORDER & CLIENT OVERVIEW BANNER (Clean White) */}
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
                <span className="text-xs text-gray-500 font-medium block">Produced</span>
                <span className="text-xl font-bold text-emerald-600">{producedQty} {order.unit || "Pcs"}</span>
              </div>
              <div className="pl-6">
                <span className="text-xs text-gray-500 font-medium block">Remaining</span>
                <span className="text-xl font-bold text-amber-600">{remainingQty} {order.unit || "Pcs"}</span>
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
        {/* LEFT 2 COLUMNS: PRODUCTION UPDATE & RAW MATERIALS STOCK */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. DIRECT IN-ORDER PRODUCTION MANAGER */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <FiTrendingUp className="text-gray-700" /> Production Output & Progress
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-500 mt-0.5">
                    Update completed pieces and defects produced from this order's raw materials.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                  {progressPercent}% Complete
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mt-3">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    progressPercent >= 100 ? "bg-emerald-500" : "bg-gray-900"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Produced Quantity */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Completed Qty (Pcs) *
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="px-2.5 h-10 border-gray-300 hover:bg-gray-100"
                      onClick={() => setProducedQty(Math.max(0, Number(producedQty) - 10))}
                    >
                      -10
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      className="text-center font-bold text-base h-10 border-gray-300 focus:border-gray-900 focus:ring-gray-900"
                      value={producedQty}
                      onChange={(e) => setProducedQty(Number(e.target.value))}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="px-2.5 h-10 border-gray-300 hover:bg-gray-100"
                      onClick={() => setProducedQty(Number(producedQty) + 10)}
                    >
                      +10
                    </Button>
                  </div>
                  <span className="text-[11px] text-gray-500 block text-center">
                    Target: {order.targetQuantity} pcs
                  </span>
                </div>

                {/* Rejected Quantity */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Defects / Rejection (Pcs)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-10 text-center font-bold text-base text-red-600 border-gray-300 focus:border-red-500"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-gray-500 block text-center">
                    Damaged items
                  </span>
                </div>

                {/* Production Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Production Status *
                  </Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                    value={prodStatus}
                    onChange={(e) => setProdStatus(e.target.value as WorkOrderStatus)}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="MATERIAL_RECEIVED">Material Received</option>
                    <option value="IN_PRODUCTION">In Production</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                  <span className="text-[11px] text-gray-500 block text-center">
                    Workflow stage
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Production Notes / Remarks
                </Label>
                <textarea
                  className="w-full p-2.5 rounded-md border border-gray-300 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  rows={2}
                  placeholder="e.g. 150 pcs completed, final finishing underway..."
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button 
                  onClick={handleSaveProduction} 
                  disabled={isUpdatingProd} 
                  className="gap-2 px-6 bg-gray-900 hover:bg-black text-white font-medium shadow-sm"
                >
                  <FiCheckCircle className="w-4 h-4" />
                  {isUpdatingProd ? "Saving..." : "Save Production Output"}
                </Button>
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
                <Link href="/dashboard/inventory/stock-in/add">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm font-medium">
                    <FiPlus /> New Stock In
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
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

        {/* RIGHT 1 COLUMN: DELIVERY CHALLANS */}
        <div className="space-y-6">
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
                      deliveredQty: Math.max(0, producedQty - totalDelivered),
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

                      <Link href={`/print/delivery-challan/${del.id}`} target="_blank">
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs gap-1 text-gray-700 hover:text-black hover:bg-gray-100">
                          <FiPrinter className="w-3.5 h-3.5" /> Print
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CREATE DELIVERY CHALLAN MODAL */}
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
                max={Math.max(1, producedQty)}
                value={deliveryData.deliveredQty}
                onChange={(e) => setDeliveryData({ ...deliveryData, deliveredQty: Number(e.target.value) })}
                required
                className="border-gray-300 focus:ring-gray-900"
              />
              <span className="text-[11px] text-gray-500 block">
                Produced ready to dispatch: {Math.max(0, producedQty - totalDelivered)} pcs
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

      {/* DELETE CONFIRMATION MODAL */}
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
