"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateBothPaths } from "@/lib/route-utils-server";
import { createSaleAccountingVoucher } from "@/app/(dashboard)/dashboard/sales/_actions/sale.action";

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export interface GetOrderInvoicesParams {
  page?: number;
  limit?: number;
  search?: string;
  clientId?: string;
  voucherStatus?: "ALL" | "POSTED" | "PENDING";
  dateFrom?: string;
  dateTo?: string;
}

export async function getOrderInvoices(params: GetOrderInvoicesParams = {}) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      isTrash: false,
      workOrder: { isNot: null }, // Specifically invoices linked to Work Orders
    };

    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { saleNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
        { client: { phone: { contains: q, mode: "insensitive" } } },
        { client: { company: { contains: q, mode: "insensitive" } } },
        { workOrder: { orderNo: { contains: q, mode: "insensitive" } } },
        { workOrder: { orderTitle: { contains: q, mode: "insensitive" } } },
        { workOrder: { styleNo: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (params.clientId && params.clientId !== "ALL") {
      where.clientId = params.clientId;
    }

    if (params.voucherStatus === "POSTED") {
      where.voucherId = { not: null };
    } else if (params.voucherStatus === "PENDING") {
      where.voucherId = null;
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) {
        where.createdAt.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        const end = new Date(params.dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Run query, count, and overall KPI metrics in parallel
    const [invoices, total, totalRevenueAgg, totalUnitsAgg, vouchersPostedCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, phone: true, company: true, email: true },
          },
          workOrder: {
            select: {
              id: true,
              orderNo: true,
              orderTitle: true,
              styleNo: true,
              unit: true,
              producedQuantity: true,
              targetQuantity: true,
              unitPrice: true,
              productionStatus: true,
              item: { select: { id: true, name: true, code: true } },
            },
          },
          voucher: {
            select: { id: true, voucherNumber: true, status: true, date: true },
          },
          items: {
            include: {
              item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
      prisma.sale.aggregate({
        where: { isTrash: false, workOrder: { isNot: null } },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      prisma.saleItem.aggregate({
        where: { sale: { isTrash: false, workOrder: { isNot: null } } },
        _sum: { quantity: true },
      }),
      prisma.sale.count({
        where: { isTrash: false, workOrder: { isNot: null }, voucherId: { not: null } },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const kpi = {
      totalCount: totalRevenueAgg._count.id || 0,
      totalRevenue: Number(totalRevenueAgg._sum.grandTotal || 0),
      totalUnitsBilled: Number(totalUnitsAgg._sum.quantity || 0),
      vouchersPostedCount,
    };

    return {
      success: true,
      invoices: serialize(invoices),
      kpi,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error: any) {
    console.error("getOrderInvoices error:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch order invoices",
      invoices: [],
      kpi: { totalCount: 0, totalRevenue: 0, totalUnitsBilled: 0, vouchersPostedCount: 0 },
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
  }
}

export async function syncOrderInvoiceVoucher(saleId: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const res = await createSaleAccountingVoucher(saleId);
    if (!res.success) {
      return { success: false, error: res.error || "Failed to generate accounting voucher" };
    }

    revalidateBothPaths("/dashboard/sales/invoices");
    revalidateBothPaths("/dashboard/orders");
    revalidateBothPaths("/dashboard/accounts");
    revalidateBothPaths("/dashboard/accounts/vouchers");
    revalidateBothPaths("/dashboard/accounts/ledgers");

    return { success: true, voucherId: res.voucherId };
  } catch (error: any) {
    console.error("syncOrderInvoiceVoucher error:", error);
    return { success: false, error: error.message || "Failed to sync voucher" };
  }
}

export async function getClientsForInvoiceFilter() {
  try {
    const clients = await prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
    });
    return { success: true, clients: serialize(clients) };
  } catch (error: any) {
    console.error("getClientsForInvoiceFilter error:", error);
    return { success: false, clients: [] };
  }
}
