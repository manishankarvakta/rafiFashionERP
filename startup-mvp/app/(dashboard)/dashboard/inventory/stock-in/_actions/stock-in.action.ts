"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateBothPaths } from "@/lib/route-utils-server";
import { MaterialInwardSource, StockTransactionType, WorkOrderStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export interface StockInItemInput {
  itemId?: string | null;
  materialCategory: string; // e.g. Fabric, Buttons, Zippers, Thread, Labels, etc.
  materialName?: string | null;
  specs?: string | null; // Roll #, Lot #, Shade #, Size, etc.
  fabricRollNo?: string | null;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  totalCost?: number | null;
  notes?: string | null;
}

export interface CreateStockInInput {
  source: MaterialInwardSource;
  warehouseId: string;
  clientId?: string | null;
  workOrderId?: string | null;
  challanNo?: string | null;
  carrierName?: string | null;
  vehicleNo?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
  items: StockInItemInput[];
}

async function generateNextInwardNo(txOrPrisma: any): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INW-${currentYear}-`;

  const existingRecords = await txOrPrisma.workOrderMaterialIn.findMany({
    where: {
      inwardNo: {
        startsWith: prefix,
      },
    },
    select: {
      inwardNo: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let maxSeq = 0;
  for (const rec of existingRecords) {
    const match = rec.inwardNo.match(/^INW-\d{4}-(\d+)/);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(4, "0")}`;

  while (await txOrPrisma.workOrderMaterialIn.findUnique({ where: { inwardNo: candidate } })) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  return candidate;
}

