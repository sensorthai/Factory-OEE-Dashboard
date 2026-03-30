import React, { useState, useEffect, useMemo } from "react";
import { 
  Settings, 
  Cpu, 
  Plus, 
  Search, 
  MoreVertical, 
  Activity, 
  MapPin, 
  Clock, 
  Edit2, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  Circle,
  X,
  Save,
  AlertCircle,
  Filter,
  ChevronRight,
  RefreshCcw,
  Key,
  Database,
  Info
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { ThingsBoardService } from "@/src/services/ThingsBoardService";
import { motion, AnimatePresence } from "motion/react";
import { useDeviceStore } from "@/src/store/useDeviceStore";
import { LoadingState } from "@/src/components/shared/LoadingState";

interface Device {
  id: { id: string; entityType: string };
  name: string;
  type: string;
  label: string;
  deviceProfileId: { id: string; entityType: string };
  deviceProfileName?: string;
  additionalInfo?: any;
  customerId?: { id: string; entityType: string };
}

interface DeviceProfile {
  id: { id: string; entityType: string };
  name: string;
  type: string;
}

export function DeviceManagement() {
  const { devices, isLoading: isDevicesLoading, fetchDevices } = useDeviceStore();
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProfile, setFilterProfile] = useState("all");
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceForm, setDeviceForm] = useState<Partial<Device>>({
    name: "",
    type: "default",
    label: "",
    deviceProfileId: { id: "", entityType: "DEVICE_PROFILE" }
  });
  
  // Detail states
  const [attributes, setAttributes] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>({});
  const [credentials, setCredentials] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profileList] = await Promise.all([
        ThingsBoardService.getDeviceProfiles(),
        fetchDevices()
      ]);
      setProfiles(profileList.data || []);
    } catch (err) {
      console.error("Failed to fetch profiles", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           d.label?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProfile = filterProfile === "all" || d.deviceProfileName === filterProfile;
      return matchesSearch && matchesProfile;
    });
  }, [devices, searchTerm, filterProfile]);

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ThingsBoardService.saveDevice(deviceForm);
      setIsEditModalOpen(false);
      await fetchDevices();
    } catch (err) {
      console.error("Failed to save device", err);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return;
    try {
      await ThingsBoardService.deleteDevice(id);
      await fetchDevices();
    } catch (err) {
      console.error("Failed to delete device", err);
    }
  };

  const openDetails = async (device: Device) => {
    setSelectedDevice(device);
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);
    try {
      const [attrs, latest, creds] = await Promise.all([
        ThingsBoardService.getDeviceAttributes(device.id.id),
        ThingsBoardService.getLatestTelemetry(device.id.id),
        ThingsBoardService.getDeviceCredentials(device.id.id)
      ]);
      
      // Convert attributes object to array if needed
      const attrArray = Object.entries(attrs).map(([key, value]: [string, any]) => ({
        key,
        value: value,
        lastUpdateTs: Date.now() // TB doesn't always return TS for attributes in this format
      }));
      
      setAttributes(attrArray);
      setTelemetry(latest);
      setCredentials(creds);
    } catch (err) {
      console.error("Failed to fetch details", err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const openEdit = (device?: Device) => {
    if (device) {
      setSelectedDevice(device);
      setDeviceForm({
        id: device.id,
        name: device.name,
        type: device.type,
        label: device.label,
        deviceProfileId: device.deviceProfileId
      });
    } else {
      setSelectedDevice(null);
      setDeviceForm({
        name: "",
        type: "default",
        label: "",
        deviceProfileId: profiles.length > 0 ? profiles[0].id : { id: "", entityType: "DEVICE_PROFILE" }
      });
    }
    setIsEditModalOpen(true);
  };

  if (isLoading || isDevicesLoading) return <LoadingState fullScreen text="Loading Machines..." />;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-white">Machine Management</h2>
          <p className="text-white/40 text-sm">Configure and monitor your factory assets</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              placeholder="Search machines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-all text-white"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <select 
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              className="appearance-none bg-[#111111] border border-white/10 rounded-2xl py-3 pl-12 pr-10 text-sm focus:outline-none focus:border-orange-500/50 transition-all text-white"
            >
              <option value="all">All Profiles</option>
              {profiles.map(p => (
                <option key={p.id.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => openEdit()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-bold px-6 py-3 rounded-2xl transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>Add Machine</span>
          </button>
        </div>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDevices.map((device) => (
          <div 
            key={device.id.id} 
            className="bg-[#111111] border border-white/10 rounded-3xl p-6 hover:border-orange-500/30 transition-all group relative flex flex-col"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/10 transition-all">
                <Cpu className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 rounded-lg text-white/40">
                  {device.deviceProfileName || "Default"}
                </span>
                <div className="relative group/menu">
                  <button className="p-2 hover:bg-white/5 rounded-xl transition-all">
                    <MoreVertical className="w-4 h-4 text-white/20" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 overflow-hidden">
                    <button 
                      onClick={() => openEdit(device)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-white/5 transition-all text-white/60 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteDevice(device.id.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold hover:bg-red-500/10 transition-all text-red-500/60 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-bold truncate group-hover:text-orange-500 transition-colors text-white">{device.name}</h3>
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest truncate">{device.label || "No Label"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Status</p>
                  <div className="flex items-center gap-2">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <span className="text-xs font-bold text-white">Online</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Type</p>
                  <p className="text-xs font-bold truncate text-white">{device.type}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => openDetails(device)}
              className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-white"
            >
              <Info className="w-3.5 h-3.5" />
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{selectedDevice ? "Edit Machine" : "Add New Machine"}</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>
              
              <form onSubmit={handleSaveDevice} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Machine Name</label>
                  <input 
                    type="text" 
                    required
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm({...deviceForm, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
                    placeholder="e.g. Injection Molding 01"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Type</label>
                    <input 
                      type="text" 
                      required
                      value={deviceForm.type}
                      onChange={(e) => setDeviceForm({...deviceForm, type: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Label</label>
                    <input 
                      type="text" 
                      value={deviceForm.label}
                      onChange={(e) => setDeviceForm({...deviceForm, label: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Device Profile</label>
                  <select 
                    required
                    value={deviceForm.deviceProfileId?.id}
                    onChange={(e) => setDeviceForm({
                      ...deviceForm, 
                      deviceProfileId: { id: e.target.value, entityType: "DEVICE_PROFILE" }
                    })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                  >
                    {profiles.map(p => (
                      <option key={p.id.id} value={p.id.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-2xl transition-all shadow-lg shadow-orange-500/20"
                  >
                    {selectedDevice ? "Update Machine" : "Create Machine"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isDetailModalOpen && selectedDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.95, opacity: 0, x: 20 }}
              className="relative w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-[#111111]">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-2xl">
                    <Cpu className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedDevice.name}</h3>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">ID: {selectedDevice.id.id}</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                  <X className="w-5 h-5 text-white/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {isDetailLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <RefreshCcw className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Fetching Telemetry...</p>
                  </div>
                ) : (
                  <>
                    {/* Credentials Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <Key className="w-3.5 h-3.5" /> Access Credentials
                      </h4>
                      <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Access Token</p>
                          <p className="text-sm font-mono text-orange-500">{credentials?.credentialsId || "N/A"}</p>
                        </div>
                        <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
                          <Settings className="w-4 h-4 text-white/40" />
                        </button>
                      </div>
                    </div>

                    {/* Telemetry Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> Latest Telemetry
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(telemetry).length > 0 ? (
                          Object.entries(telemetry).map(([key, val]: [string, any]) => (
                            <div key={key} className="bg-[#111111] border border-white/10 rounded-2xl p-4">
                              <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">{key}</p>
                              <p className="text-lg font-bold text-white">{val[0]?.value}</p>
                              <p className="text-[8px] text-white/10 font-mono mt-1">
                                {new Date(val[0]?.ts).toLocaleTimeString()}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-8 text-center bg-[#111111] border border-dashed border-white/10 rounded-2xl">
                            <p className="text-white/20 text-xs italic">No telemetry data available</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attributes Section */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                        <Database className="w-3.5 h-3.5" /> Shared Attributes
                      </h4>
                      <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-white/5 border-b border-white/5">
                            <tr>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Key</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Value</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 text-right">Last Update</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {attributes.length > 0 ? (
                              attributes.map((attr) => (
                                <tr key={attr.key} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4 text-xs font-bold text-orange-500">{attr.key}</td>
                                  <td className="px-6 py-4 text-xs font-medium text-white/60">{JSON.stringify(attr.value)}</td>
                                  <td className="px-6 py-4 text-xs font-mono text-white/20 text-right">
                                    {new Date(attr.lastUpdateTs).toLocaleString()}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-white/20 text-xs italic">No attributes found</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-8 bg-[#111111] border-t border-white/5 flex items-center justify-end gap-4">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-white"
                >
                  Close
                </button>
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    openEdit(selectedDevice);
                  }}
                  className="px-8 py-3 bg-orange-500 text-black font-bold rounded-xl hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20"
                >
                  Edit Configuration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
