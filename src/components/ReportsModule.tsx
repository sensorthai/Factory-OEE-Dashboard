import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Printer, 
  Filter, 
  ChevronDown, 
  Search,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { ThingsBoardService } from "../services/ThingsBoardService";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { DatePicker } from "./shared/DatePicker";
import { useDeviceStore } from "@/src/store/useDeviceStore";

const REPORT_TYPES = [
  { id: 'shift_oee', name: 'Shift-wise OEE Report', icon: Clock, description: 'OEE performance broken down by shifts' },
  { id: 'machine_perf', name: 'Machine Performance Report', icon: CheckCircle2, description: 'Detailed individual machine metrics and KPIs' },
  { id: 'downtime_summary', name: 'Downtime Summary Report', icon: AlertCircle, description: 'Analysis of downtime events and root causes' },
  { id: 'production_summary', name: 'Production Summary Report', icon: FileText, description: 'Total output, scrap, and efficiency summary' },
];

export const ReportsModule: React.FC = () => {
  const { devices, fetchDevices } = useDeviceStore();
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0].id);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id.id);
    }
  }, [devices, selectedDevice]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      if (reportType === 'shift_oee' || reportType === 'machine_perf') {
        data = await ThingsBoardService.getOeeReports(selectedDevice);
      } else if (reportType === 'downtime_summary') {
        data = await ThingsBoardService.getDowntime();
        data = data.filter((d: any) => d.device_id === selectedDevice);
      } else {
        data = await ThingsBoardService.getPlanning();
        data = data.filter((d: any) => d.device_id === selectedDevice);
      }
      setReportData(data);
    } catch (error) {
      console.error("Failed to generate report", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    setExporting(true);
    const doc = new jsPDF();
    const title = REPORT_TYPES.find(r => r.id === reportType)?.name || "Report";
    const deviceName = devices.find(d => d.id.id === selectedDevice)?.name || "All Devices";

    doc.setFontSize(20);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Device: ${deviceName}`, 14, 30);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 36);
    doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 42);

    const headers = reportType === 'downtime_summary' 
      ? [['Reason', 'Category', 'Start', 'End', 'Duration (min)']]
      : [['Timestamp', 'Availability', 'Performance', 'Quality', 'OEE Score']];

    const rows = reportData.map(item => {
      if (reportType === 'downtime_summary') {
        return [item.reason, item.category, item.start_time, item.end_time, item.duration_minutes];
      }
      return [
        item.timestamp, 
        `${(item.availability * 100).toFixed(1)}%`, 
        `${(item.performance * 100).toFixed(1)}%`, 
        `${(item.quality * 100).toFixed(1)}%`, 
        `${(item.oee_score * 100).toFixed(1)}%`
      ];
    });

    (doc as any).autoTable({
      head: headers,
      body: rows,
      startY: 50,
      theme: 'grid',
      headStyles: { fillStyle: '#1e293b', textColor: '#ffffff' },
    });

    doc.save(`${reportType}_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    setExporting(false);
  };

  const exportToExcel = () => {
    setExporting(true);
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${reportType}_report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    setExporting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Configuration Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#111111] border border-white/10 p-6 rounded-3xl space-y-6">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Report Config</h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Report Type</label>
                <div className="space-y-2">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border ${
                        reportType === type.id 
                          ? 'bg-orange-500 border-orange-500 text-black' 
                          : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${reportType === type.id ? 'bg-black/20 text-black' : 'bg-white/5 text-white/40'}`}>
                        <type.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold">{type.name}</p>
                        <p className={`text-[9px] font-medium leading-tight ${reportType === type.id ? 'text-black/60' : 'text-white/30'}`}>{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Machine / Device</label>
                <div className="relative">
                  <select 
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white"
                  >
                    {devices.map(d => (
                      <option key={d.id.id} value={d.id.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Date Range</label>
                <div className="space-y-2">
                  <DatePicker 
                    value={dateRange.start} 
                    onChange={(val) => setDateRange({...dateRange, start: val})} 
                  />
                  <DatePicker 
                    value={dateRange.end} 
                    onChange={(val) => setDateRange({...dateRange, end: val})} 
                  />
                </div>
              </div>

              <button 
                onClick={generateReport}
                disabled={loading}
                className="w-full bg-orange-500 text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#111111] border border-white/10 rounded-3xl overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                  <FileText className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Report Preview</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{reportData.length} Records Found</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={exportToPDF}
                  disabled={reportData.length === 0 || exporting}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button 
                  onClick={exportToExcel}
                  disabled={reportData.length === 0 || exporting}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
              {reportData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      {reportType === 'downtime_summary' ? (
                        <>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Reason</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Category</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Start</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Duration</th>
                        </>
                      ) : (
                        <>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Timestamp</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Availability</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Performance</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Quality</th>
                          <th className="pb-6 text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">OEE</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reportData.map((item, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        {reportType === 'downtime_summary' ? (
                          <>
                            <td className="py-5 text-sm font-bold">{item.reason}</td>
                            <td className="py-5">
                              <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/60">{item.category}</span>
                            </td>
                            <td className="py-5 text-sm text-white/40 font-medium">{format(new Date(item.start_time), 'MMM d, HH:mm')}</td>
                            <td className="py-5 text-sm font-black text-orange-500">{item.duration_minutes}m</td>
                          </>
                        ) : (
                          <>
                            <td className="py-5 text-sm text-white/40 font-bold">{format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm')}</td>
                            <td className="py-5 text-sm text-center font-bold text-blue-500">{(item.availability * 100).toFixed(1)}%</td>
                            <td className="py-5 text-sm text-center font-bold text-orange-500">{(item.performance * 100).toFixed(1)}%</td>
                            <td className="py-5 text-sm text-center font-bold text-green-500">{(item.quality * 100).toFixed(1)}%</td>
                            <td className="py-5 text-center">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                item.oee_score >= 0.85 ? 'bg-green-500/10 text-green-500' : 
                                item.oee_score >= 0.7 ? 'bg-orange-500/10 text-orange-500' : 
                                'bg-red-500/10 text-red-500'
                              )}>
                                {(item.oee_score * 100).toFixed(1)}%
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
                  <div className="p-10 bg-white/5 rounded-full border border-white/10">
                    <Search className="w-16 h-16" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold">No Data to Display</h4>
                    <p className="text-xs font-medium max-w-xs mx-auto leading-relaxed">
                      Select your report parameters and click "Generate Report" to preview the results.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
