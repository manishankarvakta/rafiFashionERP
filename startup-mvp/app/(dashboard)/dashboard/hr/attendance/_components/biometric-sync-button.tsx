"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FiUploadCloud } from "react-icons/fi";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BiometricSyncButtonProps {
  fromDate: string;
  toDate: string;
  warehouseId?: string;
}

export default function BiometricSyncButton({ fromDate, toDate, warehouseId }: BiometricSyncButtonProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button 
        variant="outline" 
        onClick={() => {
          startTransition(async () => {
            console.log("⚡ [UI] Sync Device button clicked.");
            console.log(`⚡ [UI] Parameters: fromDate=${fromDate}, toDate=${toDate}, warehouseId=${warehouseId || "ALL"}`);

            toast({ 
              title: "Requesting Sync...", 
              description: `Queueing historical re-sync from ${fromDate} to ${toDate}...` 
            });
            
            const { triggerBulkRangeSync } = await import("../_actions/biometric.action");
            const res = await triggerBulkRangeSync(fromDate, toDate, warehouseId);
              
            if(res.success) {
              console.log("✅ [UI] triggerBulkRangeSync succeeded:", res);
              toast({ title: "Request Enqueued", description: res.message });
              router.refresh();
            } else {
              console.error("❌ [UI] triggerBulkRangeSync failed:", res);
              toast({ title: "Request Error", description: res.error, variant: "destructive" });
            }
          });
        }}
        disabled={isPending}
      >
        <FiUploadCloud className={`mr-2 h-4 w-4 ${isPending ? "animate-bounce" : ""}`} />
        Sync Device
      </Button>
    </div>
  );
}

