import React from "react";
import { getStockOut } from "../_actions/stock-out.action";
import StockOutDetails from "./_components/stock-out-details";
import { notFound } from "next/navigation";

export default async function StockOutDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const result = await getStockOut(resolvedParams.id);

  if (!result.success || !result.stockOut) {
    console.error("Failed to load stock out record:", result);
    return notFound();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <StockOutDetails initialData={result.stockOut} />
    </div>
  );
}
