import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Link as LinkIcon, 
  Unlink, 
  Factory, 
  Layers, 
  Cpu, 
  Info, 
  Network,
  Settings2,
  X,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  GripVertical,
  GitBranch
} from "lucide-react";
import { ThingsBoardService } from "../services/ThingsBoardService";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import * as d3 from "d3";
import { useDeviceStore } from "@/src/store/useDeviceStore";
import { LoadingState } from "@/src/components/shared/LoadingState";

interface Asset {
  id: { id: string; entityType: "ASSET" };
  name: string;
  type: string;
  label?: string;
  createdTime: number;
  additionalInfo?: {
    description?: string;
  };
  deviceCount?: number;
}

interface AssetProfile {
  id: { id: string; entityType: "ASSET_PROFILE" };
  name: string;
  description?: string;
}

interface AssetNode extends Asset {
  children: AssetNode[];
  devices: Device[];
  target?: number;
  isExpanded?: boolean;
}

interface Device {
  id: { id: string; entityType: "DEVICE" };
  name: string;
  type: string;
  label?: string;
  createdTime: number;
  status?: "active" | "inactive";
  lastActive?: number;
}

interface Relation {
  from: { id: string; entityType: string };
  to: { id: string; entityType: string };
  type: string;
  typeGroup: string;
}

