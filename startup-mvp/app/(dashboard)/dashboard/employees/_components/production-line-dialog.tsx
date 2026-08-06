"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProductionLine } from "../_actions/production-line.action";

export default function ProductionLineDialog({
  onCancel,
  onCreated
}: {
  onCancel: () => void;
  onCreated: (newLine: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    try {
      setLoading(true);
      setError("");
      const res = await createProductionLine({ name, code });
      if (res.success && res.line) {
        onCreated(res.line);
      } else {
        setError(res.error || "Failed to create line");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-1">
        <Label>Line Name *</Label>
        <Input placeholder="Line 3" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>Line Code *</Label>
        <Input placeholder="line-3" value={code} onChange={(e) => setCode(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>Save</Button>
      </div>
    </form>
  );
}
