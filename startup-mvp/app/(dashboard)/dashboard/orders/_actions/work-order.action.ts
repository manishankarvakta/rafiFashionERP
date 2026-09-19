"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateBothPaths } from "@/lib/route-utils-server";
import { WorkOrderStatus, MaterialInwardSource, OrderType, SaleStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function serialize<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export interface CreateWorkOrderInput {
  clientId: string;
  itemId?: string | null;
  orderTitle?: string | null;
  styleNo?: string | null;
  unit?: string | null;
  fabricDetails?: string | null;
  colorSpecs?: string | null;
  sizeBreakdown?: string | null;
  advanceAmount?: number | null;
  targetQuantity?: number | null;
  unitPrice?: number | null;
  deliveryDeadline?: string | null;
  notes?: string | null;
}

export interface BatchWorkOrderItemInput {
  itemId?: string | null;
  orderTitle?: string | null;
  styleNo?: string | null;
  targetQuantity?: number | null;
  unitPrice?: number | null;
  unit?: string | null;
  notes?: string | null;
}

export interface CreateBatchWorkOrdersInput {
  clientId: string;
  deliveryDeadline?: string | null;
  notes?: string | null;
  items: BatchWorkOrderItemInput[];
}

export async function createWorkOrder(input: CreateWorkOrderInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!input.clientId) {
      return { success: false, error: "Please select a client." };
    }

    const count = await prisma.workOrder.count();
    const orderNo = `WO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    const targetQty = input.targetQuantity !== undefined && input.targetQuantity !== null ? Number(input.targetQuantity) : 0;
    const totalAmount = new Decimal(targetQty).mul(new Decimal(input.unitPrice || 0));

    const workOrder = await prisma.workOrder.create({
      data: {
        orderNo,
        clientId: input.clientId,
        itemId: input.itemId || null,
        orderTitle: input.orderTitle || null,
        styleNo: input.styleNo || null,
        unit: input.unit || "Pcs",
        fabricDetails: input.fabricDetails || null,
        colorSpecs: input.colorSpecs || null,
        sizeBreakdown: input.sizeBreakdown || null,
        advanceAmount: new Decimal(input.advanceAmount || 0),
        targetQuantity: targetQty,
        unitPrice: new Decimal(input.unitPrice || 0),
        totalAmount,
        deliveryDeadline: input.deliveryDeadline ? new Date(input.deliveryDeadline) : null,
        notes: input.notes || null,
        createdBy: session.user.id,
        productionStatus: WorkOrderStatus.PENDING,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        item: { select: { id: true, name: true, code: true } },
      },
    });

    revalidateBothPaths("/dashboard/orders");
    return { success: true, workOrder: serialize(workOrder) };
  } catch (error: any) {
    console.error("createWorkOrder error:", error);
    return { success: false, error: error.message || "Failed to create work order" };
  }
}

export async function createBatchWorkOrders(input: CreateBatchWorkOrdersInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!input.clientId) {
      return { success: false, error: "Please select a client." };
    }

    if (!input.items || input.items.length === 0) {
      return { success: false, error: "Please add at least one ordered item." };
    }

    const createdOrders: any[] = [];

    await prisma.$transaction(async (tx) => {
      let count = await tx.workOrder.count();

      for (const item of input.items) {
        count++;
        const orderNo = `WO-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
        const targetQty = item.targetQuantity !== undefined && item.targetQuantity !== null && item.targetQuantity !== 0
          ? Number(item.targetQuantity) 
          : 0;
        const unitPriceNum = item.unitPrice !== undefined && item.unitPrice !== null ? Number(item.unitPrice) : 0;
        const totalAmount = new Decimal(targetQty).mul(new Decimal(unitPriceNum));
        
        let itemTitle = item.orderTitle || null;
        let itemUnit = item.unit || "Pcs";

        if (item.itemId) {
          const it = await tx.item.findUnique({
            where: { id: item.itemId },
            select: { name: true, unit: { select: { symbol: true } } }
          });
          if (it) {
            if (!itemTitle) itemTitle = it.name;
            if (it.unit?.symbol && (!item.unit || item.unit === "Pcs")) itemUnit = it.unit.symbol;
          }
        }

        const wo = await tx.workOrder.create({
          data: {
            orderNo,
            clientId: input.clientId,
            itemId: item.itemId || null,
            orderTitle: itemTitle,
            styleNo: item.styleNo || null,
            unit: itemUnit,
            targetQuantity: targetQty,
            unitPrice: new Decimal(unitPriceNum),
            totalAmount,
            deliveryDeadline: input.deliveryDeadline ? new Date(input.deliveryDeadline) : null,
            notes: item.notes || input.notes || null,
            createdBy: session.user.id,
            productionStatus: WorkOrderStatus.PENDING,
          },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            item: { select: { id: true, name: true, code: true } },
          }
        });
        createdOrders.push(wo);
      }
    });

    revalidateBothPaths("/dashboard/orders");
    return { success: true, count: createdOrders.length, workOrders: serialize(createdOrders) };
  } catch (error: any) {
    console.error("createBatchWorkOrders error:", error);
    return { success: false, error: error.message || "Failed to create work orders" };
  }
}

