"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

export default function PrintButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => window.print()}
      className="print:hidden bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2 text-xs font-semibold"
    >
      <Printer size={14} /> Print Challan
    </button>
  );
}
