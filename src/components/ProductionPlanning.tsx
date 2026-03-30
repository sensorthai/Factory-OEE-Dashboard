import React, { useState, useEffect, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MoreVertical,
  Search,
  Filter,
  ArrowRight,
  Target,
  Layers,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Trash2,
  Edit2,
  Play,
  Pause,
  TrendingUp,
  RefreshCcw
} from "lucide-react";
import axios from "axios";
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  addWeeks, 
  subWeeks, 
  parseISO,
  differenceInHours,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  startOfToday
} from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { cn } from "@/src/lib/utils";
import { useDeviceStore } from "@/src/store/useDeviceStore";
import { LoadingState } from "@/src/components/shared/LoadingState";

interface WorkOrder {
  id: number;
  order_number: string;
  device_id: string;
  product_name: string;
  target_quantity: number;
  actual_quantity: number;
  start_time: string;
  end_time: string;
  shift_id: number;
  status: "planned" | "in_progress" | "completed" | "delayed";
  priority: "low" | "medium" | "high";
  last_sync?: string;
}

interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

export function ProductionPlanning() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const { devices, isLoading: isDevicesLoading, fetchDevices } = useDeviceStore();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month" | "list">("week");
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    order_number: "",
    device_id: "",
    product_name: "",
    target_quantity: 1000,
    actual_quantity: 0,
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(new Date(Date.now() + 8 * 3600000), "yyyy-MM-dd'T'HH:mm"),
    shift_id: 1,
    priority: "medium" as const,
    status: "planned" as const
  });

  const resetForm = () => {
    setFormData({
      order_number: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
      device_id: "",
      product_name: "",
      target_quantity: 1000,
      actual_quantity: 0,
      start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(Date.now() + 8 * 3600000), "yyyy-MM-dd'T'HH:mm"),
      shift_id: 1,
      priority: "medium",
      status: "planned"
    });
    setEditingOrder(null);
  };

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        order_number: editingOrder.order_number,
        device_id: editingOrder.device_id,
        product_name: editingOrder.product_name,
        target_quantity: editingOrder.target_quantity,
        actual_quantity: editingOrder.actual_quantity,
        start_time: format(parseISO(editingOrder.start_time), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(parseISO(editingOrder.end_time), "yyyy-MM-dd'T'HH:mm"),
        shift_id: editingOrder.shift_id,
        priority: editingOrder.priority,
        status: editingOrder.status
      });
    } else {
      resetForm();
    }
  }, [editingOrder]);

  const fetchData = async () => {
    try {
      const [ordersRes, shiftsRes] = await Promise.all([
        axios.get("/api/work-orders"),
        axios.get("/api/shifts")
      ]);
      setWorkOrders(ordersRes.data);
      setShifts(shiftsRes.data);
      if (devices.length === 0) {
        await fetchDevices();
      }
    } catch (err) {
      console.error("Failed to fetch planning data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // We don't have a direct "sync" endpoint, but we can trigger a fetch
      // The server is doing background sync, so we just refresh our data
      await fetchData();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOrder) {
        await axios.put(`/api/work-orders/${editingOrder.id}`, formData);
      } else {
        await axios.post("/api/work-orders", formData);
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Failed to save work order", err);
    }
  };

  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this work order?")) return;
    try {
      await axios.delete(`/api/work-orders/${id}`);
      fetchData();
    } catch (err) {
      console.error("Failed to delete work order", err);
    }
  };

  const updateStatus = async (id: number, status: string, actual: number) => {
    try {
      await axios.put(`/api/work-orders/${id}`, { status, actual_quantity: actual });
      fetchData();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleExportExcel = () => {
    const data = workOrders.map(order => ({
      "Order #": order.order_number,
      "Product": order.product_name,
      "Machine": devices.find(d => d.id.id === order.device_id)?.name || order.device_id,
      "Target": order.target_quantity,
      "Actual": order.actual_quantity,
      "Progress": `${Math.round((order.actual_quantity / order.target_quantity) * 100)}%`,
      "Start": format(parseISO(order.start_time), "yyyy-MM-dd HH:mm"),
      "End": format(parseISO(order.end_time), "yyyy-MM-dd HH:mm"),
      "Status": order.status,
      "Priority": order.priority
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Work Orders");
    XLSX.writeFile(wb, `Production_Plan_${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Production Planning Report", 14, 15);
    
    const tableData = workOrders.map(order => [
      order.order_number,
      order.product_name,
      devices.find(d => d.id.id === order.device_id)?.name || order.device_id,
      order.target_quantity.toString(),
      order.actual_quantity.toString(),
      `${Math.round((order.actual_quantity / order.target_quantity) * 100)}%`,
      order.status
    ]);

    (doc as any).autoTable({
      head: [["Order #", "Product", "Machine", "Target", "Actual", "Progress", "Status"]],
      body: tableData,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    doc.save(`Production_Plan_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const onDragStart = (e: React.DragEvent, orderId: number) => {
    e.dataTransfer.setData("orderId", orderId.toString());
  };

  const onDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const orderId = parseInt(e.dataTransfer.getData("orderId"));
    const order = workOrders.find(o => o.id === orderId);
    if (!order) return;

    const currentStart = parseISO(order.start_time);
    const currentEnd = parseISO(order.end_time);
    const duration = currentEnd.getTime() - currentStart.getTime();

    const newStart = new Date(targetDate);
    newStart.setHours(currentStart.getHours(), currentStart.getMinutes());
    
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      await axios.put(`/api/work-orders/${orderId}`, {
        start_time: format(newStart, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(newEnd, "yyyy-MM-dd'T'HH:mm")
      });
      fetchData();
    } catch (err) {
      console.error("Failed to reschedule order", err);
    }
  };

  const calendarDays = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startCal = startOfWeek(start, { weekStartsOn: 1 });
      const endCal = addDays(startOfWeek(end, { weekStartsOn: 1 }), 6);
      return eachDayOfInterval({ start: startCal, end: endCal });
    }
  }, [currentDate, viewMode]);

  const getOrdersForDay = (day: Date) => {
    return workOrders.filter(order => isSameDay(parseISO(order.start_time), day));
  };

  const forecastingData = useMemo(() => {
    const activeOrders = workOrders.filter(o => o.status === "in_progress");
    return activeOrders.map(order => {
      const elapsed = differenceInHours(new Date(), parseISO(order.start_time));
      const rate = order.actual_quantity / (elapsed || 1);
      const remaining = order.target_quantity - order.actual_quantity;
      const estHoursLeft = remaining / (rate || 1);
      const estCompletion = addDays(new Date(), estHoursLeft / 24);
      
      return {
        ...order,
        rate: Math.round(rate),
        estCompletion: format(estCompletion, "MMM d, HH:mm"),
        isDelayed: estCompletion > parseISO(order.end_time)
      };
    });
  }, [workOrders]);

  if (isLoading || isDevicesLoading) return <LoadingState fullScreen text="Loading production plan..." />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex bg-[#111111] border border-white/10 rounded-2xl p-1">
            <button 
              onClick={() => setViewMode("week")}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", 
                viewMode === "week" ? "bg-orange-500 text-black" : "text-white/40 hover:text-white"
              )}
            >
              Week
            </button>
            <button 
              onClick={() => setViewMode("month")}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", 
                viewMode === "month" ? "bg-orange-500 text-black" : "text-white/40 hover:text-white"
              )}
            >
              Month
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={cn("px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all", 
                viewMode === "list" ? "bg-orange-500 text-black" : "text-white/40 hover:text-white"
              )}
            >
              List
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#111111] border border-white/10 rounded-2xl p-1">
            <button 
              onClick={() => {
                if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
                else setCurrentDate(subMonths(currentDate, 1));
              }} 
              className="p-2 hover:bg-white/5 rounded-xl transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold px-2 min-w-[120px] text-center">
              {viewMode === "week" ? (
                `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} - ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), "MMM d, yyyy")}`
              ) : (
                format(currentDate, "MMMM yyyy")
              )}
            </span>
            <button 
              onClick={() => {
                if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
                else setCurrentDate(addMonths(currentDate, 1));
              }} 
              className="p-2 hover:bg-white/5 rounded-xl transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className={cn(
              "p-3 bg-white/5 border border-white/10 rounded-2xl transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest",
              isSyncing ? "opacity-50" : "hover:bg-white/10"
            )}
          >
            <RefreshCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold hover:bg-white/10 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold hover:bg-white/10 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button 
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-bold px-6 py-3 rounded-2xl transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Create Work Order</span>
          </button>
        </div>
      </div>

      {viewMode !== "list" ? (
        <div className={cn(
          "grid gap-4",
          viewMode === "week" ? "grid-cols-7" : "grid-cols-7"
        )}>
          {calendarDays.map((day, i) => {
            const dayOrders = getOrdersForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div 
                key={i} 
                className={cn("space-y-4", viewMode === "month" && !isCurrentMonth && "opacity-30")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, day)}
              >
                <div className={cn("text-center p-3 rounded-2xl border transition-all", 
                  isSameDay(day, new Date()) ? "bg-orange-500/10 border-orange-500/50" : "bg-[#111111] border-white/10"
                )}>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{format(day, "EEE")}</p>
                  <p className="text-lg font-black">{format(day, "d")}</p>
                </div>
                <div className={cn("space-y-3", viewMode === "week" ? "min-h-[400px]" : "min-h-[100px]")}>
                  {dayOrders.map(order => (
                    <div 
                      key={order.id} 
                      draggable
                      onDragStart={(e) => onDragStart(e, order.id)}
                      className={cn("p-3 rounded-2xl border text-left space-y-2 group relative overflow-hidden cursor-move",
                        order.priority === "high" ? "border-red-500/30 bg-red-500/5" : 
                        order.priority === "medium" ? "border-orange-500/30 bg-orange-500/5" : 
                        "border-white/10 bg-white/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 bg-white/10 rounded">
                          {order.order_number}
                        </span>
                        <div className="flex items-center gap-1">
                          {order.status === "in_progress" && <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />}
                          <span className="text-[7px] font-bold uppercase tracking-widest text-white/40">{order.status}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold truncate leading-tight">{order.product_name}</p>
                        {viewMode === "week" && (
                          <p className="text-[8px] text-white/40 font-medium truncate">
                            {devices.find(d => d.id.id === order.device_id)?.name}
                          </p>
                        )}
                      </div>
                      {viewMode === "week" && (
                        <>
                          <div className="flex items-center justify-between text-[9px] font-bold">
                            <span className="text-white/40">{order.actual_quantity} / {order.target_quantity}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-orange-500">{Math.round((order.actual_quantity / order.target_quantity) * 100)}%</span>
                              {order.last_sync && (
                                <span className="text-[6px] text-white/20 flex items-center gap-0.5">
                                  <RefreshCcw className="w-1.5 h-1.5" />
                                  {format(parseISO(order.last_sync), "HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 transition-all duration-500" 
                              style={{ width: `${(order.actual_quantity / order.target_quantity) * 100}%` }} 
                            />
                          </div>
                        </>
                      )}
                      <div className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                        <button onClick={() => handleEdit(order)} className="p-1 hover:bg-white/10 rounded text-white/60">
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button onClick={() => handleDelete(order.id)} className="p-1 hover:bg-red-500/20 rounded text-red-500">
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {viewMode === "week" && (
                    <button 
                      onClick={() => {
                        resetForm();
                        setFormData(prev => ({ ...prev, start_time: format(day, "yyyy-MM-dd'T'08:00") }));
                        setIsModalOpen(true);
                      }}
                      className="w-full py-3 border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-white/20 hover:text-white/40 hover:border-white/20 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#111111] border border-white/10 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Work Order</th>
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Product / Machine</th>
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Schedule</th>
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Progress</th>
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {workOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", 
                        order.priority === "high" ? "bg-red-500" : 
                        order.priority === "medium" ? "bg-orange-500" : "bg-blue-500"
                      )} />
                      <span className="font-bold">{order.order_number}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="font-bold">{order.product_name}</p>
                    <p className="text-xs text-white/40">{devices.find(d => d.id.id === order.device_id)?.name}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Clock className="w-3 h-3 text-white/20" />
                      <span>{format(parseISO(order.start_time), "MMM d, HH:mm")}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="w-48 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-white/40">{order.actual_quantity} / {order.target_quantity}</span>
                        <div className="flex flex-col items-end">
                          <span>{Math.round((order.actual_quantity / order.target_quantity) * 100)}%</span>
                          {order.last_sync && (
                            <span className="text-[8px] text-white/20 flex items-center gap-1">
                              <RefreshCcw className="w-2 h-2" />
                              Synced {format(parseISO(order.last_sync), "HH:mm")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all duration-500" 
                          style={{ width: `${(order.actual_quantity / order.target_quantity) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      order.status === "completed" ? "bg-green-500/10 text-green-500" :
                      order.status === "in_progress" ? "bg-blue-500/10 text-blue-500" :
                      order.status === "delayed" ? "bg-red-500/10 text-red-500" :
                      "bg-white/5 text-white/40"
                    )}>
                      {order.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {order.status === "planned" && (
                        <button 
                          onClick={() => updateStatus(order.id, "in_progress", order.actual_quantity)}
                          className="p-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === "in_progress" && (
                        <button 
                          onClick={() => updateStatus(order.id, "completed", order.target_quantity)}
                          className="p-2 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(order)} className="p-2 bg-white/5 text-white/60 rounded-xl hover:bg-white/10 transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(order.id)} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Forecasting & Resource Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-bold">Production Forecasting</h3>
            </div>
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Live Projections</span>
          </div>
          <div className="space-y-6">
            {forecastingData.length === 0 ? (
              <p className="text-white/20 text-sm text-center py-8">No active work orders to forecast.</p>
            ) : (
              forecastingData.map((forecast, i) => (
                <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <p className="font-bold">{forecast.order_number} - {forecast.product_name}</p>
                    <p className="text-xs text-white/40">Current Rate: <span className="text-white font-bold">{forecast.rate} units/hr</span></p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Est. Completion</p>
                    <p className={cn("text-sm font-bold", forecast.isDelayed ? "text-red-500" : "text-green-500")}>
                      {forecast.estCompletion}
                      {forecast.isDelayed && <span className="ml-2 text-[10px] font-black">(Delayed)</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl">
          <h3 className="text-lg font-bold mb-8">Shift Allocation</h3>
          <div className="space-y-4">
            {shifts.map((shift) => {
              const shiftOrders = workOrders.filter(o => o.shift_id === shift.id);
              const totalTarget = shiftOrders.reduce((acc, curr) => acc + curr.target_quantity, 0);
              const totalActual = shiftOrders.reduce((acc, curr) => acc + curr.actual_quantity, 0);
              const progress = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

              return (
                <div key={shift.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="font-bold">{shift.name}</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-bold">{shift.start_time} - {shift.end_time}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-white/40">{shiftOrders.length} Orders</span>
                      <span>{progress}% Capacity</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 transition-all duration-500" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Work Order Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#111111] border border-white/10 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingOrder ? "Edit Work Order" : "Create Work Order"}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Order Number</label>
                <input 
                  type="text" 
                  required
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Product Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., Engine Block X1"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Assigned Machine</label>
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
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Target Quantity</label>
                <input 
                  type="number" 
                  required
                  value={formData.target_quantity}
                  onChange={(e) => setFormData({ ...formData, target_quantity: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Actual Quantity</label>
                <input 
                  type="number" 
                  required
                  value={formData.actual_quantity}
                  onChange={(e) => setFormData({ ...formData, actual_quantity: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all"
                />
              </div>

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

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Shift</label>
                <select 
                  required
                  value={formData.shift_id}
                  onChange={(e) => setFormData({ ...formData, shift_id: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#111111]">{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Priority</label>
                <select 
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                >
                  <option value="low" className="bg-[#111111]">Low</option>
                  <option value="medium" className="bg-[#111111]">Medium</option>
                  <option value="high" className="bg-[#111111]">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Status</label>
                <select 
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                >
                  <option value="planned" className="bg-[#111111]">Planned</option>
                  <option value="in_progress" className="bg-[#111111]">In Progress</option>
                  <option value="completed" className="bg-[#111111]">Completed</option>
                  <option value="delayed" className="bg-[#111111]">Delayed</option>
                </select>
              </div>

              <div className="md:col-span-2 pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20"
                >
                  {editingOrder ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