export async function getWorkOrders(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: string;
} = {}) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { isTrash: false };

    if (params.status && params.status !== "ALL") {
      where.productionStatus = params.status as WorkOrderStatus;
    }

    if (params.clientId && params.clientId !== "ALL") {
      where.clientId = params.clientId;
    }

    if (params.search) {
      where.OR = [
        { orderNo: { contains: params.search, mode: "insensitive" } },
        { orderTitle: { contains: params.search, mode: "insensitive" } },
        { styleNo: { contains: params.search, mode: "insensitive" } },
        { notes: { contains: params.search, mode: "insensitive" } },
        { client: { name: { contains: params.search, mode: "insensitive" } } },
        { item: { name: { contains: params.search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, phone: true, company: true } },
          item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          deliveries: { select: { id: true, deliveredQty: true, deliveryDate: true } },
          saleInvoice: { select: { id: true, saleNumber: true, status: true, grandTotal: true } },
          materialsIn: { select: { id: true, quantity: true, unit: true } },
          materialsOut: { select: { id: true, quantity: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return {
      success: true,
      orders: serialize(orders),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error("getWorkOrders error:", error);
    return { success: false, error: error.message || "Failed to load orders" };
  }
}

export async function getWorkOrderById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const order = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true, company: true, address: true } },
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: { select: { symbol: true, details: true } },
            category: { select: { name: true } },
          },
        },
        createdByUser: { select: { id: true, name: true, email: true } },
        materialsIn: {
          include: {
            item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          },
          orderBy: { receivedDate: "desc" },
        },
        materialsOut: {
          include: {
            item: { select: { id: true, name: true, code: true, unit: { select: { symbol: true } } } },
          },
          orderBy: { issuedDate: "desc" },
        },
        deliveries: {
          orderBy: { deliveryDate: "desc" },
        },
        stockOuts: {
          include: {
            warehouse: { select: { name: true } },
            items: {
              include: {
                item: { select: { name: true, code: true } },
              },
            },
          },
          orderBy: { date: "desc" },
        },
        saleInvoice: {
          include: {
            voucher: {
              include: {
                VoucherLine: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Work order not found" };
    }

    return { success: true, order: serialize(order) };
  } catch (error: any) {
    console.error("getWorkOrderById error:", error);
    return { success: false, error: error.message || "Failed to fetch work order" };
  }
}

export interface UpdateProductionProgressInput {
  producedQuantity: number;
  rejectedQuantity?: number;
  productionStatus: WorkOrderStatus;
  productionNotes?: string | null;
}

export async function updateWorkOrderProduction(id: string, input: UpdateProductionProgressInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const order = await prisma.workOrder.findUnique({ where: { id } });
    if (!order) return { success: false, error: "Work order not found" };

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        producedQuantity: Math.max(0, input.producedQuantity),
        rejectedQuantity: Math.max(0, input.rejectedQuantity || 0),
        productionStatus: input.productionStatus,
        productionNotes: input.productionNotes !== undefined ? input.productionNotes : order.productionNotes,
      },
      include: {
        client: { select: { name: true } },
        item: { select: { name: true } },
      },
    });

    revalidateBothPaths(`/dashboard/orders/${id}`);
    revalidateBothPaths("/dashboard/orders");
    return { success: true, order: serialize(updated) };
  } catch (error: any) {
    console.error("updateWorkOrderProduction error:", error);
    return { success: false, error: error.message || "Failed to update production progress" };
  }
}

