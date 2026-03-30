import React from "react";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  activeTab: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  userName?: string;
}

export function Header({ activeTab, isSidebarOpen, setIsSidebarOpen, userName = "JD" }: HeaderProps) {
  return (
    <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <h1 className="text-xl font-medium capitalize">{activeTab.replace("-", " ")}</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-green-500 uppercase tracking-wider">System Live</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-sm font-bold">{userName}</span>
        </div>
      </div>
    </header>
  );
}
