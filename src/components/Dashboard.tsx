import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCcw,
  Cpu,
  ArrowLeft,
  Box,
  Circle,
  Bell
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { cn } from "@/src/lib/utils";
import { useDeviceStore, MachineData } from "../store/useDeviceStore";
import { LoadingState } from "./shared/LoadingState";

const COLORS = ["#f97316", "#111111"];

export function Dashboard() {
  const [view, setView] = useState<"grid" | "detail">("grid");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  
  const { devices, machinesData, isLoading, fetchDevices, updateTelemetry } = useDeviceStore();

  // Fetch devices on mount
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Real-time telemetry polling
  useEffect(() => {
    if (devices.length === 0) return;

    updateTelemetry();
    const interval = setInterval(updateTelemetry, 5000);
    return () => clearInterval(interval);
  }, [devices, updateTelemetry]);

  const selectedMachine = selectedDeviceId ? machinesData[selectedDeviceId] : null;

  if (isLoading) return <LoadingState text="Initializing Factory Grid..." fullScreen />;

  if (view === "detail" && selectedMachine) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
        {/* Detail Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView("grid")}
              className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group"
            >
              <ArrowLeft className="w-5 h-5 text-white/60 group-hover:text-white" />
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">{selectedMachine.name}</h2>
              <div className="flex items-center gap-2">
                <Circle className={cn("w-2 h-2 fill-current", 
                  selectedMachine.status === "Running" ? "text-green-500" : 
                  selectedMachine.status === "Idle" ? "text-orange-500" : "text-red-500"
                )} />
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">{selectedMachine.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
              <Box className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold">{selectedMachine.count.toLocaleString()} Units</span>
            </div>
            <button className="p-3 bg-orange-500 rounded-xl text-black hover:bg-orange-400 transition-all">
              <RefreshCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Availability", value: `${selectedMachine.availability}%`, icon: Activity, color: "text-blue-500" },
            { label: "Performance", value: `${selectedMachine.performance}%`, icon: Zap, color: "text-orange-500" },
            { label: "Quality", value: `${selectedMachine.quality}%`, icon: CheckCircle2, color: "text-green-500" },
            { label: "OEE Score", value: `${selectedMachine.oee}%`, icon: Cpu, color: "text-purple-500" },
          ].map((stat, i) => (
            <div key={i} className="bg-[#111111] border border-white/10 p-6 rounded-3xl">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl bg-white/5", stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* OEE Gauge */}
          <div className="lg:col-span-1 bg-[#111111] border border-white/10 p-8 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-lg font-bold mb-8 self-start">OEE Efficiency</h3>
            <div className="w-full aspect-square max-w-[240px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "OEE", value: selectedMachine.oee },
                      { name: "Loss", value: 100 - selectedMachine.oee },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={0}
                    dataKey="value"
                    startAngle={90}
                    endAngle={450}
                  >
                    <Cell fill="#f97316" />
                    <Cell fill="#ffffff05" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black tracking-tighter">{selectedMachine.oee}%</span>
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1">Live Score</span>
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-[#111111] border border-white/10 p-8 rounded-3xl">
            <h3 className="text-lg font-bold mb-8">Performance Trend (24h)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { time: "00:00", oee: 75 }, { time: "04:00", oee: 82 }, { time: "08:00", oee: 68 },
                  { time: "12:00", oee: 85 }, { time: "16:00", oee: 79 }, { time: "20:00", oee: selectedMachine.oee }
                ]}>
                  <defs>
                    <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#ffffff20" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="oee" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        {selectedMachine.alerts.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-red-500">Critical Alerts</h3>
            </div>
            <div className="space-y-3">
              {selectedMachine.alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-red-500/10 rounded-2xl border border-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-red-400">{alert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Factory Grid</h2>
          <p className="text-white/40 text-sm">Real-time status of all connected machines</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2"><Circle className="w-2 h-2 fill-green-500 text-green-500" /> Running</div>
            <div className="flex items-center gap-2"><Circle className="w-2 h-2 fill-orange-500 text-orange-500" /> Idle</div>
            <div className="flex items-center gap-2"><Circle className="w-2 h-2 fill-red-500 text-red-500" /> Down</div>
          </div>
        </div>
      </div>

      {/* Machine Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.values(machinesData).map((machine: MachineData) => (
          <div 
            key={machine.id}
            onClick={() => {
              setSelectedDeviceId(machine.id);
              setView("detail");
            }}
            className="bg-[#0a0a0a] border border-indigo-500/30 rounded-xl p-5 hover:border-indigo-500/60 transition-all cursor-pointer relative overflow-hidden flex flex-col gap-5"
          >
            {/* Top Section */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center border",
                  machine.status === "Running" ? "bg-emerald-500/10 border-emerald-500/20" :
                  machine.status === "Idle" ? "bg-orange-500/10 border-orange-500/20" :
                  "bg-red-500/10 border-red-500/20"
                )}>
                  {machine.status === "Running" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
                   machine.status === "Idle" ? <AlertTriangle className="w-5 h-5 text-orange-500" /> :
                   <Activity className="w-5 h-5 text-red-500" />}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-white">{machine.name}</h3>
                  <p className={cn("text-xs font-bold uppercase tracking-widest",
                    machine.status === "Running" ? "text-emerald-500" :
                    machine.status === "Idle" ? "text-orange-500" :
                    "text-red-500"
                  )}>{machine.status}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest italic">{machine.shift}</span>
            </div>

            {/* Timeline Section */}
            <div className="pt-2">
              <div className="flex justify-between text-[10px] font-bold text-white/40 mb-2">
                <span>08:00</span>
                <span>10:00</span>
                <span>12:00</span>
                <span>14:00</span>
                <span>16:00</span>
                <span>18:00</span>
              </div>
              <div className="h-4 w-full rounded-md overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: '40%' }}></div>
                <div className="h-full bg-orange-500" style={{ width: '10%' }}></div>
                <div className="h-full bg-emerald-500" style={{ width: '30%' }}></div>
                <div className="h-full bg-red-500" style={{ width: '5%' }}></div>
                <div className="h-full bg-emerald-500" style={{ width: '15%' }}></div>
              </div>
            </div>

            <div className="h-px w-full bg-white/5 my-1"></div>

            {/* Operator/Part Section */}
            <div>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Operator/Part</p>
              <p className="text-base font-bold text-white">{machine.operator}</p>
              <p className="text-xs text-white/40">{machine.partNumber}</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-y-6 gap-x-4 pt-2">
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Good Parts</p>
                <p className="text-xl font-black text-emerald-500">{machine.goodParts}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Scrap</p>
                <p className="text-xl font-black text-red-500">{machine.scrap}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Utilization</p>
                <p className="text-xl font-black text-white">{machine.utilization}%</p>
              </div>
              
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Cycle Time</p>
                <p className="text-xl font-black text-red-500 flex items-baseline gap-1">
                  {machine.cycleTime}m <span className="text-[10px] font-normal text-white/40">({machine.targetCycleTime}m)</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Quality</p>
                <p className="text-xl font-black text-white">{machine.quality}%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">OEE</p>
                <p className={cn("text-xl font-black flex items-baseline gap-1", machine.oee < machine.targetOee ? "text-red-500" : "text-emerald-500")}>
                  {machine.oee}% <span className="text-[10px] font-normal text-white/40">({machine.targetOee}%)</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
