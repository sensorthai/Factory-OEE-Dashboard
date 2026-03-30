import React, { useState } from "react";
import { 
  BarChart3, 
  FileText,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { ReportsModule } from "./ReportsModule";

export function Analytics() {
  const [activeSubTab, setActiveSubTab] = useState<"analytics" | "reports">("analytics");

  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveSubTab("analytics")}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSubTab === "analytics" 
              ? "bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]" 
              : "text-white/40 hover:text-white hover:bg-white/5"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics Dashboard
        </button>
        <button
          onClick={() => setActiveSubTab("reports")}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
            activeSubTab === "reports" 
              ? "bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.3)]" 
              : "text-white/40 hover:text-white hover:bg-white/5"
          )}
        >
          <FileText className="w-4 h-4" />
          Reporting Module
        </button>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeSubTab === "analytics" ? (
          <AnalyticsDashboard />
        ) : (
          <ReportsModule />
        )}
      </div>
    </div>
  );
}