export interface CreateDeliveryInput {
  deliveredQty: number;
  driverName?: string | null;
  vehicleNo?: string | null;
  notes?: string | null;
}

export async function createWorkOrderDelivery(workOrderId: string, input: CreateDeliveryInput) {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!input.deliveredQty || input.deliveredQty <= 0) {
      return { success: false, error: "Please specify a valid delivery quantity." };
    }

    const order = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { deliveries: true },
    });
    if (!order) return { success: false, error: "Work order not found" };

    const totalAlreadyDelivered = order.deliveries.reduce((sum, d) => sum + d.deliveredQty, 0);
    const newTotal = totalAlreadyDelivered + input.deliveredQty;

    const count = await prisma.workOrderDelivery.count();
    const challanNo = `DC-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const delivery = await prisma.workOrderDelivery.create({
      data: {
        challanNo,
        workOrderId,
        deliveredQty: input.deliveredQty,
        driverName: input.driverName || null,
        vehicleNo: input.vehicleNo || null,
        notes: input.notes || null,
      },
    });

    // If fully or partially delivered, update status if appropriate
    if (newTotal >= order.targetQuantity) {
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { productionStatus: WorkOrderStatus.DELIVERED },
      });
    }

    revalidateBothPaths(`/dashboard/orders/${workOrderId}`);
    revalidateBothPaths("/dashboard/orders");
    return { success: true, delivery: serialize(delivery) };
  } catch (error: any) {
    console.error("createWorkOrderDelivery error:", error);
    return { success: false, error: error.message || "Failed to create delivery challan" };
  }
}

export interface GenerateInvoiceInput {
  unitPrice?: number;
  paidAmount?: number;
  notes?: string | null;
}

export async function generateWorkOrderInvoice(workOrderId: string, input: GenerateInvoiceInput = {}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const order = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        client: true,
        item: true,
        deliveries: true,
        saleInvoice: true,
      },
    });

    if (!order) return { success: false, error: "Work order not found" };
    if (order.saleInvoiceId) {
      return { success: false, error: "Invoice already generated for this work order." };
    }

    // Determine quantity to bill (total delivered or target qty)
    const deliveredQty = order.deliveries.reduce((sum, d) => sum + d.deliveredQty, 0);
    const billingQty = deliveredQty > 0 ? deliveredQty : (order.producedQuantity > 0 ? order.producedQuantity : order.targetQuantity);
    const rate = input.unitPrice !== undefined ? new Decimal(input.unitPrice) : order.unitPrice;
    const subTotal = rate.mul(new Decimal(billingQty));
    const grandTotal = subTotal;

    // Get default warehouse
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: { isTrash: false, status: "active" },
    });
    if (!defaultWarehouse) {
      return { success: false, error: "No active warehouse found to assign sale." };
    }

    let saleItemId = order.itemId;
    if (!saleItemId) {
      const anyItem = await prisma.item.findFirst({ where: { isTrash: false } });
      saleItemId = anyItem?.id || null;
    }

    if (!saleItemId) {
      return { success: false, error: "An active item must exist in the system to create a sale line item." };
    }

    const itemDesc = order.orderTitle 
      ? `${order.orderTitle} (${order.styleNo || order.orderNo})` 
      : (order.item?.name ? `${order.item.name} (${order.orderNo})` : `Order ${order.orderNo}`);

    const saleCount = await prisma.sale.count();
    const saleNumber = `INV-${new Date().getFullYear()}-${String(saleCount + 1).padStart(5, "0")}`;

    // Create Sale Invoice
    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        clientId: order.clientId,
        warehouseId: defaultWarehouse.id,
        status: SaleStatus.COMPLETED,
        subTotal,
        grandTotal,
        orderType: OrderType.WHOLESALE,
        createdBy: session.user.id,
        notes: input.notes || `Generated from Work Order ${order.orderNo}`,
        items: {
          create: [
            {
              itemId: saleItemId,
              quantity: billingQty,
              unitPrice: rate,
              amount: grandTotal,
              description: `Job-work manufacturing for ${itemDesc}`,
            },
          ],
        },
      },
    });

    // Link sale to work order
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { saleInvoiceId: sale.id },
    });

    revalidateBothPaths(`/dashboard/orders/${workOrderId}`);
    revalidateBothPaths("/dashboard/orders");
    revalidateBothPaths("/dashboard/sales");

    return { success: true, sale: serialize(sale) };
  } catch (error: any) {
    console.error("generateWorkOrderInvoice error:", error);
    return { success: false, error: error.message || "Failed to generate invoice" };
  }
}

export async function getClientsAndItemsForSelect() {
  try {
    const [clients, items] = await Promise.all([
      prisma.client.findMany({
        where: { status: "active" },
        select: { id: true, name: true, phone: true, company: true },
        orderBy: { name: "asc" },
      }),
      prisma.item.findMany({
        where: { isTrash: false, status: "active" },
        select: {
          id: true,
          name: true,
          code: true,
          salesPrice: true,
          costPrice: true,
          itemType: true,
          category: { select: { name: true } },
          unit: { select: { symbol: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      success: true,
      clients: serialize(clients),
      items: serialize(items),
    };
  } catch (error: any) {
    console.error("getClientsAndItemsForSelect error:", error);
    return { success: false, clients: [], items: [] };
  }
}

export interface UpdateWorkOrderInput {
  clientId?: string;
  itemId?: string | null;
  orderTitle?: string | null;
  styleNo?: string | null;
  unit?: string | null;
  fabricDetails?: string | null;
  colorSpecs?: string | null;
  sizeBreakdown?: string | null;
  advanceAmount?: number | null;
  targetQuantity?: number;
  unitPrice?: number;
  deliveryDeadline?: string | null;
  notes?: string | null;
}

export async function updateWorkOrder(id: string, input: UpdateWorkOrderInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const existing = await prisma.workOrder.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Work order not found" };

    const targetQuantity = input.targetQuantity !== undefined ? input.targetQuantity : existing.targetQuantity;
    const unitPrice = input.unitPrice !== undefined ? new Decimal(input.unitPrice) : existing.unitPrice;
    const totalAmount = new Decimal(targetQuantity).mul(unitPrice);

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
        itemId: input.itemId !== undefined ? input.itemId : existing.itemId,
        orderTitle: input.orderTitle !== undefined ? input.orderTitle : existing.orderTitle,
        styleNo: input.styleNo !== undefined ? input.styleNo : existing.styleNo,
        unit: input.unit !== undefined ? input.unit : existing.unit,
        fabricDetails: input.fabricDetails !== undefined ? input.fabricDetails : existing.fabricDetails,
        colorSpecs: input.colorSpecs !== undefined ? input.colorSpecs : existing.colorSpecs,
        sizeBreakdown: input.sizeBreakdown !== undefined ? input.sizeBreakdown : existing.sizeBreakdown,
        advanceAmount: input.advanceAmount !== undefined ? new Decimal(input.advanceAmount || 0) : existing.advanceAmount,
        targetQuantity,
        unitPrice,
        totalAmount,
        deliveryDeadline: input.deliveryDeadline !== undefined ? (input.deliveryDeadline ? new Date(input.deliveryDeadline) : null) : existing.deliveryDeadline,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        item: { select: { id: true, name: true, code: true } },
      },
    });

    revalidateBothPaths(`/dashboard/orders/${id}`);
    revalidateBothPaths("/dashboard/orders");
    return { success: true, workOrder: serialize(updated) };
  } catch (error: any) {
    console.error("updateWorkOrder error:", error);
    return { success: false, error: error.message || "Failed to update work order" };
  }
}

export async function deleteWorkOrder(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const existing = await prisma.workOrder.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Work order not found" };

    await prisma.workOrder.update({
      where: { id },
      data: { isTrash: true },
    });

    revalidateBothPaths("/dashboard/orders");
    return { success: true };
  } catch (error: any) {
    console.error("deleteWorkOrder error:", error);
    return { success: false, error: error.message || "Failed to delete work order" };
  }
}