export async function createStockIn(input: CreateStockInInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    if (!input.warehouseId) {
      return { success: false, error: "Please select a target warehouse." };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Please add at least one material item." };
    }

    const inwardNo = await generateNextInwardNo(prisma);
    const receivedDate = input.receivedDate ? new Date(input.receivedDate) : new Date();

    // Find or create a default Raw Material Item if specific itemId is omitted
    let defaultRawItem = await prisma.item.findFirst({
      where: { itemType: "RAW_MATERIAL", isTrash: false },
    });

    if (!defaultRawItem) {
      // Find a default unit or create one
      let defaultUnit = await prisma.unit.findFirst();
      if (!defaultUnit) {
        defaultUnit = await prisma.unit.create({
          data: {
            details: "Pieces",
            symbol: "Pcs",
            createdBy: session.user.id,
          },
        });
      }

      defaultRawItem = await prisma.item.create({
        data: {
          name: "General Raw Material",
          code: `RAW-${Date.now().toString().slice(-6)}`,
          itemType: "RAW_MATERIAL",
          costPrice: new Decimal(0),
          unitId: defaultUnit.id,
          createdBy: session.user.id,
        },
      });
    }

    const createdRecords = await prisma.$transaction(async (tx) => {
      const records = [];

      for (let i = 0; i < input.items.length; i++) {
        const itemInput = input.items[i];
        const targetItemId = itemInput.itemId || defaultRawItem!.id;
        const lineInwardNo = input.items.length === 1 ? inwardNo : `${inwardNo}-${i + 1}`;
        const qtyDecimal = new Decimal(itemInput.quantity);
        const unitCostDecimal = new Decimal(itemInput.unitCost || 0);
        const totalCostDecimal = itemInput.totalCost !== undefined && itemInput.totalCost !== null
          ? new Decimal(itemInput.totalCost) 
          : qtyDecimal.mul(unitCostDecimal);

        // 1. Create WorkOrderMaterialIn entry
        const matIn = await tx.workOrderMaterialIn.create({
          data: {
            inwardNo: lineInwardNo,
            workOrderId: input.workOrderId || null,
            clientId: input.clientId || null,
            source: input.source,
            itemId: targetItemId,
            materialCategory: itemInput.materialCategory || "RAW_MATERIAL",
            materialName: itemInput.materialName || null,
            specs: itemInput.specs || null,
            fabricRollNo: itemInput.fabricRollNo || null,
            quantity: qtyDecimal,
            unit: itemInput.unit || "Pcs",
            unitCost: unitCostDecimal,
            totalCost: totalCostDecimal,
            challanNo: input.challanNo || null,
            carrierName: input.carrierName || null,
            vehicleNo: input.vehicleNo || null,
            notes: itemInput.notes || input.notes || null,
            receivedDate,
          },
        });
        records.push(matIn);

        // 2. Increment Stock
        const existingStock = await tx.stock.findFirst({
          where: {
            itemId: targetItemId,
            warehouseId: input.warehouseId,
            variantId: null,
          },
        });

        if (existingStock) {
          await tx.stock.update({
            where: { id: existingStock.id },
            data: {
              quantity: { increment: qtyDecimal },
              lastUpdated: new Date(),
            },
          });
        } else {
          await tx.stock.create({
            data: {
              itemId: targetItemId,
              warehouseId: input.warehouseId,
              quantity: qtyDecimal,
            },
          });
        }

        // 3. Create Stock Ledger
        await tx.stockLedger.create({
          data: {
            itemId: targetItemId,
            warehouseId: input.warehouseId,
            transactionType: StockTransactionType.IN,
            quantity: qtyDecimal,
            rate: unitCostDecimal,
            referenceType: input.source === MaterialInwardSource.CLIENT_SUPPLIED ? "CLIENT_MATERIAL_IN" : "PURCHASE_STOCK_IN",
            referenceId: lineInwardNo,
            notes: `Material Inward: [${itemInput.materialCategory || "RAW"}] ${itemInput.materialName || itemInput.specs || ""} (${input.source})`,
            createdBy: session.user.id,
          },
        });

        // 4. If fabric roll is specified, create FabricRoll record
        if (itemInput.fabricRollNo) {
          const existingRoll = await tx.fabricRoll.findUnique({
            where: { rollNumber: itemInput.fabricRollNo },
          });

          if (!existingRoll) {
            await tx.fabricRoll.create({
              data: {
                rollNumber: itemInput.fabricRollNo,
                itemId: targetItemId,
                weightKg: qtyDecimal,
                status: "AVAILABLE",
                warehouseId: input.warehouseId,
              },
            });
          }
        }
      }

      // If tied to a WorkOrder that is currently PENDING, update its status to MATERIAL_RECEIVED
      if (input.workOrderId) {
        const wo = await tx.workOrder.findUnique({ where: { id: input.workOrderId } });
        if (wo && wo.productionStatus === WorkOrderStatus.PENDING) {
          await tx.workOrder.update({
            where: { id: input.workOrderId },
            data: { productionStatus: WorkOrderStatus.MATERIAL_RECEIVED },
          });
        }
      }

      return records;
    });

    revalidateBothPaths("/dashboard/inventory/stock-in");
    revalidateBothPaths("/dashboard/inventory/stock");
    if (input.workOrderId) {
      revalidateBothPaths(`/dashboard/orders/${input.workOrderId}`);
      revalidateBothPaths("/dashboard/orders");
    }

    return { success: true, count: createdRecords.length, inwardNo };
  } catch (error: any) {
    console.error("createStockIn error:", error);
    return { success: false, error: error.message || "Failed to record stock inward" };
  }
}

