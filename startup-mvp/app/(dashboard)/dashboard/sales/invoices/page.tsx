"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  FiFileText, FiPrinter, FiLayers, FiDollarSign, FiBox, 
  FiCheckCircle, FiClock, FiSearch, FiCalendar, FiFilter,
  FiRotateCw, FiExternalLink, FiUser, FiArrowRight, FiActivity
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  getOrderInvoices, 
  syncOrderInvoiceVoucher, 
  getClientsForInvoiceFilter 
} from "./_actions/invoice.action";
import { toast } from "sonner";

export default function OrderInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("ALL");
  const [voucherStatus, setVoucherStatus] = useState<"ALL" | "POSTED" | "PENDING">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [kpi, setKpi] = useState({
    totalCount: 0,
    totalRevenue: 0,
    totalUnitsBilled: 0,
    vouchersPostedCount: 0,
  });

  const [clients, setClients] = useState<any[]>([]);
  const [syncingSaleId, setSyncingSaleId] = useState<string | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  // Fetch Clients dropdown
  useEffect(() => {
    async function loadClients() {
      const res = await getClientsForInvoiceFilter();
      if (res.success && res.clients) {
        setClients(res.clients);
      }
    }
    loadClients();
  }, []);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const res = await getOrderInvoices({
      page,
      limit,
      search,
      clientId,
      voucherStatus,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });

    if (res.success) {
      setInvoices(res.invoices || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
      setKpi(res.kpi || { totalCount: 0, totalRevenue: 0, totalUnitsBilled: 0, vouchersPostedCount: 0 });
    } else {
      toast.error(res.error || "Failed to load invoices");
    }
    setLoading(false);
  }, [page, limit, search, clientId, voucherStatus, dateFrom, dateTo]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Search Input (reset to page 1)
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setClientId("ALL");
    setVoucherStatus("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Direct iframe print invoice handler
  const handlePrintInvoice = (saleId: string) => {
    setPrintingSaleId(saleId);
    const oldIframe = document.getElementById("print-invoice-iframe");
    if (oldIframe) {
      oldIframe.remove();
    }

    (window as any).triggerIframePrint = () => {
      const iframeElement = document.getElementById("print-invoice-iframe") as HTMLIFrameElement;
      if (iframeElement && iframeElement.contentWindow) {
        iframeElement.contentWindow.focus();
        iframeElement.contentWindow.print();
      }
      setPrintingSaleId(null);
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

    iframe.onload = () => {
      setTimeout(() => {
        const iframeElement = document.getElementById("print-invoice-iframe") as HTMLIFrameElement;
        if (iframeElement && iframeElement.contentWindow && (window as any).triggerIframePrint) {
          iframeElement.contentWindow.focus();
          iframeElement.contentWindow.print();
          delete (window as any).triggerIframePrint;
          setPrintingSaleId(null);
        }
      }, 1500);
    };
  };

  // Sync Accounting Voucher Handler
  const handleSyncVoucher = async (saleId: string) => {
    setSyncingSaleId(saleId);
    const res = await syncOrderInvoiceVoucher(saleId);
    if (res.success) {
      toast.success("Accounting voucher created & posted successfully!");
      fetchInvoices();
    } else {
      toast.error(res.error || "Failed to post voucher");
    }
    setSyncingSaleId(null);
  };

  // Page Numbers helper for Pagination
  const getPageNumbers = (currentPage: number, totalPageCount: number) => {
    const pages: (number | string)[] = [];
    const windowSize = 1;
    pages.push(1);
    const startRange = Math.max(2, currentPage - windowSize);
    const endRange = Math.min(totalPageCount - 1, currentPage + windowSize);
    if (startRange > 2) pages.push("...");
    for (let i = startRange; i <= endRange; i++) pages.push(i);
    if (endRange < totalPageCount - 1) pages.push("...");
    if (totalPageCount > 1) pages.push(totalPageCount);
    return pages;
  };

  const startEntry = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, pagination.total);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-gray-50/50">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <FiFileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Order Sales Invoices</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Official sales invoices generated directly from completed and finalized client work orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/orders">
            <Button variant="outline" size="sm" className="gap-1.5 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-xs text-xs font-medium">
              <FiLayers className="w-3.5 h-3.5 text-gray-500" /> Work Orders
            </Button>
          </Link>
          <Link href="/dashboard/accounts/vouchers">
            <Button variant="outline" size="sm" className="gap-1.5 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-xs text-xs font-medium">
              <FiActivity className="w-3.5 h-3.5 text-gray-500" /> Accounts Ledger
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Invoices */}
        <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 block">Total Invoices</span>
              <span className="text-2xl font-bold text-gray-900 mt-0.5 block">
                {kpi.totalCount}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 block">From Work Orders</span>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <FiFileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Revenue */}
        <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 block">Total Invoiced Value</span>
              <span className="text-2xl font-bold text-emerald-600 mt-0.5 block">
                ৳{kpi.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-emerald-700 mt-0.5 block font-medium">Actual Billed Output</span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <FiDollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Finished Units */}
        <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 block">Finished Units Billed</span>
              <span className="text-2xl font-bold text-gray-900 mt-0.5 block">
                {kpi.totalUnitsBilled.toLocaleString()} <span className="text-xs font-normal text-gray-500">Pcs</span>
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 block">Manufactured Goods</span>
            </div>
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <FiBox className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Accounts Vouchers Posted */}
        <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500 block">Accounts Vouchers</span>
              <span className="text-2xl font-bold text-gray-900 mt-0.5 block">
                {kpi.vouchersPostedCount} <span className="text-xs font-normal text-gray-400">/ {kpi.totalCount}</span>
              </span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">
                {kpi.totalCount > 0 ? `${Math.round((kpi.vouchersPostedCount / kpi.totalCount) * 100)}% Synced to GL` : "0% Synced"}
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Filter and Search Controls */}
      <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search Invoice #, Order #, Client, Style..."
                className="pl-9 h-9 text-xs bg-gray-50/50 border-gray-200 focus:bg-white"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            {/* Client Filter */}
            <div>
              <select
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-xs bg-gray-50/50 focus:bg-white text-gray-800"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Voucher Status Filter */}
            <div>
              <select
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-xs bg-gray-50/50 focus:bg-white text-gray-800"
                value={voucherStatus}
                onChange={(e) => {
                  setVoucherStatus(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="ALL">All Accounting Status</option>
                <option value="POSTED">Voucher Posted</option>
                <option value="PENDING">Voucher Pending / Missing</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="w-full h-9 text-xs text-gray-600 hover:text-gray-900 border-gray-200"
              >
                <FiRotateCw className="w-3.5 h-3.5 mr-1" /> Reset
              </Button>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <FiCalendar className="w-3.5 h-3.5 text-gray-400" /> Filter by Date:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px]">From:</span>
              <Input
                type="date"
                className="h-7 text-xs w-36 bg-gray-50/50 border-gray-200"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px]">To:</span>
              <Input
                type="date"
                className="h-7 text-xs w-36 bg-gray-50/50 border-gray-200"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Invoices Table */}
      <Card className="bg-white border-gray-200/80 shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full mb-3"></div>
              <p className="text-xs font-medium text-gray-600">Loading order sales invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-16 text-center text-gray-500 space-y-3">
              <FiFileText className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="text-base font-bold text-gray-900">No Order Invoices Found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Once a client work order is completed and closed, click <strong>"Generate Final Invoice & Settle"</strong> on the order page to issue an official sales invoice.
              </p>
              <Link href="/dashboard/orders">
                <Button size="sm" className="mt-2 bg-gray-900 hover:bg-black text-white text-xs gap-1.5">
                  <FiLayers className="w-3.5 h-3.5" /> Go to Work Orders
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50/70 border-b border-gray-200 text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="p-3.5">Invoice #</th>
                    <th className="p-3.5">Work Order Ref</th>
                    <th className="p-3.5">Client</th>
                    <th className="p-3.5">Style / Garment</th>
                    <th className="p-3.5 text-right">Billed Qty</th>
                    <th className="p-3.5 text-right">Unit Rate</th>
                    <th className="p-3.5 text-right">Grand Total</th>
                    <th className="p-3.5 text-center">Accounts Voucher</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {invoices.map((inv) => {
                    const billedQty = inv.items?.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0) || Number(inv.workOrder?.producedQuantity || 0);
                    const unitPrice = Number(inv.workOrder?.unitPrice || 0);
                    const grandTotal = Number(inv.grandTotal || 0);
                    const clientName = inv.client?.name || "N/A";
                    const orderNo = inv.workOrder?.orderNo || "N/A";
                    const orderId = inv.workOrder?.id;

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Invoice Number */}
                        <td className="p-3.5">
                          <div className="font-bold text-gray-900 font-mono flex items-center gap-1.5">
                            <span className="text-emerald-700">{inv.saleNumber}</span>
                          </div>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {new Date(inv.createdAt).toLocaleDateString()} • {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Work Order Ref */}
                        <td className="p-3.5">
                          {orderId ? (
                            <Link 
                              href={`/dashboard/orders/${orderId}`}
                              className="font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <span>{orderNo}</span>
                              <FiExternalLink className="w-3 h-3 text-gray-400" />
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-600">{orderNo}</span>
                          )}
                          {inv.workOrder?.styleNo && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded inline-block mt-0.5 border border-gray-200">
                              Style: {inv.workOrder.styleNo}
                            </span>
                          )}
                        </td>

                        {/* Client */}
                        <td className="p-3.5">
                          <span className="font-semibold text-gray-900 block">{clientName}</span>
                          {inv.client?.company && (
                            <span className="text-[11px] text-gray-400 block">{inv.client.company}</span>
                          )}
                          {inv.client?.phone && (
                            <span className="text-[10px] text-gray-500 block">{inv.client.phone}</span>
                          )}
                        </td>

                        {/* Style / Garment */}
                        <td className="p-3.5">
                          <span className="font-medium text-gray-800 block">
                            {inv.workOrder?.orderTitle || inv.workOrder?.item?.name || "Garment Manufacturing"}
                          </span>
                          {inv.workOrder?.item?.code && (
                            <span className="text-[11px] text-gray-400 block">Item Code: {inv.workOrder.item.code}</span>
                          )}
                        </td>

                        {/* Billed Qty */}
                        <td className="p-3.5 text-right font-bold text-gray-900">
                          {billedQty} <span className="text-xs font-normal text-gray-500">{inv.workOrder?.unit || "Pcs"}</span>
                        </td>

                        {/* Unit Rate */}
                        <td className="p-3.5 text-right text-gray-700 font-medium">
                          ৳{unitPrice.toFixed(2)}
                        </td>

                        {/* Grand Total */}
                        <td className="p-3.5 text-right font-bold text-emerald-700 text-sm">
                          ৳{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Accounting Status */}
                        <td className="p-3.5 text-center">
                          {inv.voucher ? (
                            <div className="space-y-1">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]">
                                <FiCheckCircle className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                                {inv.voucher.voucherNumber}
                              </Badge>
                              <Link 
                                href="/dashboard/accounts/vouchers" 
                                className="text-[10px] text-emerald-700 hover:underline block font-medium"
                              >
                                View in Ledger →
                              </Link>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                                <FiClock className="w-2.5 h-2.5 mr-1 text-amber-600" /> Pending Voucher
                              </Badge>
                              <button
                                type="button"
                                onClick={() => handleSyncVoucher(inv.id)}
                                disabled={syncingSaleId === inv.id}
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline block mx-auto font-medium"
                              >
                                {syncingSaleId === inv.id ? "Syncing..." : "Sync to Accounts"}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrintInvoice(inv.id)}
                              disabled={printingSaleId === inv.id}
                              className="h-7 px-2 text-[11px] gap-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 shadow-2xs"
                              title="Print Sales Invoice"
                            >
                              <FiPrinter className="w-3 h-3 text-gray-500" />
                              {printingSaleId === inv.id ? "Printing..." : "Print"}
                            </Button>

                            {orderId && (
                              <Link href={`/dashboard/orders/${orderId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] gap-1 text-gray-600 hover:text-gray-900"
                                  title="View Work Order"
                                >
                                  <FiArrowRight className="w-3 h-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 5. Pagination Footer */}
          {!loading && invoices.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-100 text-xs">
              {/* Left summary & limit selector */}
              <div className="flex flex-wrap items-center gap-4 text-gray-500">
                <span>
                  Showing <strong>{startEntry}</strong> to <strong>{endEntry}</strong> of <strong>{pagination.total}</strong> invoices
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Rows:</span>
                  <select
                    className="h-7 px-2 rounded border border-gray-200 text-xs bg-white text-gray-900 font-medium"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 20, 50, 100].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Page numbers */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>

                {getPageNumbers(page, pagination.totalPages).map((p, idx) => {
                  if (p === "...") {
                    return <span key={`dots-${idx}`} className="px-1 text-gray-400">...</span>;
                  }
                  const isCur = p === page;
                  return (
                    <Button
                      key={`page-${p}`}
                      variant={isCur ? "default" : "outline"}
                      size="sm"
                      className={`h-7 w-7 p-0 text-xs font-medium ${isCur ? "bg-gray-900 text-white shadow-2xs" : ""}`}
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
