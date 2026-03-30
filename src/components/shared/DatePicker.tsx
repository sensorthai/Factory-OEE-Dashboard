import React from "react";
import { Calendar } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  return (
    <div className="space-y-3 w-full">
      {label && <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{label}</label>}
      <div className="relative">
        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        <input 
          type="date" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white"
        />
      </div>
    </div>
  );
}
