"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Search, Layers, Info, Check, ArrowRight } from "lucide-react";
import { createStockOut, getOrderMaterialsBalance } from "../../_actions/stock-out.action";
import { getStock, getWarehouseStocks } from "../../../stock/_actions/stock.action";
import { getItemVariants } from "../../../../master/items/_actions/item.action";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const stockOutSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  workOrderId: z.string().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1, "Item is required"),
    variantId: z.string().optional().nullable(),
    quantity: z.number().min(0.01, "Quantity must be greater than zero"),
    unitRate: z.number().min(0, "Rate must be positive"),
    description: z.string().optional(),
    amount: z.number().optional()
  })).min(1, "At least one item is required"),
});

type StockOutFormValues = z.infer<typeof stockOutSchema>;

interface StockOutFormProps {
  warehouses: any[];
  items: any[]; 
  workOrders?: any[];
  initialWorkOrderId?: string;
  userContext?: {
    isNormalUser: boolean;
    defaultWarehouseId: string | null;
  };
  initialData?: any;
}

export default function StockOutForm({ 
  warehouses, 
  items, 
  workOrders = [], 
  initialWorkOrderId, 
  userContext, 
  initialData 
}: StockOutFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [itemSearch, setItemSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Work Order Materials Balance State
  const [orderMaterialsLoading, setOrderMaterialsLoading] = useState(false);
  const [orderMaterialsData, setOrderMaterialsData] = useState<{
    order: any;
    materials: any[];
  } | null>(null);

  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [skuModalItem, setSkuModalItem] = useState<{ id: string; description: string; code: string } | null>(null);
  const [skuModalIndex, setSkuModalIndex] = useState<number | null>(null);
  const [skuVariants, setSkuVariants] = useState<any[]>([]);
  const [skuLoading, setSkuLoading] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, boolean>>({});

  const form = useForm<StockOutFormValues>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: {
      warehouseId: initialData?.warehouseId || userContext?.defaultWarehouseId || (warehouses.length > 0 ? warehouses[0].id : ""),
      date: initialData?.date ? new Date(initialData.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      workOrderId: initialData?.workOrderId || initialWorkOrderId || "",
      notes: initialData?.notes || "",
      items: initialData?.items?.length > 0 
        ? initialData.items.map((i: any) => ({
            itemId: i.itemId,
            variantId: i.variantId || null,
            quantity: Number(i.quantity),
            unitRate: Number(i.unitRate),
            description: i.description || "",
            amount: Number(i.amount)
          }))
        : [{ itemId: "", variantId: null, quantity: 0, unitRate: 0, description: "", amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const warehouseId = useWatch({
    control: form.control,
    name: "warehouseId",
  });

  const watchedItems = useWatch({
    control: form.control,
    name: "items",
  }) || [];

  const totalItems = watchedItems.filter((item: any) => !!item?.itemId && (Number(item?.quantity) || 0) > 0).length;
  const totalQuantity = watchedItems.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
  const totalValue = watchedItems.reduce((sum: number, item: any) => sum + ((Number(item?.quantity) || 0) * (Number(item?.unitRate) || 0)), 0);

  const filteredItems = useMemo(() => {
    if (!itemSearch) return items;
    const searchLower = itemSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchLower) ||
        item.code?.toLowerCase().includes(searchLower) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchLower)) ||
        item.variants?.some((v: any) => 
          (v.sku && v.sku.toLowerCase().includes(searchLower)) ||
          (v.barcode && v.barcode.toLowerCase().includes(searchLower))
        )
    );
  }, [items, itemSearch]);

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name?.includes('quantity') || name?.includes('unitRate')) {
         const index = parseInt(name.split('.')[1]);
         if (!isNaN(index)) {
            const qty = value.items?.[index]?.quantity || 0;
            const rate = value.items?.[index]?.unitRate || 0;
            const amount = Math.abs(Number(qty) * Number(rate));
            form.setValue(`items.${index}.amount`, Number(amount.toFixed(2)));
         }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
     if (!warehouseId) return;
     const fetchAllStocks = async () => {
        const res = await getWarehouseStocks(warehouseId);
        if (res.success && res.stocks) {
           const map: Record<string, number> = {};
           res.stocks.forEach(s => {
             if (s.variantId) {
               map[s.variantId] = s.quantity;
             } else if (s.itemId) {
               map[s.itemId] = s.quantity;
             }
           });
           setStockMap(map);
        }
     };
     fetchAllStocks();
  }, [warehouseId]); 

  const handleSkuConfirm = () => {
    if (skuModalIndex === null || !skuModalItem) return;

    const selectedIds = Object.keys(selectedVariants)
      .filter((id) => selectedVariants[id])
      .sort((a, b) => {
        const indexA = skuVariants.findIndex(v => v.id === a);
        const indexB = skuVariants.findIndex(v => v.id === b);
        return indexA - indexB;
      });
    if (selectedIds.length === 0) return;

    const firstVariantId = selectedIds[0];
    const firstVariant = skuVariants.find((v) => v.id === firstVariantId);
    
    if (firstVariant) {
      const description = `${firstVariant.sku}${firstVariant.size ? `, ${firstVariant.size}` : ''}${firstVariant.color ? `, ${firstVariant.color}` : ''}`;
      const costPrice = firstVariant.costPrice ? Number(firstVariant.costPrice) : 0;
      form.setValue(`items.${skuModalIndex}.itemId`, skuModalItem.id);
      form.setValue(`items.${skuModalIndex}.variantId`, firstVariantId);
      form.setValue(`items.${skuModalIndex}.description`, description);
      form.setValue(`items.${skuModalIndex}.unitRate`, costPrice);
    }

    for (let i = 1; i < selectedIds.length; i++) {
      const variantId = selectedIds[i];
      const variant = skuVariants.find((v) => v.id === variantId);
      if (variant) {
        const description = `${variant.sku}${variant.size ? `, ${variant.size}` : ''}${variant.color ? `, ${variant.color}` : ''}`;
        const costPrice = variant.costPrice ? Number(variant.costPrice) : 0;
        append({
          itemId: skuModalItem.id,
          variantId: variantId,
          quantity: 0,
          unitRate: costPrice,
          description: description,
          amount: 0
        });
      }
    }

    setSkuModalOpen(false);
    setSelectedVariants({});
    setSkuVariants([]);
  };

  const watchedWorkOrderId = useWatch({
    control: form.control,
    name: "workOrderId",
  });

  useEffect(() => {
    if (!watchedWorkOrderId) {
      setOrderMaterialsData(null);
      return;
    }
    const fetchOrderMaterials = async () => {
      setOrderMaterialsLoading(true);
      const res = await getOrderMaterialsBalance(watchedWorkOrderId);
      if (res.success && res.order) {
        setOrderMaterialsData({
          order: res.order,
          materials: res.materials || [],
        });
      } else {
        setOrderMaterialsData(null);
      }
      setOrderMaterialsLoading(false);
    };
    fetchOrderMaterials();
  }, [watchedWorkOrderId]);

  const handleAddOrderMaterialToStockOut = (mat: any) => {
    const availableQty = mat.balance > 0 ? mat.balance : 0;
    const rate = mat.unitCost || 0;
    
    // Check if this item is already in list
    const currentList = form.getValues("items") || [];
    const isAlreadyPresent = currentList.some((i) => i.itemId === mat.itemId);

    if (isAlreadyPresent) {
      toast({
        title: "Already in List",
        description: `${mat.itemName} is already added to the stock out table.`,
      });
      return;
    }

    if (availableQty <= 0) {
      toast({
        title: "No Balance",
        description: `${mat.itemName} has no available balance to stock out.`,
        variant: "destructive",
      });
      return;
    }

    const firstEmptyIndex = currentList.findIndex((i) => !i.itemId);

    if (firstEmptyIndex !== -1) {
      form.setValue(`items.${firstEmptyIndex}.itemId`, mat.itemId);
      form.setValue(`items.${firstEmptyIndex}.variantId`, null);
      form.setValue(`items.${firstEmptyIndex}.description`, `${mat.itemName}${mat.itemCode ? ` (${mat.itemCode})` : ''}`);
      form.setValue(`items.${firstEmptyIndex}.quantity`, availableQty);
      form.setValue(`items.${firstEmptyIndex}.unitRate`, rate);
      form.setValue(`items.${firstEmptyIndex}.amount`, Number((availableQty * rate).toFixed(2)));
    } else {
      append({
        itemId: mat.itemId,
        variantId: null,
        description: `${mat.itemName}${mat.itemCode ? ` (${mat.itemCode})` : ''}`,
        quantity: availableQty,
        unitRate: rate,
        amount: Number((availableQty * rate).toFixed(2)),
      });
    }

    toast({
      title: "Material Added",
      description: `Added ${mat.itemName} (${availableQty} ${mat.unit}) to stock out list.`,
    });
  };

  const onSubmit = async (values: StockOutFormValues) => {
    // If tied to a Work Order, validate that quantity out does not exceed order available balance
    if (values.workOrderId && orderMaterialsData?.materials) {
      for (const mat of orderMaterialsData.materials) {
        const matchingItems = values.items.filter((i) => i.itemId === mat.itemId);
        const totalRequestedQty = matchingItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
        if (totalRequestedQty > mat.balance) {
          toast({
            title: "Balance Exceeded",
            description: `Total quantity for "${mat.itemName}" (${totalRequestedQty} ${mat.unit}) exceeds available order balance (${mat.balance} ${mat.unit}).`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
         warehouseId: values.warehouseId,
         date: new Date(values.date),
         workOrderId: values.workOrderId || null,
         notes: values.notes,
         items: values.items.map(i => ({
             itemId: i.itemId,
             variantId: i.variantId || null,
             quantity: i.quantity,
             unitRate: i.unitRate
         })),
      };

      let res;
      if (initialData?.id) {
        const { updateStockOut } = await import("../../_actions/stock-out.action");
        res = await updateStockOut(initialData.id, payload);
      } else {
        res = await createStockOut(payload);
      }
      
      if (res.success) {
        toast({ title: "Success", description: `Stock out record ${initialData ? 'updated' : 'created'} successfully` });
        router.push("/dashboard/inventory/stock-out");
      } else {
        toast({
          title: "Error",
          description: res.error || "Failed to save stock out record",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemSelect = async (index: number, itemId: string) => {
    form.setValue(`items.${index}.itemId`, itemId);
    const selectedItem = items.find(i => i.id === itemId);
    if (selectedItem) {
       if (selectedItem.itemType === "RETAIL" || selectedItem.itemType === "READY_PRODUCT") {
            const query = itemSearch.trim().toLowerCase();
            const matchedVariant = selectedItem.variants?.find(
              (v: any) => (v.sku && v.sku.toLowerCase() === query) || (v.barcode && v.barcode.toLowerCase() === query)
            );

            if (matchedVariant) {
              const description = `${matchedVariant.sku}${matchedVariant.size ? `, ${matchedVariant.size}` : ''}${matchedVariant.color ? `, ${matchedVariant.color}` : ''}`;
              const costPrice = matchedVariant.costPrice ? Number(matchedVariant.costPrice) : 0;
              form.setValue(`items.${index}.variantId`, matchedVariant.id);
              form.setValue(`items.${index}.description`, description);
              form.setValue(`items.${index}.unitRate`, costPrice);
              
              const qty = form.getValues(`items.${index}.quantity`) || 0;
              form.setValue(`items.${index}.amount`, Number(Math.abs(qty * costPrice).toFixed(2)));

              const currentWarehouseId = form.getValues("warehouseId");
              if (currentWarehouseId) {
                 const res = await getStock(itemId, currentWarehouseId);
                 if (res.success && res.stock) {
                    setStockMap(prev => ({ ...prev, [itemId]: Number(res.stock.quantity) }));
                 } else {
                    setStockMap(prev => ({ ...prev, [itemId]: 0 }));
                 }
              }
            } else {
              setSkuLoading(true);
              const res = await getItemVariants(selectedItem.id);
              if (res.success && res.variants && res.variants.length > 0) {
                  setSkuVariants(res.variants);
                  setSkuModalItem({
                      id: selectedItem.id,
                      description: selectedItem.description || selectedItem.name,
                      code: selectedItem.code
                  });
                  setSkuModalIndex(index);
                  setSkuModalOpen(true);
                  setSkuLoading(false);
                  setSelectedVariants({});
              } else {
                  setSkuModalOpen(false);
                  setSkuLoading(false);

                  form.setValue(`items.${index}.variantId`, null);
                  form.setValue(`items.${index}.unitRate`, Number(selectedItem.costPrice || 0));
                  form.setValue(`items.${index}.description`, selectedItem.description || selectedItem.name || "");
                  
                  const qty = form.getValues(`items.${index}.quantity`) || 0;
                  const rate = Number(selectedItem.costPrice || 0);
                  form.setValue(`items.${index}.amount`, Number(Math.abs(qty * rate).toFixed(2)));

                  const currentWarehouseId = form.getValues("warehouseId");
                  if (currentWarehouseId) {
                     const res = await getStock(itemId, currentWarehouseId);
                     if (res.success && res.stock) {
                        setStockMap(prev => ({ ...prev, [itemId]: Number(res.stock.quantity) }));
                     } else {
                        setStockMap(prev => ({ ...prev, [itemId]: 0 }));
                     }
                  }
              }
            }
       } else {
            form.setValue(`items.${index}.variantId`, null);
            form.setValue(`items.${index}.unitRate`, Number(selectedItem.costPrice || 0));
            form.setValue(`items.${index}.description`, selectedItem.description || selectedItem.name || "");
            
            const qty = form.getValues(`items.${index}.quantity`) || 0;
            const rate = Number(selectedItem.costPrice || 0);
            form.setValue(`items.${index}.amount`, Number(Math.abs(qty * rate).toFixed(2)));

            const currentWarehouseId = form.getValues("warehouseId");
            if (currentWarehouseId) {
               const res = await getStock(itemId, currentWarehouseId);
               if (res.success && res.stock) {
                  setStockMap(prev => ({ ...prev, [itemId]: Number(res.stock.quantity) }));
               } else {
                  setStockMap(prev => ({ ...prev, [itemId]: 0 }));
               }
            }
       }
       setItemSearch("");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* 1. Header Information & Order Link */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Warehouse *</Label>
            <Select 
              onValueChange={(val) => form.setValue("warehouseId", val)} 
              defaultValue={form.getValues("warehouseId")}
              disabled={userContext?.isNormalUser}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.warehouseId && <p className="text-sm text-red-500">{form.formState.errors.warehouseId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" {...form.register("date")} />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Link to Work Order (Optional)
            </Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-medium"
              value={form.watch("workOrderId") || ""}
              onChange={(e) => form.setValue("workOrderId", e.target.value)}
            >
              <option value="">-- No Order Link (General Stock Out) --</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.orderNo} {wo.client?.name ? `• ${wo.client.name}` : ""} {wo.orderTitle || wo.styleNo ? `(${wo.orderTitle || wo.styleNo})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1 md:col-span-3 space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea {...form.register("notes")} placeholder="Reason for stock out or production issuance remarks..." />
          </div>
        </CardContent>
      </Card>

      {/* 2. Work Order Raw Materials Stock In Preview (If Work Order is selected) */}
      {watchedWorkOrderId && (
        <Card className="border-blue-200 bg-blue-50/20 shadow-xs overflow-hidden">
          <div className="bg-blue-50/80 border-b border-blue-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-700" />
                Work Order Stock-In Materials & Available Balance
              </h4>
              {orderMaterialsData?.order && (
                <p className="text-xs text-blue-700 mt-0.5">
                  Order: <strong className="text-blue-900">{orderMaterialsData.order.orderNo}</strong>
                  {orderMaterialsData.order.client?.name && ` • Client: ${orderMaterialsData.order.client.name}`}
                  {orderMaterialsData.order.orderTitle && ` • Style: ${orderMaterialsData.order.orderTitle}`}
                </p>
              )}
            </div>
            <Badge variant="outline" className="bg-white text-blue-800 border-blue-300 text-xs w-fit">
              Order Stock In Tracker
            </Badge>
          </div>

          <CardContent className="p-4">
            {orderMaterialsLoading ? (
              <div className="py-6 text-center text-xs text-blue-600 flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Loading order materials balance...
              </div>
            ) : !orderMaterialsData || orderMaterialsData.materials.length === 0 ? (
              <div className="p-4 text-center bg-white rounded-lg border border-dashed border-blue-200 text-xs text-blue-700">
                <Info className="h-4 w-4 inline mr-1 text-blue-500" />
                No Stock In raw materials recorded for this Work Order yet. You can still select products manually below.
              </div>
            ) : (
              <div className="overflow-x-auto border border-blue-200 rounded-lg bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50/60 border-b border-blue-100 text-blue-900 font-semibold">
                    <tr>
                      <th className="p-2.5">Stocked In Material</th>
                      <th className="p-2.5 text-right">Received (Stock In)</th>
                      <th className="p-2.5 text-right">Already Issued (Stock Out)</th>
                      <th className="p-2.5 text-right">Available Balance</th>
                      <th className="p-2.5 text-center">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 text-gray-800">
                    {orderMaterialsData.materials.map((mat, idx) => {
                      const isAlreadyInList = watchedItems.some((item: any) => item?.itemId === mat.itemId);
                      const isZeroBalance = mat.balance <= 0;

                      return (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-2.5">
                            <span className="font-semibold text-gray-900">{mat.itemName}</span>
                            {mat.itemCode && <span className="text-[11px] text-gray-400 block">{mat.itemCode}</span>}
                          </td>
                          <td className="p-2.5 text-right font-medium text-blue-700">
                            +{mat.totalIn} {mat.unit}
                          </td>
                          <td className="p-2.5 text-right font-medium text-amber-700">
                            -{mat.totalOut} {mat.unit}
                          </td>
                          <td className="p-2.5 text-right font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              mat.balance > 0 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {mat.balance} {mat.unit}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {isAlreadyInList ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled
                                className="h-7 text-[11px] gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed font-medium opacity-100"
                              >
                                <Check className="h-3 w-3 text-emerald-600" /> Already in List
                              </Button>
                            ) : isZeroBalance ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled
                                className="h-7 text-[11px] gap-1 bg-gray-100 text-gray-400 cursor-not-allowed"
                              >
                                No Balance
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddOrderMaterialToStockOut(mat)}
                                className="h-7 text-[11px] gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 font-medium"
                              >
                                <Plus className="h-3 w-3" /> Add to Stock Out List
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Items Out</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: "", variantId: null, quantity: 0, unitRate: 0, description: "", amount: 0 })}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
        </div>

        <Card>
            <div className="p-0">
               <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[20%]">Item</TableHead>
                      <TableHead className="w-[20%]">Description</TableHead>
                      <TableHead className="text-right w-[15%]">Available Stock</TableHead>
                      <TableHead className="text-right w-[15%]">Quantity Out</TableHead>
                      <TableHead className="text-right w-[15%]">Rate (Cost)</TableHead>
                      <TableHead className="text-right w-[10%]">Amount</TableHead>
                      <TableHead className="w-[5%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const currentItemId = form.watch(`items.${index}.itemId`);
                      const currentVariantId = form.watch(`items.${index}.variantId`);
                      const currentStockKey = currentVariantId || currentItemId;
                      const availableStock = currentStockKey ? (stockMap[currentStockKey] ?? 0) : 0;

                      return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <Select
                            onValueChange={(val) => handleItemSelect(index, val)}
                            value={form.getValues(`items.${index}.itemId`)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="p-2 border-b bg-background sticky top-0 z-10">
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search products..."
                                    className="pl-8 h-8"
                                    value={itemSearch}
                                    onChange={(e) => setItemSearch(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto">
                                {filteredItems.map(item => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.code} - {item.name}
                                  </SelectItem>
                                ))}
                                {filteredItems.length === 0 && (
                                  <div className="p-4 text-sm text-center text-muted-foreground">
                                    No products found
                                  </div>
                                )}
                              </div>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                           <Input 
                             placeholder="Description..."
                             {...form.register(`items.${index}.description`)} 
                           />
                        </TableCell>
                        <TableCell className="text-right font-medium text-blue-600 pr-4">
                           {availableStock}
                        </TableCell>
                        <TableCell>
                           <Input 
                             type="number" 
                             step="0.01" 
                             min="0.01"
                             className="text-right"
                             {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} 
                           />
                           {(() => {
                             const orderMat = orderMaterialsData?.materials?.find(m => m.itemId === currentItemId);
                             if (!orderMat) return null;
                             const itemQty = Number(form.watch(`items.${index}.quantity`) || 0);
                             const isOver = itemQty > orderMat.balance;
                             return (
                               <span className={`text-[10px] block text-right mt-0.5 ${isOver ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                                 {isOver ? `Exceeds order balance (${orderMat.balance})` : `Order Max: ${orderMat.balance} ${orderMat.unit}`}
                               </span>
                             );
                           })()}
                        </TableCell>
                        <TableCell>
                           <Input 
                             readOnly
                             type="number" 
                             step="0.01" 
                             min="0"
                              className="text-right bg-muted"
                             {...form.register(`items.${index}.unitRate`, { valueAsNumber: true })} 
                           />
                        </TableCell>
                        <TableCell>
                           <Input 
                               readOnly
                               className="bg-muted text-right font-medium text-red-600"
                               value={form.watch(`items.${index}.amount`) || 0}
                           />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                             <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
               </Table>
            </div>
        </Card>
      </div>

      {/* Summaries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Quantity Out</p>
              <p className="text-2xl font-bold">{totalQuantity.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Valuation Out</p>
              <p className="text-2xl font-bold text-destructive">
                ৳{totalValue.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
         <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
           Cancel
         </Button>
         <Button type="submit" disabled={isSubmitting}>
           {isSubmitting ? "Saving..." : initialData ? "Update Stock Out" : "Save Stock Out"}
         </Button>
      </div>

      <Dialog open={skuModalOpen} onOpenChange={(open) => {
        if (!open) {
          setSkuModalOpen(false);
          if (skuModalIndex !== null && !form.getValues(`items.${skuModalIndex}.variantId`)) {
            form.setValue(`items.${skuModalIndex}.itemId`, "");
          }
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select SKUs/Variants for Stock Out</DialogTitle>
            <DialogDescription>
              Choose the specific SKUs for <strong>{skuModalItem?.code} - {skuModalItem?.description}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {skuLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : skuVariants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No variants/SKUs found for this product.
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto border rounded-md">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted sticky top-0">
                    <TableRow>
                      <TableHead className="w-24 px-4 py-2 text-left">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={skuVariants.length > 0 && skuVariants.every(v => !!selectedVariants[v.id])}
                            onCheckedChange={(checked) => {
                              const newSelected: Record<string, boolean> = {};
                              if (checked) {
                                skuVariants.forEach(v => {
                                  newSelected[v.id] = true;
                                });
                              }
                              setSelectedVariants(newSelected);
                            }}
                          />
                          <span>All</span>
                        </div>
                      </TableHead>
                      <TableHead className="px-4 py-2 text-left">SKU</TableHead>
                      <TableHead className="px-4 py-2 text-left">Size</TableHead>
                      <TableHead className="px-4 py-2 text-left">Color</TableHead>
                      <TableHead className="px-4 py-2 text-right">Stock</TableHead>
                      <TableHead className="px-4 py-2 text-right">Cost Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skuVariants.map((variant) => (
                      <TableRow key={variant.id} className="border-t hover:bg-muted/50">
                        <TableCell className="px-4 py-2">
                          <Checkbox
                            checked={!!selectedVariants[variant.id]}
                            onCheckedChange={(checked) => {
                              setSelectedVariants(prev => ({
                                ...prev,
                                [variant.id]: !!checked
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="px-4 py-2 font-mono text-xs">{variant.sku}</TableCell>
                        <TableCell className="px-4 py-2">{variant.size || "-"}</TableCell>
                        <TableCell className="px-4 py-2">{variant.color || "-"}</TableCell>
                        <TableCell className="px-4 py-2 text-right font-medium text-blue-600">
                          {stockMap[variant.id] ?? 0}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right">
                          {variant.costPrice !== null ? `৳${Number(variant.costPrice).toFixed(2)}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSkuModalOpen(false);
                if (skuModalIndex !== null && !form.getValues(`items.${skuModalIndex}.variantId`)) {
                  form.setValue(`items.${skuModalIndex}.itemId`, "");
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSkuConfirm}
              disabled={skuLoading || Object.keys(selectedVariants).filter(id => selectedVariants[id]).length === 0}
            >
              Confirm Selection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
