import React from "react";
import { getWarehouses } from "../../../../master/warehouses/_actions/warehouse.action";
import { getActiveItems } from "../../../stock/_actions/stock.action";
import { getStockOut } from "../../_actions/stock-out.action";
import StockOutForm from "../../add/_components/stock-out-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

export default async function EditStockOutPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const session = await auth();
  const userContext = { isNormalUser: false, defaultWarehouseId: null as string | null };

  if (session?.user) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, defaultWarehouseId: true }
    });
    if (u && u.role !== "admin" && u.role !== "superadmin") {
      userContext.isNormalUser = true;
      userContext.defaultWarehouseId = u.defaultWarehouseId;
    }
  }

  const stockOutRes = await getStockOut(resolvedParams.id);

  if (!stockOutRes.success || !stockOutRes.stockOut) {
    return notFound();
  }

  if (stockOutRes.stockOut.status !== "DRAFT" || stockOutRes.stockOut.isTrash) {
    return redirect(`/dashboard/inventory/stock-out/${resolvedParams.id}`);
  }

  const [warehousesRes, itemsRes] = await Promise.all([
    getWarehouses(1, 100),
    getActiveItems()
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/inventory/stock-out/${resolvedParams.id}`} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Edit Stock Out Record</h1>
          <p className="text-sm text-muted-foreground">Modify draft stock out record details.</p>
        </div>
      </div>

      <StockOutForm 
        warehouses={warehousesRes.success ? warehousesRes.warehouses : []}
        items={itemsRes.success ? itemsRes.items : []}
        userContext={userContext}
        initialData={stockOutRes.stockOut}
      />
    </div>
  );
}
