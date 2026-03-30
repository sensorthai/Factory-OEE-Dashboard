import React, { useState, useEffect } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
  PieChart, Pie,
  AreaChart, Area
} from "recharts";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Activity,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown
} from "lucide-react";
import { ThingsBoardService } from "../services/ThingsBoardService";
import { motion } from "motion/react";
import { useDeviceStore } from "@/src/store/useDeviceStore";
import { LoadingState } from "@/src/components/shared/LoadingState";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const AnalyticsDashboard: React.FC = () => {
  const { devices, isLoading: isDevicesLoading, fetchDevices } = useDeviceStore();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [period, setPeriod] = useState<string>("day");
  const [trends, setTrends] = useState<any[]>([]);
  const [pareto, setPareto] = useState<any[]>([]);
  const [losses, setLosses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id.id);
    }
  }, [devices, selectedDevice]);

  useEffect(() => {
    if (selectedDevice) {
      loadAnalytics();
    }
  }, [selectedDevice, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [trendsData, paretoData, lossesData, summaryData] = await Promise.all([
        ThingsBoardService.getOeeTrends(selectedDevice, period),
        ThingsBoardService.getDowntimePareto(selectedDevice),
        ThingsBoardService.getLossAnalysis(selectedDevice),
        ThingsBoardService.getAnalyticsSummary(selectedDevice)
      ]);
      setTrends(trendsData);
      setPareto(paretoData);
      setLosses(lossesData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load analytics", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || isDevicesLoading) return <LoadingState fullScreen text="Loading Analytics..." />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <select 
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-[#111111] border border-white/10 rounded-2xl py-3 pl-4 pr-10 text-sm font-bold focus:outline-none focus:border-orange-500/50 transition-all appearance-none text-white"
            >
              {devices.map(d => (
                <option key={d.id.id} value={d.id.id}>{d.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
          </div>

          <div className="flex bg-[#111111] border border-white/10 rounded-2xl p-1">
            {['day', 'week', 'month'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  period === p 
                    ? 'bg-orange-500 text-black shadow-sm' 
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Average OEE', value: summary?.avg_oee ? `${(summary.avg_oee * 100).toFixed(1)}%` : 'N/A', icon: Activity, color: 'text-orange-500', trend: '+2.4%' },
          { label: 'Peak OEE', value: summary?.peak_oee ? `${(summary.peak_oee * 100).toFixed(1)}%` : 'N/A', icon: TrendingUp, color: 'text-emerald-500', trend: '+1.2%' },
          { label: 'Avg Availability', value: summary?.avg_availability ? `${(summary.avg_availability * 100).toFixed(1)}%` : 'N/A', icon: Clock, color: 'text-amber-500', trend: '-0.5%' },
          { label: 'Downtime Events', value: pareto.length.toString(), icon: AlertTriangle, color: 'text-rose-500', trend: '-12%' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#111111] border border-white/10 p-6 rounded-3xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-bold tracking-tight mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* OEE Trend Chart */}
        <div className="lg:col-span-2 bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">OEE Performance Trends</h3>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500"></div> OEE</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Performance</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Availability</div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(v: any) => [`${(v * 100).toFixed(1)}%`]}
                />
                <Area type="monotone" dataKey="oee" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" />
                <Line type="monotone" dataKey="performance" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="availability" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loss Analysis Pie Chart */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <h3 className="text-lg font-bold mb-8">Six Big Losses Analysis</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={losses}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {losses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
              Loss analysis helps identify bottlenecks. 
              <span className="text-orange-500 ml-1">Breakdowns</span> and 
              <span className="text-emerald-500 ml-1">Setup</span> are primary targets for improvement.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Downtime Pareto Chart */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <h3 className="text-lg font-bold mb-8">Downtime Pareto Analysis</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pareto} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ffffff05" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="reason" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={120}
                  tick={{ fill: '#ffffff40', fontSize: 10, fontWeight: 'bold' }}
                />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                />
                <Bar dataKey="total_duration" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20}>
                  {pareto.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Benchmarking / Comparison */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <h3 className="text-lg font-bold mb-8">Performance Benchmarking</h3>
          <div className="space-y-6">
            {[
              { label: 'Actual vs Target Production', current: 85, target: 95, color: 'bg-orange-500' },
              { label: 'Quality Rate', current: 98.2, target: 99.5, color: 'bg-emerald-500' },
              { label: 'Availability', current: 72, target: 85, color: 'bg-amber-500' },
              { label: 'Performance Efficiency', current: 91, target: 90, color: 'bg-blue-500' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-white/60">{item.label}</span>
                  <span className="text-white">{item.current}% / {item.target}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-1000`}
                    style={{ width: `${item.current}%` }}
                  ></div>
                  <div 
                    className="absolute top-0 h-full w-0.5 bg-white z-10"
                    style={{ left: `${item.target}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500 text-black rounded-xl">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Benchmarking Insight</h4>
                <p className="text-[10px] text-white/60 mt-1 leading-relaxed">
                  Performance efficiency is exceeding target, but availability is lagging. 
                  Focus on reducing setup times to improve overall OEE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
