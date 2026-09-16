"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FiPlus, FiSearch, FiPackage, FiCheckCircle, FiInbox, 
  FiTruck, FiLayers, FiTrash2, FiUser, FiHome, FiTag, FiBox, FiEdit2
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { getStockInList, deleteStockIn } from "./_actions/stock-in.action";
import { toast } from "sonner";
import { MaterialInwardSource } from "@prisma/client";

export default function StockInPage() {
  const [inwards, setInwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; inwardNo: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    const res = await getStockInList({ search, source: sourceFilter });
    if (res.success && res.inwards) {
      setInwards(res.inwards);
    } else {
      toast.error(res.error || "Failed to load stock inward list");
    }
    setLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await deleteStockIn(deleteTarget.id);
      if (res.success) {
        toast.success(`Stock Inward record (${deleteTarget.inwardNo}) deleted successfully.`);
        setDeleteTarget(null);
        fetchList();
      } else {
        toast.error(res.error || "Failed to delete stock inward record.");
      }
    } catch (err: any) {
      toast.error("An error occurred while deleting.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [sourceFilter]);

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <FiInbox className="text-primary" />
            Stock In Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Receive raw materials like fabrics, buttons, sewing threads, zippers, and trims against client orders or purchase.
          </p>
        </div>

        <Link href="/dashboard/inventory/stock-in/add">
          <Button className="gap-2 shadow-sm">
            <FiPlus className="text-lg" />
            Record Stock In
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by Inward #, Roll #, Item name, or Order #..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Filter by material source"
                className="h-9 px-3 rounded-md border text-sm bg-background text-foreground"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="ALL">All Sources</option>
                <option value="CLIENT_SUPPLIED">Client Stock In (Supplied)</option>
                <option value="PURCHASE">Purchase (Supplier)</option>
              </select>

              <Button variant="secondary" size="sm" onClick={fetchList}>
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inward List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-2"></div>
          <p>Loading inward records...</p>
        </div>
      ) : inwards.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FiPackage className="mx-auto text-4xl text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">No Stock In Records Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            Receive raw materials like fabrics, buttons, sewing threads, zippers, or trims against client orders.
          </p>
          <Link href="/dashboard/inventory/stock-in/add">
            <Button variant="outline" className="gap-2">
              <FiPlus /> Record First Inward
            </Button>
          </Link>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Inward #</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Raw Material / Item</th>
                  <th className="p-3.5">Specifications & Lot/Roll</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Linked Order</th>
                  <th className="p-3.5">Received Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inwards.map((inw) => {
                  const category = inw.materialCategory || (inw.fabricRollNo ? "FABRIC" : "RAW_MATERIAL");
                  return (
                    <tr key={inw.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-bold text-primary">{inw.inwardNo}</td>
                      
                      {/* Category Badge */}
                      <td className="p-3.5">
                        <Badge variant="outline" className="text-[11px] font-medium uppercase tracking-wider">
                          {category}
                        </Badge>
                      </td>

                      {/* Source */}
                      <td className="p-3.5">
                        {inw.source === "CLIENT_SUPPLIED" ? (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                            Client Supplied
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            Purchase
                          </Badge>
                        )}
                      </td>

                      {/* Material Name / Master Item */}
                      <td className="p-3.5">
                        <span className="font-semibold text-gray-900 dark:text-white block">
                          {inw.materialName || inw.item?.name}
                        </span>
                        {inw.materialName && inw.item?.name && inw.materialName !== inw.item.name && (
                          <span className="text-xs text-muted-foreground block">
                            Item: {inw.item.name} ({inw.item.code})
                          </span>
                        )}
                      </td>

                      {/* Specs / Roll / Lot */}
                      <td className="p-3.5 text-xs text-gray-700 dark:text-gray-300">
                        {inw.specs || (inw.fabricRollNo ? `Roll #${inw.fabricRollNo}` : inw.notes || "-")}
                        {inw.challanNo && (
                          <span className="text-[11px] text-muted-foreground block">
                            Challan: {inw.challanNo}
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        {Number(inw.quantity)} {inw.unit}
                      </td>

                      {/* Linked Work Order */}
                      <td className="p-3.5 text-xs">
                        {inw.workOrder ? (
                          <Link href={`/dashboard/orders/${inw.workOrder.id}`} className="text-primary hover:underline font-semibold block">
                            {inw.workOrder.orderNo}
                            {inw.workOrder.styleNo && (
                              <span className="text-muted-foreground font-normal block">
                                Style: {inw.workOrder.styleNo}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">General Inventory</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-xs text-muted-foreground">
                        {new Date(inw.receivedDate).toLocaleDateString()}
                      </td>

                      {/* Actions (Edit & Delete) */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/inventory/stock-in/${inw.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="Edit Inward"
                            >
                              <FiEdit2 className="h-4 w-4" />
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget({ id: inw.id, inwardNo: inw.inwardNo })}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            title="Delete Inward"
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
        </Card>
      )}

      {/* Modern In-App Confirm Delete Modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Stock Inward Record"
        description={`Are you sure you want to delete Stock Inward record "${deleteTarget?.inwardNo}"? This will automatically revert and deduct the stocked quantities from inventory.`}
        confirmText="Delete Record"
        cancelText="Cancel"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
