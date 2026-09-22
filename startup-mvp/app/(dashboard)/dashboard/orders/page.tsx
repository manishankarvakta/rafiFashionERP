"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FiPlus, FiSearch, FiLayers, FiCheckCircle, FiClock, FiTruck, 
  FiFileText, FiAlertCircle, FiTrendingUp, FiUser, FiBox, FiArrowRight,
  FiScissors, FiTag, FiEdit2, FiTrash2
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getWorkOrders, deleteWorkOrder } from "./_actions/work-order.action";
import { toast } from "sonner";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const res = await getWorkOrders({ search, status: statusFilter });
    if (res.success && res.orders) {
      setOrders(res.orders);
    } else {
      toast.error(res.error || "Failed to load orders");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteWorkOrder(deleteTarget.id);
    if (res.success) {
      toast.success(`Work Order ${deleteTarget.orderNo} deleted successfully.`);
      setDeleteTarget(null);
      fetchOrders();
    } else {
      toast.error(res.error || "Failed to delete work order.");
    }
    setIsDeleting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "MATERIAL_RECEIVED":
        return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">Material Received</Badge>;
      case "IN_PRODUCTION":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">In Production</Badge>;
      case "COMPLETED":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Completed</Badge>;
      case "DELIVERED":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">Delivered</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <FiLayers className="text-primary" />
            Client Work Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage custom client orders, in-order production tracking, delivery challans, and billing.
          </p>
        </div>

        <Link href="/dashboard/orders/add">
          <Button className="gap-2 shadow-sm">
            <FiPlus className="text-lg" />
            Create Work Order
          </Button>
        </Link>
      </div>

      {/* Quick Filter & Search Bar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by Order #, Title, Style #, Client name..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchOrders()}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Filter orders by status"
                className="h-9 px-3 rounded-md border text-sm bg-background text-foreground"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="MATERIAL_RECEIVED">Material Received</option>
                <option value="IN_PRODUCTION">In Production</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELIVERED">Delivered</option>
              </select>

              <Button variant="secondary" size="sm" onClick={fetchOrders}>
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
          <p>Loading work orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FiBox className="mx-auto text-4xl text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">No Work Orders Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Create a new client work order to track materials, update production progress, and generate delivery challans.
          </p>
          <Link href="/dashboard/orders/add">
            <Button variant="outline" className="gap-2">
              <FiPlus /> Create First Order
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => {
            const isFinalized = Boolean(order.saleInvoice) || order.productionStatus === "COMPLETED" || order.productionStatus === "DELIVERED";
            const producedQty = Number(order.producedQuantity || 0);
            const targetQty = Number(order.targetQuantity || 1);
            const progressPercent = Math.min(100, Math.round((producedQty / targetQty) * 100));
            const totalDelivered = (order.deliveries || []).reduce((sum: number, d: any) => sum + Number(d.deliveredQty || 0), 0);
            const displayTitle = order.orderTitle || order.item?.name || "Custom Work Order";
            const unitSymbol = order.unit || order.item?.unit?.symbol || "Pcs";
            const effectiveOutputQty = producedQty > 0 ? producedQty : (totalDelivered > 0 ? totalDelivered : targetQty);
            const finalTotalAmount = order.saleInvoice?.grandTotal 
              ? Number(order.saleInvoice.grandTotal) 
              : (isFinalized ? effectiveOutputQty * Number(order.unitPrice || 0) : Number(order.totalAmount || 0));

            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow border">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Order Details */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-base text-primary">{order.orderNo}</span>
                        {getStatusBadge(order.productionStatus)}
                        {order.styleNo && (
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">
                            Style: {order.styleNo}
                          </Badge>
                        )}
                        {order.saleInvoice && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            Invoiced: {order.saleInvoice.saleNumber}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-4 flex-wrap">
                        <span className="font-medium flex items-center gap-1">
                          <FiUser className="text-gray-400" />
                          {order.client?.name || "Unknown Client"}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {displayTitle}
                        </span>
                        <span>•</span>
                        {isFinalized ? (
                          <>
                            <span>
                              Output: <strong className="text-gray-900 dark:text-white">{effectiveOutputQty} {unitSymbol}</strong>
                              {targetQty !== effectiveOutputQty && (
                                <span className="text-xs text-muted-foreground ml-1">(Target: {targetQty})</span>
                              )}
                            </span>
                            <span>•</span>
                            <span>Rate: <strong>৳{Number(order.unitPrice).toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">৳{finalTotalAmount.toFixed(2)}</strong></span>
                          </>
                        ) : (
                          <>
                            <span>Target: <strong className="text-gray-900 dark:text-white">{order.targetQuantity} {unitSymbol}</strong></span>
                            <span>•</span>
                            <span>Rate: <strong>৳{Number(order.unitPrice).toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">৳{Number(order.totalAmount).toFixed(2)}</strong></span>
                          </>
                        )}
                      </div>

                      {(order.fabricDetails || order.colorSpecs) && (
                        <div className="text-xs text-muted-foreground flex items-center gap-3 pt-0.5 flex-wrap">
                          {order.fabricDetails && (
                            <span className="flex items-center gap-1">
                              <FiScissors className="text-primary/70" /> Fabric: {order.fabricDetails}
                            </span>
                          )}
                          {order.colorSpecs && (
                            <span className="flex items-center gap-1">
                              <FiTag className="text-primary/70" /> Colors: {order.colorSpecs.split("\n")[0]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Live Production Progress Bar */}
                    <div className="w-full lg:w-72 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-medium text-gray-600 dark:text-gray-300">Production Output</span>
                        {isFinalized ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {effectiveOutputQty} {unitSymbol} (100% Complete)
                          </span>
                        ) : (
                          <span className="font-bold text-gray-900 dark:text-white">
                            {producedQty} / {targetQty} {unitSymbol} ({progressPercent}%)
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            isFinalized || progressPercent >= 100 ? "bg-emerald-500" : "bg-primary"
                          }`}
                          style={{ width: isFinalized ? "100%" : `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                        <span>Delivered: {totalDelivered} {unitSymbol}</span>
                        <span>Materials In: {order.materialsIn?.length || 0} batches</span>
                      </div>
                    </div>

                    {/* Action Buttons: Manage, Edit, Delete */}
                    <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                      <Link href={`/dashboard/orders/${order.id}`}>
                        <Button variant="default" size="sm" className="gap-1.5 shadow-sm">
                          Manage <FiArrowRight />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/orders/${order.id}/edit`}>
                        <Button variant="outline" size="sm" className="gap-1 text-gray-700 dark:text-gray-200">
                          <FiEdit2 className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDeleteTarget(order)}
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 text-red-600">
              <FiAlertCircle className="h-5 w-5" /> Delete Work Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete work order <strong className="text-gray-900 dark:text-white">{deleteTarget?.orderNo}</strong>? This action will remove it from active orders.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOrder} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Yes, Delete Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
