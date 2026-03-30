import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Dashboard } from "./components/Dashboard";
import { ProductionPlanning } from "./components/ProductionPlanning";
import { Analytics } from "./components/Analytics";
import { DowntimeTracking } from "./components/DowntimeTracking";
import { AssetManagement } from "./components/AssetManagement";
import { DeviceManagement } from "./components/DeviceManagement";
import { Login } from "./components/Login";
import { Sidebar, Tab } from "./components/shared/Sidebar";
import { Header } from "./components/shared/Header";
import { LoadingState } from "./components/shared/LoadingState";

function MainLayout() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (isLoading) {
    return <LoadingState fullScreen text="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSidebarOpen={isSidebarOpen} 
        logout={logout} 
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          activeTab={activeTab} 
          isSidebarOpen={isSidebarOpen} 
          setIsSidebarOpen={setIsSidebarOpen} 
          userName={user?.username?.substring(0, 2).toUpperCase() || "JD"}
        />

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "planning" && <ProductionPlanning />}
          {activeTab === "analytics" && <Analytics />}
          {activeTab === "assets" && <AssetManagement />}
          {activeTab === "devices" && <DeviceManagement />}
          {activeTab === "downtime" && <DowntimeTracking />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainLayout />
      </NotificationProvider>
    </AuthProvider>
  );
}
