import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "./PrintButton";

export default async function DeliveryChallanPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const delivery = await prisma.workOrderDelivery.findUnique({
    where: { id: resolvedParams.id },
    include: {
      workOrder: {
        include: {
          client: true,
          item: {
            include: {
              unit: true,
            },
          },
          createdByUser: true,
        },
      },
    },
  });

  if (!delivery) {
    return notFound();
  }

  const { workOrder } = delivery;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 text-black print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-sm border print:border-none print:shadow-none print:p-4">
        {/* Action Bar */}
        <div className="flex justify-between items-center pb-6 mb-6 border-b print:hidden">
          <Link href={`/dashboard/orders/${workOrder.id}`} className="text-sm text-blue-600 hover:underline">
            ← Back to Order
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
          </div>
        </div>

        {/* Company & Challan Header */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-gray-900">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              Rafi Fashion ERP
            </h1>
            <p className="text-xs text-gray-600 font-medium">
              Garments Manufacturing & Job-Work Facility
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Contact: +880 1700-000000 | Email: factory@rafifashion.com
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-sm tracking-wider uppercase rounded">
              Delivery Challan & Gate Pass
            </span>
            <div className="text-sm font-bold text-gray-900 mt-2">
              Challan #: {delivery.challanNo}
            </div>
            <div className="text-xs text-gray-600">
              Date: {new Date(delivery.deliveryDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Client & Order Info Grid */}
        <div className="grid grid-cols-2 gap-6 my-6 text-xs">
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider mb-1.5 text-[11px]">
              Customer / Consignee:
            </h3>
            <p className="font-bold text-sm text-gray-900">{workOrder.client?.name}</p>
            {workOrder.client?.company && <p className="text-gray-700">{workOrder.client.company}</p>}
            {workOrder.client?.phone && <p className="text-gray-600">Phone: {workOrder.client.phone}</p>}
            {workOrder.client?.address && <p className="text-gray-600">Address: {workOrder.client.address}</p>}
          </div>

          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider mb-1.5 text-[11px]">
              Dispatch & Order Details:
            </h3>
            <p><span className="text-gray-500 font-medium">Work Order #:</span> <strong>{workOrder.orderNo}</strong></p>
            <p><span className="text-gray-500 font-medium">Target Order Qty:</span> <strong>{workOrder.targetQuantity} {workOrder.item?.unit?.symbol || "Pcs"}</strong></p>
            {delivery.driverName && <p><span className="text-gray-500 font-medium">Carrier/Driver:</span> <strong>{delivery.driverName}</strong></p>}
            {delivery.vehicleNo && <p><span className="text-gray-500 font-medium">Vehicle / Truck No:</span> <strong>{delivery.vehicleNo}</strong></p>}
          </div>
        </div>

        {/* Delivery Line Items Table */}
        <div className="my-6">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-900 text-white uppercase text-[10px] tracking-wider">
                <th className="p-2.5 w-12 text-center">SL</th>
                <th className="p-2.5">Item Description</th>
                <th className="p-2.5">Item Code</th>
                <th className="p-2.5 text-center">Unit</th>
                <th className="p-2.5 text-right">Delivered Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-b border-gray-200">
              <tr>
                <td className="p-3 text-center font-medium">1</td>
                <td className="p-3">
                  <span className="font-bold text-sm block text-gray-900">{workOrder.item?.name}</span>
                  <span className="text-gray-500 text-[11px]">Finished Good - Manufactured against {workOrder.orderNo}</span>
                </td>
                <td className="p-3 font-mono text-gray-600">{workOrder.item?.code}</td>
                <td className="p-3 text-center">{workOrder.item?.unit?.symbol || "Pcs"}</td>
                <td className="p-3 text-right font-black text-sm text-gray-900">
                  {delivery.deliveredQty} {workOrder.item?.unit?.symbol || "Pcs"}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="p-2.5 text-right uppercase text-gray-700">
                  Total Dispatched Quantity:
                </td>
                <td className="p-2.5 text-right font-black text-sm text-gray-900">
                  {delivery.deliveredQty} {workOrder.item?.unit?.symbol || "Pcs"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {delivery.notes && (
          <div className="my-4 p-2.5 bg-gray-50 border border-dashed rounded text-xs text-gray-700">
            <strong>Remarks / Instructions:</strong> {delivery.notes}
          </div>
        )}

        {/* Signatures & Gate Pass Authorization */}
        <div className="grid grid-cols-4 gap-4 mt-20 pt-8 border-t text-center text-xs">
          <div>
            <div className="border-t border-gray-400 pt-1.5 font-semibold text-gray-800">
              Prepared By
            </div>
            <span className="text-[10px] text-gray-500">{workOrder.createdByUser?.name || "Officer"}</span>
          </div>

          <div>
            <div className="border-t border-gray-400 pt-1.5 font-semibold text-gray-800">
              Store In-Charge
            </div>
          </div>

          <div>
            <div className="border-t border-gray-400 pt-1.5 font-semibold text-gray-800">
              Security Gate Pass
            </div>
          </div>

          <div>
            <div className="border-t border-gray-400 pt-1.5 font-semibold text-gray-800">
              Received By (Customer)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