export async function getStockInList(params: {
  page?: number;
  limit?: number;
  search?: string;
  source?: string;
  workOrderId?: string;
} = {}) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.source && params.source !== "ALL") {
      where.source = params.source as MaterialInwardSource;
    }

    if (params.workOrderId) {
      where.workOrderId = params.workOrderId;
    }

    if (params.search) {
      where.OR = [
        { inwardNo: { contains: params.search, mode: "insensitive" } },
        { materialName: { contains: params.search, mode: "insensitive" } },
        { specs: { contains: params.search, mode: "insensitive" } },
        { fabricRollNo: { contains: params.search, mode: "insensitive" } },
        { challanNo: { contains: params.search, mode: "insensitive" } },
        { notes: { contains: params.search, mode: "insensitive" } },
        { item: { name: { contains: params.search, mode: "insensitive" } } },
        { workOrder: { orderNo: { contains: params.search, mode: "insensitive" } } },
        { workOrder: { orderTitle: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const [inwards, total] = await Promise.all([
      prisma.workOrderMaterialIn.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          workOrder: { select: { id: true, orderNo: true, orderTitle: true, styleNo: true, client: { select: { name: true } } } },
        },
        orderBy: { receivedDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.workOrderMaterialIn.count({ where }),
    ]);

    return {
      success: true,
      inwards: serialize(inwards),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error("getStockInList error:", error);
    return { success: false, error: error.message || "Failed to load stock in list" };
  }
}

export async function getStockInFormData() {
  try {
    const [warehouses, clients, workOrders, items, categories, units] = await Promise.all([
      prisma.warehouse.findMany({
        where: { isTrash: false, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.client.findMany({
        where: { status: "active" },
        select: { id: true, name: true, company: true, phone: true },
        orderBy: { name: "asc" },
      }),
      prisma.workOrder.findMany({
        where: { isTrash: false, productionStatus: { not: WorkOrderStatus.DELIVERED } },
        select: {
          id: true,
          orderNo: true,
          orderTitle: true,
          styleNo: true,
          clientId: true,
          targetQuantity: true,
          unit: true,
          fabricDetails: true,
          colorSpecs: true,
          sizeBreakdown: true,
          productionStatus: true,
          client: { select: { id: true, name: true, phone: true, company: true } },
          item: { select: { name: true } },
          rawMaterials: {
            select: {
              id: true,
              itemId: true,
              notes: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  itemType: true,
                  costPrice: true,
                  unit: { select: { symbol: true } },
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          materialsIn: {
            select: {
              id: true,
              materialName: true,
              quantity: true,
              unit: true,
              item: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.item.findMany({
        where: { isTrash: false, status: "active" },
        select: {
          id: true,
          name: true,
          code: true,
          itemType: true,
          costPrice: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          unit: { select: { symbol: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { status: "active" },
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.unit.findMany({
        where: { status: "active" },
        select: {
          id: true,
          symbol: true,
          details: true,
        },
        orderBy: { symbol: "asc" },
      }),
    ]);

    return {
      success: true,
      warehouses: serialize(warehouses),
      clients: serialize(clients),
      workOrders: serialize(workOrders),
      items: serialize(items),
      categories: serialize(categories),
      units: serialize(units),
    };
  } catch (error: any) {
    console.error("getStockInFormData error:", error);
    return { success: false, warehouses: [], clients: [], workOrders: [], items: [], categories: [], units: [] };
  }
}

export async function getStockInById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const inward = await prisma.workOrderMaterialIn.findUnique({
      where: { id },
      include: {
        item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
        workOrder: {
          select: {
            id: true,
            orderNo: true,
            orderTitle: true,
            styleNo: true,
            targetQuantity: true,
            unit: true,
            client: { select: { id: true, name: true, company: true, phone: true } },
          },
        },
      },
    });

    if (!inward) {
      return { success: false, error: "Stock inward record not found" };
    }

    return { success: true, inward: serialize(inward) };
  } catch (error: any) {
    console.error("getStockInById error:", error);
    return { success: false, error: error.message || "Failed to load stock in record" };
  }
}

export interface UpdateStockInInput {
  source?: MaterialInwardSource;
  workOrderId?: string | null;
  clientId?: string | null;
  itemId?: string | null;
  materialCategory?: string | null;
  materialName?: string | null;
  specs?: string | null;
  fabricRollNo?: string | null;
  quantity?: number;
  unit?: string;
  challanNo?: string | null;
  carrierName?: string | null;
  vehicleNo?: string | null;
  receivedDate?: string | null;
  notes?: string | null;
}

export async function updateStockIn(id: string, input: UpdateStockInInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const existing = await prisma.workOrderMaterialIn.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Stock inward record not found" };

    const newQty = input.quantity !== undefined ? new Decimal(input.quantity) : existing.quantity;
    const targetItemId = input.itemId !== undefined && input.itemId ? input.itemId : existing.itemId;
    const isItemChanged = targetItemId !== existing.itemId;
    const qtyDifference = newQty.sub(existing.quantity);

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update WorkOrderMaterialIn
      const record = await tx.workOrderMaterialIn.update({
        where: { id },
        data: {
          source: input.source !== undefined ? input.source : existing.source,
          workOrderId: input.workOrderId !== undefined ? input.workOrderId : existing.workOrderId,
          clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
          itemId: targetItemId,
          materialCategory: input.materialCategory !== undefined ? input.materialCategory : existing.materialCategory,
          materialName: input.materialName !== undefined ? input.materialName : existing.materialName,
          specs: input.specs !== undefined ? input.specs : existing.specs,
          fabricRollNo: input.fabricRollNo !== undefined ? input.fabricRollNo : existing.fabricRollNo,
          quantity: newQty,
          unit: input.unit !== undefined ? input.unit : existing.unit,
          challanNo: input.challanNo !== undefined ? input.challanNo : existing.challanNo,
          carrierName: input.carrierName !== undefined ? input.carrierName : existing.carrierName,
          vehicleNo: input.vehicleNo !== undefined ? input.vehicleNo : existing.vehicleNo,
          receivedDate: input.receivedDate !== undefined ? (input.receivedDate ? new Date(input.receivedDate) : existing.receivedDate) : existing.receivedDate,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        },
      });

      // 2. Adjust Stock
      if (isItemChanged) {
        // Decrement old item
        const oldStock = await tx.stock.findFirst({ where: { itemId: existing.itemId } });
        if (oldStock) {
          await tx.stock.update({
            where: { id: oldStock.id },
            data: {
              quantity: { decrement: existing.quantity },
              lastUpdated: new Date(),
            },
          });
        }
        // Increment new item
        const newStock = await tx.stock.findFirst({ where: { itemId: targetItemId } });
        if (newStock) {
          await tx.stock.update({
            where: { id: newStock.id },
            data: {
              quantity: { increment: newQty },
              lastUpdated: new Date(),
            },
          });
        } else {
          // If no stock record exists yet, get default warehouse
          const warehouse = await tx.warehouse.findFirst({ where: { isTrash: false, status: "active" } });
          if (warehouse) {
            await tx.stock.create({
              data: {
                itemId: targetItemId,
                warehouseId: warehouse.id,
                quantity: newQty,
              },
            });
          }
        }
      } else if (!qtyDifference.isZero()) {
        const stockRecord = await tx.stock.findFirst({
          where: { itemId: existing.itemId },
        });

        if (stockRecord) {
          await tx.stock.update({
            where: { id: stockRecord.id },
            data: {
              quantity: { increment: qtyDifference },
              lastUpdated: new Date(),
            },
          });
        }
      }

      return record;
    });

    revalidateBothPaths("/dashboard/inventory/stock-in");
    revalidateBothPaths(`/dashboard/inventory/stock-in/${id}/edit`);
    if (existing.workOrderId) {
      revalidateBothPaths(`/dashboard/orders/${existing.workOrderId}`);
    }
    if (input.workOrderId && input.workOrderId !== existing.workOrderId) {
      revalidateBothPaths(`/dashboard/orders/${input.workOrderId}`);
    }
    revalidateBothPaths("/dashboard/orders");

    return { success: true, inward: serialize(updated) };
  } catch (error: any) {
    console.error("updateStockIn error:", error);
    return { success: false, error: error.message || "Failed to update stock inward record" };
  }
}

export async function deleteStockIn(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const existing = await prisma.workOrderMaterialIn.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Stock inward record not found" };

    await prisma.$transaction(async (tx) => {
      // 1. Revert stock quantity
      const stockRecord = await tx.stock.findFirst({
        where: { itemId: existing.itemId },
      });

      if (stockRecord) {
        await tx.stock.update({
          where: { id: stockRecord.id },
          data: {
            quantity: { decrement: existing.quantity },
            lastUpdated: new Date(),
          },
        });
      }

      // 2. Delete WorkOrderMaterialIn
      await tx.workOrderMaterialIn.delete({
        where: { id },
      });
    });

    revalidateBothPaths("/dashboard/inventory/stock-in");
    if (existing.workOrderId) {
      revalidateBothPaths(`/dashboard/orders/${existing.workOrderId}`);
      revalidateBothPaths("/dashboard/orders");
    }

    return { success: true };
  } catch (error: any) {
    console.error("deleteStockIn error:", error);
    return { success: false, error: error.message || "Failed to delete stock inward record" };
  }
}
