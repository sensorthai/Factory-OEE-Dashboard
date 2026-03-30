import { create } from 'zustand';
import { ThingsBoardService } from '../services/ThingsBoardService';

export interface MachineData {
  id: string;
  name: string;
  status: "Running" | "Idle" | "Down";
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  count: number;
  alerts: string[];
  operator: string;
  partNumber: string;
  goodParts: number;
  scrap: number;
  utilization: number;
  cycleTime: number;
  targetCycleTime: number;
  targetOee: number;
  shift: string;
}

interface DeviceStore {
  devices: any[];
  machinesData: Record<string, MachineData>;
  isLoading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  updateTelemetry: () => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  machinesData: {},
  isLoading: true,
  error: null,
  
  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await ThingsBoardService.getDevices();
      
      const initialData: Record<string, MachineData> = {};
      data.forEach((d: any) => {
        initialData[d.id.id] = {
          id: d.id.id,
          name: d.name,
          status: "Idle",
          availability: 0.85,
          performance: 0.90,
          quality: 0.98,
          oee: 75,
          count: 0,
          alerts: [],
          operator: "James Leener",
          partNumber: "34414",
          goodParts: 66,
          scrap: 2,
          utilization: 64,
          cycleTime: 2.13,
          targetCycleTime: 2.23,
          targetOee: 85,
          shift: "FIRST SHIFT"
        };
      });
      
      set({ devices: data, machinesData: initialData, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch devices", isLoading: false });
    }
  },

  updateTelemetry: async () => {
    const { devices, machinesData } = get();
    if (devices.length === 0) return;

    const newData = { ...machinesData };
    let hasChanges = false;

    for (const device of devices) {
      try {
        const telemetry = await ThingsBoardService.getLatestTelemetry(device.id.id);
        
        const avail = telemetry?.availability?.[0]?.value ? parseFloat(telemetry.availability[0].value) / 100 : 0.8 + Math.random() * 0.15;
        const perf = telemetry?.performance?.[0]?.value ? parseFloat(telemetry.performance[0].value) / 100 : 0.85 + Math.random() * 0.1;
        const qual = telemetry?.quality?.[0]?.value ? parseFloat(telemetry.quality[0].value) / 100 : 0.95 + Math.random() * 0.04;
        
        const oee = Math.round((avail * perf * qual) * 100);
        const count = telemetry?.count?.[0]?.value ? parseInt(telemetry.count[0].value) : (newData[device.id.id]?.count || 0) + Math.floor(Math.random() * 5);
        
        const status: "Running" | "Idle" | "Down" = oee > 60 ? "Running" : oee > 30 ? "Idle" : "Down";
        
        const alerts = [];
        if (oee < 70) alerts.push("Low OEE threshold breached");
        if (qual < 0.95) alerts.push("Quality drop detected");

        newData[device.id.id] = {
          ...newData[device.id.id],
          availability: Math.round(avail * 100),
          performance: Math.round(perf * 100),
          quality: Math.round(qual * 100),
          oee,
          count,
          status,
          alerts
        };
        hasChanges = true;
      } catch (e) {
        console.error(`Telemetry error for ${device.name}`, e);
      }
    }

    if (hasChanges) {
      set({ machinesData: newData });
    }
  }
}));
