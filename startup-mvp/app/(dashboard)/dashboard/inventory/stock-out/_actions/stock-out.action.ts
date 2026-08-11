"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logItemCreated, logItemUpdated } from "@/lib/user-log";
import { revalidateBothPaths } from "@/lib/route-utils-server";
import { StockOutStatus, StockTransactionType, VoucherType } from "@prisma/client";
import { createVoucher, postVoucher } from "@/app/(dashboard)/dashboard/accounts/vouchers/_actions/voucher.action";
import { getAccountingOperationSettings } from "@/lib/accounting-settings";

// --- Types ---

export interface StockOutItemInput {
  itemId: string;
  variantId?: string | null;
  quantity: number;
  unitRate: number;
}

export interface CreateStockOutInput {
  warehouseId: string;
  date: Date;
  notes?: string;
  items: StockOutItemInput[];
}

// --- Actions ---

export async function getStockOuts(
  page: number = 1,
  limit: number = 10,
  filters: {
    warehouseId?: string;
    search?: string;
    status?: StockOutStatus;
    isTrash?: boolean;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canView = await hasPermission(session.user.id, "inventory.stock-out", "view");
    if (!canView) return { success: false, error: "Permission denied" };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, defaultWarehouseId: true }
    });

    const isNormalUser = user?.role !== "admin" && user?.role !== "superadmin";

    const where: any = { isTrash: filters.isTrash ?? false };
    if (filters.warehouseId && filters.warehouseId !== "all") {
      where.warehouseId = filters.warehouseId;
    } else if (isNormalUser && user?.defaultWarehouseId) {
      where.warehouseId = user.defaultWarehouseId;
    }
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: new Date(new Date(filters.startDate).setHours(0, 0, 0, 0)) } : {}),
        ...(filters.endDate ? { lte: new Date(new Date(filters.endDate).setHours(23, 59, 59, 999)) } : {}),
      };
    }
    if (filters.search) {
      where.OR = [
        { stockOutNo: { contains: filters.search, mode: "insensitive" } },
        { notes: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [stockOuts, total] = await Promise.all([
      prisma.stockOut.findMany({
        where,
        include: {
          warehouse: { select: { name: true } },
          createdByUser: { select: { name: true } },
          _count: { select: { items: true } },
          items: { select: { amount: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockOut.count({ where }),
    ]);

    const formattedStockOuts = stockOuts.map(so => {
      const grandTotal = so.items.reduce((sum, item) => sum + Number(item.amount), 0);
      const serialized = serialize(so);
      return {
        ...serialized,
        grandTotal,
      };
    });

    return {
      success: true,
      stockOuts: formattedStockOuts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("getStockOuts error:", error);
    return { success: false, error: "Failed to fetch stock out records" };
  }
}

export async function getStockOut(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canView = await hasPermission(session.user.id, "inventory.stock-out", "view");
    if (!canView) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({
      where: { id },
      include: {
        warehouse: true,
        items: {
          include: {
            item: {
              select: { code: true, name: true, unit: { select: { symbol: true } }, itemType: true }
            },
            variant: {
              select: { sku: true, size: true, color: true }
            }
          }
        },
        createdByUser: { select: { name: true } },
        voucher: { select: { voucherNumber: true } }
      }
    });

    if (!stockOut) return { success: false, error: "Stock out record not found" };

    return { success: true, stockOut: serialize(stockOut) };
  } catch (error) {
    console.error("getStockOut error:", error);
    return { success: false, error: "Failed to fetch stock out record" };
  }
}

function serialize(obj: any): any {
  if (obj === null || obj === undefined) {
      return obj;
  }
  
  if (obj instanceof Date) {
      return obj.toISOString();
  }

  if (typeof obj === 'object') {
      if (obj.toString().includes('Decimal')) {
          return Number(obj);
      }
      if (typeof obj.toNumber === 'function') {
          return obj.toNumber();
      }
      
      if (Array.isArray(obj)) {
          return obj.map(serialize);
      }
      
      const newObj: any = {};
      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              newObj[key] = serialize(obj[key]);
          }
      }
      return newObj;
  }
  return obj;
}

export async function createStockOut(input: CreateStockOutInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canCreate = await hasPermission(session.user.id, "inventory.stock-out", "create");
    if (!canCreate) return { success: false, error: "Permission denied" };

    const count = await prisma.stockOut.count();
    const stockOutNo = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const stockOut = await prisma.stockOut.create({
      data: {
        stockOutNo,
        warehouseId: input.warehouseId,
        date: input.date,
        notes: input.notes,
        status: StockOutStatus.DRAFT,
        createdById: session.user.id,
        items: {
          create: input.items.map(item => {
            const qty = Math.abs(item.quantity);
            const rate = item.unitRate;
            const amount = Math.round(qty * rate * 100) / 100;
            return {
              itemId: item.itemId,
              variantId: item.variantId || null,
              quantity: qty,
              unitRate: rate,
              amount: amount,
            };
          })
        }
      }
    });

    await logItemCreated(session.user.id, "StockOut", stockOut.id, `Created draft stock out ${stockOutNo}`);
    revalidateBothPaths("/dashboard/inventory/stock-out");

    return { success: true, stockOutId: stockOut.id };
  } catch (error) {
    console.error("createStockOut error:", error);
    return { success: false, error: "Failed to create stock out record" };
  }
}

export async function updateStockOut(id: string, input: CreateStockOutInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canEdit = await hasPermission(session.user.id, "inventory.stock-out", "edit");
    if (!canEdit) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({
      where: { id },
    });

    if (!stockOut) return { success: false, error: "Not found" };
    if (stockOut.status !== "DRAFT") return { success: false, error: "Cannot edit non-draft stock out record" };

    await prisma.$transaction(async (tx) => {
      // 1. Delete old items
      await tx.stockOutItem.deleteMany({ where: { stockOutId: id } });
      
      // 2. Update parent and create new items
      await tx.stockOut.update({
        where: { id },
        data: {
          warehouseId: input.warehouseId,
          date: input.date,
          notes: input.notes,
          items: {
            create: input.items.map(item => {
              const qty = Math.abs(item.quantity);
              const rate = item.unitRate;
              const amount = Math.round(qty * rate * 100) / 100;
              return {
                itemId: item.itemId,
                variantId: item.variantId || null,
                quantity: qty,
                unitRate: rate,
                amount: amount,
              };
            })
          }
        }
      });
    });

    await logItemUpdated(session.user.id, "StockOut", id, ["Updated draft stock out record"]);
    revalidateBothPaths("/dashboard/inventory/stock-out");

    return { success: true };
  } catch (error) {
    console.error("updateStockOut error:", error);
    return { success: false, error: "Failed to update stock out record" };
  }
}

export async function approveStockOut(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canApprove = await hasPermission(session.user.id, "inventory.stock-out", "approve");
    if (!canApprove) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({
      where: { id },
      include: { items: { include: { item: true } }, warehouse: true }
    });

    if (!stockOut) return { success: false, error: "Stock out record not found" };
    if (stockOut.status !== "DRAFT") return { success: false, error: "Stock out is not in draft status" };

    const settings = await getAccountingOperationSettings();
    const { 
      negativeFgInventoryId, negativeRmInventoryId, negativeAdjustmentExpenseId 
    } = settings.inventoryAdjustment;

    if (!negativeAdjustmentExpenseId) {
      return { success: false, error: "Accounting Operation settings for Negative Adjustment / Damage Expense account is missing" };
    }

    const voucherLines: any[] = [];
    let lineNumber = 1;

    await prisma.$transaction(async (tx) => {
      for (const item of stockOut.items) {
        // 1. Update Stock (reduce stock level)
        const existingStock = item.variantId ? await tx.stock.findUnique({
          where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: stockOut.warehouseId } }
        }) : await tx.stock.findUnique({
          where: { itemId_warehouseId: { itemId: item.itemId, warehouseId: stockOut.warehouseId } }
        });

        const newQty = existingStock ? Number(existingStock.quantity) - Number(item.quantity) : -Number(item.quantity);

        if (existingStock) {
          await tx.stock.update({
            where: { id: existingStock.id },
            data: { quantity: newQty, lastUpdated: new Date() }
          });
        } else {
          await tx.stock.create({
            data: {
              itemId: item.variantId ? null : item.itemId,
              variantId: item.variantId || null,
              warehouseId: stockOut.warehouseId,
              quantity: newQty,
            }
          });
        }

        // 2. Create Stock Ledger (OUT transaction type)
        await tx.stockLedger.create({
          data: {
            itemId: item.variantId ? null : item.itemId,
            variantId: item.variantId || null,
            warehouseId: stockOut.warehouseId,
            transactionType: StockTransactionType.OUT,
            quantity: -Number(item.quantity),
            referenceType: "STOCK_OUT",
            referenceId: stockOut.id,
            notes: stockOut.notes || "Stock Out",
            createdBy: session.user.id,
            rate: item.unitRate
          }
        });

        // 3. Prepare Accounting Lines
        const amount = Number(item.amount);
        if (amount > 0) {
          const isRawMaterial = item.item.itemType === "RAW_MATERIAL";
          const inventoryAcctId = isRawMaterial ? negativeRmInventoryId : negativeFgInventoryId;
          const expenseAcctId = negativeAdjustmentExpenseId;

          if (inventoryAcctId && expenseAcctId) {
             voucherLines.push({
                lineNumber: lineNumber++,
                debitAmount: amount,
                creditAmount: 0,
                chartOfAccountId: expenseAcctId,
                description: `Stock Out Expense: ${item.item.code}`
             });
             voucherLines.push({
                lineNumber: lineNumber++,
                debitAmount: 0,
                creditAmount: amount,
                chartOfAccountId: inventoryAcctId,
                description: `Inventory Out: ${item.item.code} - ${item.item.name}`
             });
          }
        }
      }
      
      // Update Stock Out Status
      await tx.stockOut.update({
        where: { id },
        data: { status: "COMPLETED" }
      });
    });

    if (voucherLines.length > 0) {
       const voucherResult = await createVoucher({
          date: stockOut.date,
          type: VoucherType.STOCK_OUT,
          reference: stockOut.stockOutNo,
          description: `Inventory Stock Out: ${stockOut.stockOutNo}`,
          isSystemAction: true,
          lines: voucherLines
       });

       if (voucherResult.success && voucherResult.voucher) {
          await postVoucher(voucherResult.voucher.id, undefined, true);
          await prisma.stockOut.update({
             where: { id },
             data: { voucherId: voucherResult.voucher.id }
          });
       }
    }

    await logItemUpdated(session.user.id, "StockOut", stockOut.id, ["Approved and Posted Stock Out"]);
    revalidateBothPaths("/dashboard/inventory/stock-out");
    
    return { success: true };

  } catch (error) {
    console.error("approveStockOut error:", error);
    return { success: false, error: "Failed to approve stock out" };
  }
}

