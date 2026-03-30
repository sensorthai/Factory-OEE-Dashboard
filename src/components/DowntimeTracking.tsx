import React, { useState, useEffect } from "react";
import { 
  Clock, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  Activity, 
  CheckCircle2, 
  ArrowRight,
  PieChart as PieChartIcon,
  Layers,
  MoreVertical
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import axios from "axios";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/src/lib/utils";
import { ThingsBoardService } from "@/src/services/ThingsBoardService";
import { useDeviceStore } from "@/src/store/useDeviceStore";
import { LoadingState } from "@/src/components/shared/LoadingState";

interface DowntimeEvent {
  id: number;
  device_id: string;
  reason: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  category: "Mechanical" | "Electrical" | "Operational" | "Maintenance" | "Other";
  type: "Planned" | "Unplanned" | "Custom";
  comments: string;
  root_cause: string;
}

const CATEGORY_COLORS = {
  Mechanical: "#f97316",
  Electrical: "#3b82f6",
  Operational: "#22c55e",
  Maintenance: "#a855f7",
  Other: "#64748b"
};

export function DowntimeTracking() {
  const [events, setEvents] = useState<DowntimeEvent[]>([]);
  const { devices, isLoading: isDevicesLoading, fetchDevices } = useDeviceStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    device_id: "",
    reason: "",
    category: "Mechanical",
    type: "Unplanned",
    comments: "",
    root_cause: "",
    start_time: format(new Date(Date.now() - 3600000), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const fetchData = async () => {
    try {
      const eventsRes = await axios.get("/api/downtime");
      setEvents(eventsRes.data);
      if (devices.length === 0) {
        await fetchDevices();
      }
    } catch (err) {
      console.error("Failed to fetch downtime data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-detect downtime from ThingsBoard status
  useEffect(() => {
    if (devices.length === 0) return;

    const checkDowntime = async () => {
      for (const device of devices) {
        try {
          const telemetry = await ThingsBoardService.getLatestTelemetry(device.id.id);
          const avail = telemetry?.availability?.[0]?.value ? parseFloat(telemetry.availability[0].value) / 100 : 1;
          const perf = telemetry?.performance?.[0]?.value ? parseFloat(telemetry.performance[0].value) / 100 : 1;
          const qual = telemetry?.quality?.[0]?.value ? parseFloat(telemetry.quality[0].value) / 100 : 1;
          
          const oee = Math.round((avail * perf * qual) * 100);
          
          // If OEE is below 30, consider it down
          if (oee < 30) {
            // Check if there's already an active event (for simplicity, we just check if we logged one recently, but here we just log a short event if not exists)
            // In a real app, we'd track state. For now, we'll just log a 5 min event if none exists in the last 5 mins.
            const recentEvent = events.find(e => e.device_id === device.id.id && differenceInMinutes(new Date(), new Date(e.end_time)) < 5);
            if (!recentEvent) {
              await axios.post("/api/downtime", {
                device_id: device.id.id,
                reason: "Auto-detected: Low OEE/Offline",
                category: "Operational",
                type: "Unplanned",
                comments: "System detected OEE below 30%",
                start_time: format(new Date(Date.now() - 5 * 60000), "yyyy-MM-dd'T'HH:mm"),
                end_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                duration_minutes: 5
              });
              fetchData();
            }
          }
        } catch (e) {
          console.error(`Error checking downtime for ${device.name}`, e);
        }
      }
    };

    const interval = setInterval(checkDowntime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [devices, events]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = differenceInMinutes(new Date(formData.end_time), new Date(formData.start_time));
    try {
      await axios.post("/api/downtime", { ...formData, duration_minutes: duration });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create downtime event", err);
    }
  };

  const categoryData = Object.entries(CATEGORY_COLORS).map(([name, color]) => ({
    name,
    value: events.filter(e => e.category === name).reduce((acc, curr) => acc + curr.duration_minutes, 0),
    color
  })).filter(d => d.value > 0);

  const totalDowntime = events.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalEvents = events.length;
  const mttr = totalEvents > 0 ? Math.round(totalDowntime / totalEvents) : 0;
  // Rough MTBF calculation: assume 24/7 operation over the last 30 days (43200 mins)
  const totalUptime = 43200 - totalDowntime;
  const mtbf = totalEvents > 0 ? Math.round(totalUptime / totalEvents / 60) : 0; // in hours

  // Calculate Pareto data (Top Downtime Reasons)
  const reasonMap = events.reduce((acc, curr) => {
    acc[curr.reason] = (acc[curr.reason] || 0) + curr.duration_minutes;
    return acc;
  }, {} as Record<string, number>);
  
  const paretoData = Object.entries(reasonMap)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 5) // Top 5 reasons
    .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, value }));

  const machineData = Object.entries(events.reduce((acc, curr) => {
    const deviceName = devices.find(d => d.id.id === curr.device_id)?.name || "Unknown";
    acc[deviceName] = (acc[deviceName] || 0) + curr.duration_minutes;
    return acc;
  }, {} as Record<string, number>))
  .map(([name, value]) => ({ name, value: value as number }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

  if (isLoading || isDevicesLoading) return <LoadingState fullScreen text="Loading downtime data..." />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Downtime Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                type="text" 
                placeholder="Search downtime events..."
                className="w-full bg-[#111111] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-6 py-3 rounded-2xl transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Log Downtime</span>
            </button>
          </div>

          {/* Pareto Chart */}
          {paretoData.length > 0 && (
            <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
              <h3 className="text-lg font-bold mb-6">Top Downtime Reasons (Pareto)</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paretoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      cursor={{ fill: '#ffffff05' }}
                    />
                    <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Events List */}
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="bg-[#111111] border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white/20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">No downtime events found</h3>
                  <p className="text-white/40 text-sm max-w-xs">Your factory is running smoothly. All downtime events will appear here.</p>
                </div>
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="bg-[#111111] border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", 
                        event.category === "Mechanical" ? "bg-orange-500/10 text-orange-500" :
                        event.category === "Electrical" ? "bg-blue-500/10 text-blue-500" :
                        event.category === "Operational" ? "bg-green-500/10 text-green-500" :
                        "bg-purple-500/10 text-purple-500"
                      )}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{event.reason}</h4>
                        <div className="flex items-center gap-3 text-xs text-white/40 font-bold uppercase tracking-widest mt-1">
                          <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {devices.find(d => d.id.id === event.device_id)?.name || "Unknown Device"}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(event.start_time), "MMM d, HH:mm")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Duration</p>
                        <p className="text-xl font-bold">{event.duration_minutes}m</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Type</p>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          event.type === "Planned" ? "bg-green-500/10 text-green-500" :
                          event.type === "Unplanned" ? "bg-red-500/10 text-red-500" :
                          "bg-white/10 text-white"
                        )}>
                          {event.type || "Unplanned"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Category</p>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          event.category === "Mechanical" ? "bg-orange-500/10 text-orange-500" :
                          event.category === "Electrical" ? "bg-blue-500/10 text-blue-500" :
                          event.category === "Operational" ? "bg-green-500/10 text-green-500" :
                          "bg-purple-500/10 text-purple-500"
                        )}>
                          {event.category}
                        </span>
                      </div>

                      <button className="p-2 hover:bg-white/5 rounded-xl transition-all">
                        <MoreVertical className="w-5 h-5 text-white/40" />
                      </button>
                    </div>
                  </div>
                  {event.comments && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-sm text-white/60 italic">"{event.comments}"</p>
                    </div>
                  )}
                  {event.root_cause && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Root Cause</p>
                      <p className="text-sm text-white/80">{event.root_cause}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Downtime Analytics Sidebar */}
        <div className="space-y-8">
          <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
            <h3 className="text-lg font-bold mb-8">Downtime by Category</h3>
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black tracking-tighter">{totalDowntime}m</span>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total</span>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              {categoryData.map((cat, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-bold text-white/60">{cat.name}</span>
                  </div>
                  <span className="text-xs font-black">{cat.value}m</span>
                </div>
              ))}
            </div>
          </div>

          {machineData.length > 0 && (
            <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
              <h3 className="text-lg font-bold mb-6">Top Machines by Downtime</h3>
              <div className="space-y-4">
                {machineData.map((machine, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white/80">{machine.name}</span>
                      <span className="font-black">{machine.value}m</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(machine.value / Math.max(...machineData.map(m => m.value))) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl space-y-6">
            <h3 className="text-lg font-bold">Key Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">MTTR</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-black text-orange-500">{mttr}</span>
                  <span className="text-xs font-bold text-white/40 mb-1">mins</span>
                </div>
                <p className="text-[10px] text-white/40 mt-2">Mean Time To Repair</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">MTBF</p>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-black text-green-500">{mtbf}</span>
                  <span className="text-xs font-bold text-white/40 mb-1">hrs</span>
                </div>
                <p className="text-[10px] text-white/40 mt-2">Mean Time Between Failures</p>
              </div>
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-bold text-red-500">Critical Impact</h3>
            </div>
            <p className="text-white/40 text-sm mb-6">Downtime has increased by 15% compared to last week. Most issues are Mechanical.</p>
            <button className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-2xl text-xs uppercase tracking-widest transition-all">
              View Impact Report
            </button>
          </div>
        </div>
      </div>

      {/* Log Downtime Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold">Log Downtime Event</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Select Device</label>
                <select 
                  required
                  value={formData.device_id}
                  onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                >
                  <option value="" disabled className="bg-[#111111]">Choose a machine...</option>
                  {devices.map((d) => (
                    <option key={d.id.id} value={d.id.id} className="bg-[#111111]">{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Reason for Downtime</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Motor failure, Belt replacement"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                  >
                    <option value="Planned" className="bg-[#111111]">Planned</option>
                    <option value="Unplanned" className="bg-[#111111]">Unplanned</option>
                    <option value="Custom" className="bg-[#111111]">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Category</label>
                  <select 
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                  >
                    {Object.keys(CATEGORY_COLORS).map((cat) => (
                      <option key={cat} value={cat} className="bg-[#111111]">{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Start Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">End Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Comments/Notes</label>
                <textarea 
                  placeholder="Additional details about the downtime..."
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Root Cause Analysis</label>
                <textarea 
                  placeholder="What was the root cause? (e.g., Worn out bearing, operator error)"
                  value={formData.root_cause}
                  onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-500/20"
                >
                  Log Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
