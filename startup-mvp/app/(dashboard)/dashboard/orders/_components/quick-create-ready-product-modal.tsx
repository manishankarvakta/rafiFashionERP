"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FiPackage, FiSave } from "react-icons/fi";
import {
  createItem,
  getActiveCategories,
  getActiveUnits,
} from "../../master/items/_actions/item.action";

interface QuickCreateReadyProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newItem: any) => void;
}

export function QuickCreateReadyProductModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickCreateReadyProductModalProps) {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; symbol: string; details?: string | null }>>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [salesPrice, setSalesPrice] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [description, setDescription] = useState("");

  // Load dropdowns when modal opens
  useEffect(() => {
    if (!open) return;

    async function loadDropdowns() {
      setIsLoadingDropdowns(true);
      try {
        const [catRes, unitRes] = await Promise.all([
          getActiveCategories(),
          getActiveUnits(),
        ]);

        if (catRes.success && catRes.categories) {
          setCategories(catRes.categories);
        }
        if (unitRes.success && unitRes.units) {
          setUnits(unitRes.units);
          // Auto-select 'Pcs' or first unit if not selected
          if (!unitId) {
            const pcsUnit = unitRes.units.find(
              (u: any) => u.symbol.toLowerCase() === "pcs" || u.symbol.toLowerCase() === "pc"
            );
            if (pcsUnit) {
              setUnitId(pcsUnit.id);
            } else if (unitRes.units.length > 0) {
              setUnitId(unitRes.units[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load categories/units for quick create:", err);
      } finally {
        setIsLoadingDropdowns(false);
      }
    }

    loadDropdowns();
  }, [open]);

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a product name.");
      return;
    }

    if (!unitId) {
      toast.error("Please select a unit of measurement.");
      return;
    }

    const parsedSalesPrice = Number(salesPrice);
    if (!salesPrice || isNaN(parsedSalesPrice) || parsedSalesPrice <= 0) {
      toast.error("Please enter a valid sales price (greater than 0).");
      return;
    }

    const parsedCostPrice = costPrice ? Number(costPrice) : 0;
    if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      toast.error("Cost price cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createItem({
        name: name.trim(),
        itemType: "READY_PRODUCT",
        unitId,
        categoryId: categoryId || null,
        costPrice: parsedCostPrice,
        salesPrice: parsedSalesPrice,
        description: description.trim() || undefined,
        status: "active",
        trackInventory: true,
      });

      if (res.success && res.item) {
        toast.success(`Ready Product "${res.item.name}" created successfully!`);
        
        // Find category and unit objects for immediate frontend rendering
        const selectedCat = categories.find((c) => c.id === categoryId);
        const selectedUnit = units.find((u) => u.id === unitId);

        const enrichedItem = {
          ...res.item,
          category: selectedCat ? { name: selectedCat.name } : res.item.category || null,
          unit: selectedUnit ? { symbol: selectedUnit.symbol } : res.item.unit || null,
        };

        // Reset form
        setName("");
        setCategoryId("");
        setSalesPrice("");
        setCostPrice("");
        setDescription("");

        onSuccess(enrichedItem);
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to create ready product.");
      }
    } catch (error: any) {
      console.error("Quick create ready product error:", error);
      toast.error("An unexpected error occurred while creating product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border border-gray-200 shadow-xl rounded-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4 bg-gray-50/80 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gray-900 text-white rounded-lg">
              <FiPackage className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-gray-900">
                Quick Add Ready Product
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500 mt-0.5">
                Create a Ready Product without leaving this page. It will be saved into Master Items.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Product Name */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-name" className="text-xs font-semibold text-gray-700">
              Product / Garment Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quick-name"
              required
              placeholder="e.g. Classic Oxford Shirt, Cotton T-Shirt..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs border-gray-300 focus:ring-gray-900"
              autoFocus
            />
          </div>

          {/* Category & Unit in 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-category" className="text-xs font-semibold text-gray-700">
                Category (Optional)
              </Label>
              <select
                id="quick-category"
                className="w-full h-9 px-2.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 font-medium focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isLoadingDropdowns}
              >
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-unit" className="text-xs font-semibold text-gray-700">
                Unit <span className="text-red-500">*</span>
              </Label>
              <select
                id="quick-unit"
                required
                className="w-full h-9 px-2.5 rounded-md border border-gray-300 bg-white text-xs text-gray-900 font-medium focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={isLoadingDropdowns}
              >
                <option value="">-- Select Unit --</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.symbol} {u.details ? `(${u.details})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing in 2 Columns: Sales Price & Cost Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-sales-price" className="text-xs font-semibold text-gray-700">
                Sales Price <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-sales-price"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                value={salesPrice}
                onChange={(e) => setSalesPrice(e.target.value)}
                className="h-9 text-xs font-semibold border-gray-300 focus:ring-gray-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-cost-price" className="text-xs font-semibold text-gray-700">
                Cost Price (Optional)
              </Label>
              <Input
                id="quick-cost-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="h-9 text-xs border-gray-300 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-description" className="text-xs font-semibold text-gray-700">
              Description / Notes (Optional)
            </Label>
            <Textarea
              id="quick-description"
              rows={2}
              placeholder="e.g. 100% Cotton, 180 GSM, Export quality..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs border-gray-300 focus:ring-gray-900 resize-none"
            />
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-8 text-xs border-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs gap-1.5 bg-gray-900 hover:bg-black text-white"
            >
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? "Creating..." : "Save & Select"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