export async function trashStockOut(id: string) {
   try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canTrash = await hasPermission(session.user.id, "inventory.stock-out", "move-to-trash");
    if (!canTrash) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({ where: { id } });
    if (!stockOut) return { success: false, error: "Not found" };
    if (stockOut.status !== "DRAFT") return { success: false, error: "Cannot trash non-draft stock out record" };
    
    await prisma.stockOut.update({ where: { id }, data: { isTrash: true } });
    await logItemUpdated(session.user.id, "StockOut", stockOut.id, ["Moved to trash"]);
    revalidateBothPaths("/dashboard/inventory/stock-out");
    return { success: true };
   } catch (error) {
      return { success: false, error: "Failed to move to trash" };
   }
}

export async function restoreStockOut(id: string) {
   try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canTrash = await hasPermission(session.user.id, "inventory.stock-out", "move-to-trash");
    if (!canTrash) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({ where: { id } });
    if (!stockOut) return { success: false, error: "Not found" };
    
    await prisma.stockOut.update({ where: { id }, data: { isTrash: false } });
    await logItemUpdated(session.user.id, "StockOut", stockOut.id, ["Restored from trash"]);
    revalidateBothPaths("/dashboard/inventory/stock-out");
    return { success: true };
   } catch (error) {
      return { success: false, error: "Failed to restore" };
   }
}

export async function deleteStockOut(id: string) {
   try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const canDelete = await hasPermission(session.user.id, "inventory.stock-out", "delete-permanently");
    if (!canDelete) return { success: false, error: "Permission denied" };

    const stockOut = await prisma.stockOut.findUnique({
      where: { id },
    });

    if (!stockOut) return { success: false, error: "Not found" };
    if (stockOut.status !== "DRAFT") return { success: false, error: "Cannot delete non-draft stock out record" };
    
    await prisma.$transaction([
      prisma.stockOutItem.deleteMany({ where: { stockOutId: id } }),
      prisma.stockOut.delete({ where: { id } })
    ]);
    await logItemUpdated(session.user.id, "StockOut", stockOut.id, ["Permanently deleted stock out record"]);
    revalidateBothPaths("/dashboard/inventory/stock-out");
    return { success: true };
   } catch (error) {
      return { success: false, error: "Failed to delete" };
   }
}
