import React from "react";
import { 
  LayoutDashboard, 
  CalendarRange, 
  BarChart3, 
  Clock, 
  LogOut, 
  Factory,
  Layers,
  Cpu
} from "lucide-react";
import { cn } from "@/src/lib/utils";

export type Tab = "dashboard" | "planning" | "analytics" | "assets" | "devices" | "downtime";

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  isSidebarOpen: boolean;
  logout: () => void;
}

export function Sidebar({ activeTab, setActiveTab, isSidebarOpen, logout }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Real-time OEE", icon: LayoutDashboard },
    { id: "planning", label: "Production Planning", icon: CalendarRange },
    { id: "analytics", label: "Analytics & Reports", icon: BarChart3 },
    { id: "assets", label: "Asset Hierarchy", icon: Layers },
    { id: "devices", label: "Device Management", icon: Cpu },
    { id: "downtime", label: "Downtime Tracking", icon: Clock },
  ];

  return (
    <aside 
      className={cn(
        "bg-[#111111] border-r border-white/10 transition-all duration-300 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}
    >
      <div className="p-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
          <Factory className="w-5 h-5 text-black" />
        </div>
        {isSidebarOpen && <span className="font-bold text-lg tracking-tight">Voltera OEE</span>}
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
              activeTab === item.id 
                ? "bg-orange-500 text-black font-semibold" 
                : "text-white/60 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-black" : "text-white/60 group-hover:text-white")} />
            {isSidebarOpen && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          {isSidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