export function AssetManagement() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetProfiles, setAssetProfiles] = useState<AssetProfile[]>([]);
  const [assetTree, setAssetTree] = useState<AssetNode[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [assetsRes, profilesRes, devicesRes] = await Promise.all([
        ThingsBoardService.getAssets(100, 0),
        ThingsBoardService.getAssetProfiles(50, 0),
        ThingsBoardService.getDevices()
      ]);
      
      const rawAssets = assetsRes.data;
      const allDevices = devicesRes || [];
      
      // Fetch relations and attributes for each asset in parallel
      const assetData = await Promise.all(rawAssets.map(async (asset: Asset) => {
        try {
          const [relations, attributes] = await Promise.all([
            ThingsBoardService.getAssetRelations(asset.id.id, "from"),
            ThingsBoardService.getAssetAttributes(asset.id.id)
          ]);

          const deviceIds = relations.filter((r: any) => r.to.entityType === "DEVICE").map((r: any) => r.to.id);
          const assetDevices = allDevices.filter((d: any) => deviceIds.includes(d.id.id));
          
          const targetAttr = attributes.find((a: any) => a.key === "target");
          const target = targetAttr ? Number(targetAttr.value) : 85;

          return { 
            ...asset, 
            deviceCount: deviceIds.length, 
            devices: assetDevices,
            target,
            relations: relations.filter((r: any) => r.to.entityType === "ASSET").map((r: any) => r.to.id)
          };
        } catch (e) {
          return { ...asset, deviceCount: 0, devices: [], target: 85, relations: [] };
        }
      }));

      setAssets(assetData as any);
      setAssetProfiles(profilesRes.data || []);
      
      // Build hierarchy
      buildHierarchy(assetData);
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildHierarchy = (allAssets: any[]) => {
    try {
      const buildNode = (asset: any): AssetNode => {
        const childIds = asset.relations || [];
        const children = allAssets
          .filter(a => childIds.includes(a.id.id))
          .map(a => buildNode(a));
        
        return { ...asset, children };
      };

      const hasParent = new Set<string>();
      allAssets.forEach(a => {
        (a.relations || []).forEach((id: string) => hasParent.add(id));
      });

      const roots = allAssets
        .filter(a => !hasParent.has(a.id.id))
        .map(a => buildNode(a));

      setAssetTree(roots);
    } catch (error) {
      console.error("Failed to build hierarchy:", error);
      // Fallback to flat list if hierarchy fails
      setAssetTree(allAssets.map(a => ({ ...a, children: [], devices: [], target: 85 })));
    }
  };

  const handleAddAsset = () => {
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setEditingAsset(asset);
    setIsAssetModalOpen(true);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (window.confirm("Are you sure you want to delete this asset? This will also remove all relations.")) {
      try {
        await ThingsBoardService.deleteAsset(assetId);
        setAssets(assets.filter(a => a.id.id !== assetId));
        setAssetTree(assetTree.filter(n => n.id.id !== assetId));
        if (selectedAssetId === assetId) {
          setSelectedAssetId(null);
          setView("list");
        }
      } catch (error) {
        console.error("Failed to delete asset:", error);
      }
    }
  };

  const handleSelectAsset = (assetId: string) => {
    setSelectedAssetId(assetId);
    setView("detail");
  };

  const handleUpdateTarget = async (assetId: string, target: number) => {
    try {
      await ThingsBoardService.saveAssetAttributes(assetId, "SHARED_SCOPE", { target });
      // Update local state for immediate feedback
      setAssetTree(prev => {
        const updateNode = (nodes: AssetNode[]): AssetNode[] => {
          return nodes.map(node => {
            if (node.id.id === assetId) return { ...node, target };
            return { ...node, children: updateNode(node.children) };
          });
        };
        return updateNode(prev);
      });
    } catch (error) {
      console.error("Failed to update target:", error);
    }
  };

  const [parentForNewAsset, setParentForNewAsset] = useState<string | null>(null);

  const handleAddChildAsset = (parentId: string) => {
    setParentForNewAsset(parentId);
    setEditingAsset(null);
    setIsAssetModalOpen(true);
  };

  const handleAssetSaved = async (newAsset: any) => {
    if (parentForNewAsset) {
      try {
        await ThingsBoardService.saveRelation({
          from: { id: parentForNewAsset, entityType: "ASSET" },
          to: { id: newAsset.id.id, entityType: "ASSET" },
          type: "Contains",
          typeGroup: "COMMON"
        });
      } catch (e) {
        console.error("Failed to link child asset:", e);
      }
    }
    setParentForNewAsset(null);
    fetchInitialData();
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden bg-[#0a0a0a] p-6">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {view === "list" ? (
          <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Asset Hierarchy</h1>
                <p className="text-white/40 text-sm mt-1">Manage your factories, production lines and machines</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input 
                    type="text"
                    placeholder="Search hierarchy..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-orange-500/50 w-64 transition-all"
                  />
                </div>
                <button 
                  onClick={handleAddAsset}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-black rounded-xl text-sm font-bold hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Create Asset
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <LoadingState text="Loading Hierarchy..." />
                </div>
              ) : (
                <AssetHierarchyView 
                  tree={assetTree}
                  onEditAsset={handleEditAsset}
                  onDeleteAsset={handleDeleteAsset}
                  onAddChildAsset={handleAddChildAsset}
                  onUpdateTarget={handleUpdateTarget}
                  searchQuery={searchQuery}
                />
              )}
            </div>
          </div>
        ) : (
          <AssetDetailView 
            assetId={selectedAssetId!}
            onBack={() => setView("list")}
            onEdit={() => handleEditAsset(assets.find(a => a.id.id === selectedAssetId)!)}
            onDelete={() => handleDeleteAsset(selectedAssetId!)}
            profiles={assetProfiles}
            onRefreshProfiles={fetchInitialData}
          />
        )}
      </div>

      {/* Modals */}
      {isAssetModalOpen && (
        <AssetModal 
          isOpen={isAssetModalOpen}
          onClose={() => {
            setIsAssetModalOpen(false);
            setParentForNewAsset(null);
          }}
          asset={editingAsset}
          profiles={assetProfiles}
          onSave={handleAssetSaved}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function AssetTree({ nodes, selectedId, onSelect }: { nodes: AssetNode[], selectedId: string | null, onSelect: (id: string) => void }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <div className="space-y-1">
      {nodes.length === 0 ? (
        <div className="p-4 text-center text-white/40 text-sm italic">
          No assets found
        </div>
      ) : (
        nodes.map(node => (
          <div key={node.id.id}>
            <div
              onClick={() => onSelect(node.id.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left group cursor-pointer",
                selectedId === node.id.id 
                  ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {node.children.length > 0 ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(e, node.id.id);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-all z-10"
                  >
                    <ChevronRight className={cn("w-3 h-3 transition-transform flex-shrink-0", expandedIds.has(node.id.id) && "rotate-90")} />
                  </button>
                ) : (
                  <div className="w-5" />
                )}
                {node.type === "Factory" ? (
                  <Factory className="w-4 h-4 flex-shrink-0 text-blue-400" />
                ) : node.type === "Production_Line" ? (
                  <Layers className="w-4 h-4 flex-shrink-0 text-orange-400" />
                ) : (
                  <Network className="w-4 h-4 flex-shrink-0 text-white/40" />
                )}
                <span className="truncate">{node.name}</span>
              </div>
              {node.deviceCount !== undefined && node.deviceCount > 0 && (
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-white/40 group-hover:text-white/60">
                  {node.deviceCount}
                </span>
              )}
            </div>
            {node.children.length > 0 && expandedIds.has(node.id.id) && (
              <div className="ml-6 mt-1 border-l border-white/10 pl-2 space-y-1">
                <AssetTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function AssetHierarchyView({ 
  tree, 
  onEditAsset, 
  onDeleteAsset, 
  onAddChildAsset,
  onUpdateTarget,
  searchQuery
}: { 
  tree: AssetNode[], 
  onEditAsset: (asset: Asset) => void,
  onDeleteAsset: (id: string) => void,
  onAddChildAsset: (parentId: string) => void,
  onUpdateTarget: (assetId: string, target: number) => void,
  searchQuery: string
}) {
  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const search = searchQuery.toLowerCase();
    
    const filterNodes = (nodes: AssetNode[]): AssetNode[] => {
      return nodes.reduce((acc: AssetNode[], node) => {
        const matches = node.name.toLowerCase().includes(search) || 
                        node.type.toLowerCase().includes(search);
        const filteredChildren = filterNodes(node.children);
        
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    
    return filterNodes(tree);
  }, [tree, searchQuery]);

  if (filteredTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white/5 border border-dashed border-white/10 rounded-3xl">
        <Layers className="w-12 h-12 text-white/10 mb-4" />
        <p className="text-white/40">No assets found in hierarchy</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {filteredTree.map(factory => (
        <FactoryCard 
          key={factory.id.id} 
          factory={factory} 
          onEdit={onEditAsset}
          onDelete={onDeleteAsset}
          onAddLine={onAddChildAsset}
          onUpdateTarget={onUpdateTarget}
        />
      ))}
    </div>
  );
}

function FactoryCard({ factory, onEdit, onDelete, onAddLine, onUpdateTarget }: any) {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
      {/* Factory Header */}
      <div className="p-6 flex items-center justify-between bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Factory className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{factory.name}</h2>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold uppercase tracking-wider text-white/60">Factory</span>
              <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-[10px] font-bold uppercase tracking-wider text-orange-500">ThingsBoard</span>
            </div>
            <p className="text-xs text-white/40 mt-0.5">{factory.additionalInfo?.description || "Industrial Manufacturing Facility"}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Target</span>
            <div className="flex items-center gap-2">
              <input 
                type="number"
                defaultValue={factory.target || 85}
                onBlur={(e) => onUpdateTarget(factory.id.id, Number(e.target.value))}
                className="w-12 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:border-orange-500"
              />
              <span className="text-sm font-bold text-white/60">%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(factory)} className="p-2.5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all border border-white/5">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(factory.id.id)} className="p-2.5 hover:bg-red-500/10 rounded-xl text-red-500/40 hover:text-red-500 transition-all border border-white/5">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => onAddLine(factory.id.id)} className="p-2.5 bg-orange-500 text-black rounded-xl hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lines Section */}
      <div className="p-6 space-y-6">
        {factory.children.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-white/20 text-sm italic">No production lines added to this factory</p>
          </div>
        ) : (
          factory.children.map((line: any) => (
            <LineCard 
              key={line.id.id} 
              line={line} 
              onEdit={onEdit}
              onDelete={onDelete}
              onUpdateTarget={onUpdateTarget}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LineCard({ line, onEdit, onDelete, onUpdateTarget }: any) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
      {/* Line Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold">{line.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Production Line</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[10px] text-orange-500 uppercase font-bold tracking-wider">{line.devices?.length || 0} Machines</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Target</span>
            <div className="flex items-center gap-2">
              <input 
                type="number"
                defaultValue={line.target || 85}
                onBlur={(e) => onUpdateTarget(line.id.id, Number(e.target.value))}
                className="w-10 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-center focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs font-bold text-white/60">%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(line)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(line.id.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-500 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Machines Grid */}
      <div className="p-6">
        {line.devices?.length === 0 ? (
          <p className="text-xs text-white/20 italic">No machines linked to this line</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {line.devices.map((machine: any) => (
              <MachineCard key={machine.id.id} machine={machine} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MachineCard({ machine }: any) {
  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 hover:border-orange-500/30 transition-all group relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
            <Settings2 className="w-5 h-5 text-white/40 group-hover:text-orange-500 transition-colors" />
          </div>
          <div>
            <p className="text-sm font-bold truncate max-w-[120px]">{machine.name}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">{machine.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-white/20 cursor-grab active:cursor-grabbing" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            machine.status === "active" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500"
          )} />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            {machine.status === "active" ? "Online" : "Offline"}
          </span>
        </div>
        {machine.status !== "active" && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}

function AssetDetailView({ 
  assetId, 
  onBack, 
  onEdit, 
  onDelete,
  profiles,
  onRefreshProfiles
}: { 
  assetId: string, 
  onBack: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
  profiles: AssetProfile[],
  onRefreshProfiles: () => void
}) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "devices" | "topology" | "profiles">("info");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAsset = async () => {
      setIsLoading(true);
      try {
        const data = await ThingsBoardService.getAssetById(assetId);
        setAsset(data);
      } catch (error) {
        console.error("Failed to fetch asset detail:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAsset();
  }, [assetId]);

  if (isLoading) {
    return <LoadingState fullScreen text="Loading Asset Details..." />;
  }

  if (!asset) return null;

  return (
    <div className="flex-1 bg-[#111111] border border-white/10 rounded-2xl flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{asset.name}</h2>
                <span className="px-2 py-0.5 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-wider rounded border border-orange-500/20">
                  {asset.type}
                </span>
              </div>
              <p className="text-sm text-white/40">{asset.label || "No label"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium transition-all border border-white/10"
            >
              <Edit2 className="w-4 h-4" />
              Edit Asset
            </button>
            <button 
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-sm font-medium text-red-500 transition-all border border-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {[
            { id: "info", label: "Overview", icon: Info },
            { id: "devices", label: "Devices", icon: Cpu },
            { id: "topology", label: "Topology", icon: Network },
            { id: "profiles", label: "Profiles", icon: Settings2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 pb-4 text-sm font-medium transition-all relative",
                activeTab === tab.id ? "text-orange-500" : "text-white/40 hover:text-white"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "info" && <AssetInfoTab asset={asset} />}
        {activeTab === "devices" && <AssetDevicesTab assetId={assetId} />}
        {activeTab === "topology" && <AssetTopologyTab assetId={assetId} assetName={asset.name} />}
        {activeTab === "profiles" && <AssetProfileTab profiles={profiles} onRefresh={onRefreshProfiles} />}
      </div>
    </div>
  );
}

function AssetInfoTab({ asset }: { asset: Asset }) {
  const [attributes, setAttributes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttributes = async () => {
      try {
        const data = await ThingsBoardService.getAssetAttributes(asset.id.id);
        setAttributes(data);
      } catch (error) {
        console.error("Failed to fetch attributes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttributes();
  }, [asset.id.id]);

  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">General Information</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 block mb-1">Description</label>
              <p className="text-sm">{asset.additionalInfo?.description || "No description provided."}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 block mb-1">Created At</label>
                <p className="text-sm">{new Date(asset.createdTime).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Asset ID</label>
                <p className="text-xs font-mono text-white/40 truncate">{asset.id.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Custom Attributes</h3>
          {isLoading ? (
            <LoadingState text="Loading Attributes..." />
          ) : attributes.length === 0 ? (
            <p className="text-sm text-white/40 italic">No custom attributes found.</p>
          ) : (
            <div className="space-y-3">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-sm font-medium text-white/60">{attr.key}</span>
                  <span className="text-sm font-mono text-orange-500">{String(attr.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetDevicesTab({ assetId }: { assetId: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  const fetchRelations = async () => {
    setIsLoading(true);
    try {
      const relations = await ThingsBoardService.getAssetRelations(assetId, "from");
      const deviceRelations = relations.filter((r: any) => r.to.entityType === "DEVICE");
      
      const deviceDetails = await Promise.all(
        deviceRelations.map(async (r: any) => {
          try {
            // Fetch telemetry for status
            const telemetry = await ThingsBoardService.getLatestTelemetry(r.to.id);
            const lastActive = telemetry.lastActivityTime?.[0]?.value || Date.now();
            const status = (Date.now() - lastActive < 300000) ? "active" : "inactive";

            return {
              id: r.to,
              name: r.toName || "Unknown Device",
              type: r.toType || "default",
              createdTime: Date.now(),
              status,
              lastActive
            };
          } catch (e) {
            return {
              id: r.to,
              name: r.toName || "Unknown Device",
              type: r.toType || "default",
              createdTime: Date.now(),
              status: "inactive",
              lastActive: Date.now()
            };
          }
        })
      );
      setDevices(deviceDetails as Device[]);
    } catch (error) {
      console.error("Failed to fetch relations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRelations();
  }, [assetId]);

  const handleUnlink = async (deviceId: string) => {
    if (window.confirm("Unlink this device from the asset?")) {
      try {
        await ThingsBoardService.deleteRelation(assetId, "ASSET", "Contains", deviceId, "DEVICE");
        setDevices(devices.filter(d => d.id.id !== deviceId));
      } catch (error) {
        console.error("Failed to unlink device:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Linked Devices</h3>
        <button 
          onClick={() => setIsLinkModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-black rounded-xl text-sm font-bold hover:bg-orange-400 transition-all"
        >
          <LinkIcon className="w-4 h-4" />
          Link Device
        </button>
      </div>

      {isLoading ? (
        <LoadingState text="Loading Devices..." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {devices.map(device => (
            <div key={device.id.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-orange-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white/40" />
                </div>
                <div>
                  <h4 className="font-bold">{device.name}</h4>
                  <p className="text-xs text-white/40 uppercase tracking-wider">{device.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Last Active</p>
                  <p className="text-xs text-white/60">{new Date(device.lastActive || 0).toLocaleString()}</p>
                </div>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 border rounded-full",
                  device.status === "active" 
                    ? "bg-green-500/10 border-green-500/20 text-green-500" 
                    : "bg-red-500/10 border-red-500/20 text-red-500"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", device.status === "active" ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                  <span className="text-[10px] font-bold uppercase">{device.status}</span>
                </div>
                <button 
                  onClick={() => handleUnlink(device.id.id)}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/60 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
              <Cpu className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40 italic">No devices linked to this asset</p>
            </div>
          )}
        </div>
      )}

      {isLinkModalOpen && (
        <LinkDeviceModal 
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          assetId={assetId}
          onLinked={fetchRelations}
          linkedDeviceIds={devices.map(d => d.id.id)}
        />
      )}
    </div>
  );
}

function AssetTopologyTab({ assetId, assetName }: { assetId: string, assetName: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const renderTopology = async () => {
      setIsLoading(true);
      try {
        const relations = await ThingsBoardService.getAssetRelations(assetId, "from");
        
        const nodes = [
          { id: assetId, name: assetName, type: "ASSET", group: 0 }
        ];
        const links: any[] = [];

        relations.forEach((r: any) => {
          nodes.push({
            id: r.to.id,
            name: r.toName || "Unknown",
            type: r.to.entityType,
            group: r.to.entityType === "ASSET" ? 1 : 2
          });
          links.push({
            source: assetId,
            target: r.to.id,
            type: r.type
          });
        });

        if (!svgRef.current) return;

        const width = svgRef.current.clientWidth;
        const height = 400;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const simulation = d3.forceSimulation(nodes as any)
          .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
          .force("charge", d3.forceManyBody().strength(-500))
          .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g")
          .selectAll("line")
          .data(links)
          .join("line")
          .attr("stroke", "rgba(255,255,255,0.1)")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,4");

        const node = svg.append("g")
          .selectAll("g")
          .data(nodes)
          .join("g")
          .call(d3.drag<any, any>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended) as any);

        node.append("circle")
          .attr("r", (d: any) => d.id === assetId ? 30 : 20)
          .attr("fill", (d: any) => d.id === assetId ? "#f97316" : d.type === "ASSET" ? "#3b82f6" : "#10b981")
          .attr("stroke", "rgba(255,255,255,0.2)")
          .attr("stroke-width", 2);

        node.append("text")
          .text((d: any) => d.name)
          .attr("dy", 40)
          .attr("text-anchor", "middle")
          .attr("fill", "white")
          .attr("font-size", "10px")
          .attr("font-weight", "bold");

        simulation.on("tick", () => {
          link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);

          node
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        function dragstarted(event: any) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        }

        function dragged(event: any) {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        }

        function dragended(event: any) {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }

      } catch (error) {
        console.error("Failed to render topology:", error);
      } finally {
        setIsLoading(false);
      }
    };

    renderTopology();
  }, [assetId, assetName]);

  return (
    <div className="h-[400px] bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 flex gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-[10px] text-white/60 uppercase font-bold">Current Asset</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-[10px] text-white/60 uppercase font-bold">Sub-Asset</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[10px] text-white/60 uppercase font-bold">Device</span>
        </div>
      </div>
    </div>
  );
}

function AssetProfileTab({ profiles, onRefresh }: { profiles: AssetProfile[], onRefresh: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  const handleCreate = async () => {
    if (!newProfileName) return;
    try {
      await ThingsBoardService.saveAssetProfile({ name: newProfileName });
      setNewProfileName("");
      setIsAdding(false);
      onRefresh();
    } catch (error) {
      console.error("Failed to create profile:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this asset profile?")) {
      try {
        await ThingsBoardService.deleteAssetProfile(id);
        onRefresh();
      } catch (error) {
        console.error("Failed to delete profile:", error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Asset Profiles</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all border border-white/10"
        >
          <PlusCircle className="w-4 h-4" />
          Create Profile
        </button>
      </div>

      {isAdding && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4">
          <input 
            type="text"
            placeholder="Profile Name (e.g. Factory, Line)"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
          <button 
            onClick={handleCreate}
            className="px-4 py-2 bg-orange-500 text-black rounded-xl text-sm font-bold"
          >
            Save
          </button>
          <button 
            onClick={() => setIsAdding(false)}
            className="p-2 text-white/40 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {profiles.map(profile => (
          <div key={profile.id.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-white/40" />
              </div>
              <div>
                <h4 className="font-bold">{profile.name}</h4>
                <p className="text-xs text-white/40 truncate max-w-[150px]">{profile.description || "No description"}</p>
              </div>
            </div>
            <button 
              onClick={() => handleDelete(profile.id.id)}
              className="p-2 hover:bg-red-500/10 rounded-lg text-red-500/60 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Modals ---

function AssetModal({ 
  isOpen, 
  onClose, 
  asset, 
  profiles, 
  onSave 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  asset: Asset | null, 
  profiles: AssetProfile[],
  onSave: (asset: any) => void
}) {
  const [formData, setFormData] = useState({
    name: asset?.name || "",
    type: asset?.type || (profiles[0]?.name || "default"),
    label: asset?.label || "",
    description: asset?.additionalInfo?.description || ""
  });
  const [attributes, setAttributes] = useState<{key: string, value: string}[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (asset) {
      const fetchAttrs = async () => {
        try {
          const data = await ThingsBoardService.getAssetAttributes(asset.id.id);
          setAttributes(data.map((a: any) => ({ key: a.key, value: String(a.value) })));
        } catch (e) {}
      };
      fetchAttrs();
    }
  }, [asset]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const savedAsset = await ThingsBoardService.saveAsset({
        ...(asset?.id ? { id: asset.id } : {}),
        name: formData.name,
        type: formData.type,
        label: formData.label,
        additionalInfo: {
          description: formData.description
        }
      });

      // Save attributes if any
      if (attributes.length > 0) {
        const attrMap: any = {};
        attributes.forEach(a => {
          if (a.key) attrMap[a.key] = a.value;
        });
        await ThingsBoardService.saveAssetAttributes(savedAsset.id.id, "SHARED_SCOPE", attrMap);
      }

      onSave(savedAsset);
      onClose();
    } catch (error) {
      console.error("Failed to save asset:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addAttribute = () => setAttributes([...attributes, { key: "", value: "" }]);
  const removeAttribute = (idx: number) => setAttributes(attributes.filter((_, i) => i !== idx));
  const updateAttribute = (idx: number, field: "key" | "value", val: string) => {
    const newAttrs = [...attributes];
    newAttrs[idx][field] = val;
    setAttributes(newAttrs);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold">{asset ? "Edit Asset" : "Add New Asset"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Asset Name</label>
              <input 
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
                placeholder="e.g. Factory A"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Asset Profile</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
              >
                <option value="Factory">Factory</option>
                <option value="Production_Line">Production Line</option>
                {profiles.filter(p => p.name !== "Factory" && p.name !== "Production_Line").map(p => (
                  <option key={p.id.id} value={p.name}>{p.name}</option>
                ))}
                {profiles.length === 0 && <option value="default">Default</option>}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Label</label>
            <input 
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
              placeholder="Short label for display"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Description</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all h-24 resize-none"
              placeholder="Detailed description of the asset..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Custom Attributes</label>
              <button 
                type="button"
                onClick={addAttribute}
                className="text-xs font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1"
              >
                <PlusCircle className="w-3 h-3" />
                Add Attribute
              </button>
            </div>
            <div className="space-y-3">
              {attributes.map((attr, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input 
                    type="text"
                    placeholder="Key"
                    value={attr.key}
                    onChange={(e) => updateAttribute(idx, "key", e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                  />
                  <input 
                    type="text"
                    placeholder="Value"
                    value={attr.value}
                    onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-500"
                  />
                  <button 
                    type="button"
                    onClick={() => removeAttribute(idx)}
                    className="p-2 text-red-500/60 hover:text-red-500"
                  >
                    <MinusCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {attributes.length === 0 && (
                <p className="text-xs text-white/20 italic text-center py-4 border border-dashed border-white/5 rounded-xl">
                  No custom attributes defined
                </p>
              )}
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 bg-white/5">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 bg-orange-500 text-black rounded-xl text-sm font-bold hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {asset ? "Update Asset" : "Create Asset"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LinkDeviceModal({ 
  isOpen, 
  onClose, 
  assetId, 
  onLinked,
  linkedDeviceIds 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  assetId: string, 
  onLinked: () => void,
  linkedDeviceIds: string[]
}) {
  const { devices, isLoading, fetchDevices } = useDeviceStore();
  const [search, setSearch] = useState("");
  const [isLinking, setIsLinking] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const filteredDevices = devices.filter(d => 
    !linkedDeviceIds.includes(d.id.id) && 
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.type.toLowerCase().includes(search.toLowerCase()))
  );

  const handleLink = async (deviceId: string) => {
    setIsLinking(deviceId);
    try {
      // 1. Find and remove previous relations for this device (Moving Machines logic)
      const existingRelations = await ThingsBoardService.getDeviceRelations(deviceId, "to");
      const parentRelations = existingRelations.filter((r: any) => 
        r.from.entityType === "ASSET" && (r.type === "Contains" || r.type === "Manages")
      );

      for (const rel of parentRelations) {
        await ThingsBoardService.deleteRelation(
          rel.from.id, 
          rel.from.entityType, 
          rel.type, 
          deviceId, 
          "DEVICE"
        );
      }

      // 2. Create new relation
      await ThingsBoardService.saveRelation({
        from: { id: assetId, entityType: "ASSET" },
        to: { id: deviceId, entityType: "DEVICE" },
        type: "Contains",
        typeGroup: "COMMON"
      });
      onLinked();
      onClose();
    } catch (error) {
      console.error("Failed to link device:", error);
    } finally {
      setIsLinking(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] border border-white/10 rounded-3xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold">Link Device</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text"
              placeholder="Search devices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px] p-4 space-y-2">
          {isLoading ? (
            <LoadingState text="Loading Devices..." />
          ) : filteredDevices.length === 0 ? (
            <p className="text-center py-8 text-white/40 italic">No available devices found</p>
          ) : (
            filteredDevices.map(device => (
              <div key={device.id.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{device.name}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider">{device.type}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleLink(device.id.id)}
                  disabled={isLinking !== null}
                  className="px-4 py-1.5 bg-orange-500 text-black rounded-lg text-xs font-bold hover:bg-orange-400 disabled:opacity-50 transition-all"
                >
                  {isLinking === device.id.id ? "Linking..." : "Link"}
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
