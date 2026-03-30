import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE = "/api/tb";

export interface ThingsBoardToken {
  token: string;
  refreshToken: string;
}

export class ThingsBoardService {
  private static token: string | null = localStorage.getItem("tb_token");
  private static refreshToken: string | null = localStorage.getItem("tb_refresh_token");

  static {
    // Add axios interceptor for all requests
    axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("tb_token");
        if (token && config.url?.startsWith("/api/")) {
          config.headers.Authorization = `Bearer ${token}`;
          config.headers["X-Authorization"] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  static setTokens(tokens: ThingsBoardToken) {
    this.token = tokens.token;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem("tb_token", tokens.token);
    localStorage.setItem("tb_refresh_token", tokens.refreshToken);
  }

  static getToken() {
    return this.token;
  }

  static getRefreshToken() {
    return this.refreshToken;
  }

  static isTokenExpired(token: string): boolean {
    try {
      const decoded: any = jwtDecode(token);
      return decoded.exp * 1000 < Date.now();
    } catch (e) {
      return true;
    }
  }

  static logout() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem("tb_token");
    localStorage.removeItem("tb_refresh_token");
  }

  static async login(credentials: any): Promise<ThingsBoardToken> {
    const response = await axios.post("/api/auth/login", credentials);
    this.setTokens(response.data);
    return response.data;
  }

  static async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) throw new Error("No refresh token available");
    
    try {
      const response = await axios.post("/api/auth/refresh", {
        refreshToken: this.refreshToken
      });
      this.setTokens(response.data);
      return response.data.token;
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  static async request(config: any) {
    if (this.token && this.isTokenExpired(this.token)) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        window.dispatchEvent(new CustomEvent("tb_auth_expired"));
        throw e;
      }
    }

    const headers: any = { ...config.headers };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
      headers["X-Authorization"] = `Bearer ${this.token}`;
    }

    return axios({
      ...config,
      headers,
    });
  }

  static async getDevices() {
    try {
      const response = await this.request({
        method: 'GET',
        url: `${API_BASE}/tenant/deviceInfos`,
        params: { pageSize: 100, page: 0, sortProperty: 'name', sortOrder: 'ASC' },
      });
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 400) {
        try {
          const user = await this.getCurrentUser();
          if (user && user.customerId && user.customerId.id !== "13814000-1dd2-11b2-8080-808080808080") {
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/customer/${user.customerId.id}/deviceInfos`,
              params: { pageSize: 100, page: 0, sortProperty: 'name', sortOrder: 'ASC' },
            });
            return response.data.data;
          }
        } catch (e: any) {
          // If customer check fails, try basic user devices
          try {
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/user/devices`,
              params: { pageSize: 100, page: 0 },
            });
            return response.data.data;
          } catch (e2) {
            // Last resort: basic tenant devices
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/tenant/devices`,
              params: { pageSize: 100, page: 0 },
            });
            return response.data.data;
          }
        }
      }
      throw error;
    }
  }

  static async getDeviceById(deviceId: string) {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/device/${deviceId}`,
    });
    return response.data;
  }

  static async getAssets(pageSize: number = 100, page: number = 0, type: string = "") {
    try {
      const response = await this.request({
        method: 'GET',
        url: `${API_BASE}/tenant/assetInfos`,
        params: { pageSize, page, type, sortProperty: 'name', sortOrder: 'ASC' },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 400) {
        try {
          const user = await this.getCurrentUser();
          if (user && user.customerId && user.customerId.id !== "13814000-1dd2-11b2-8080-808080808080") {
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/customer/${user.customerId.id}/assetInfos`,
              params: { pageSize, page, type, sortProperty: 'name', sortOrder: 'ASC' },
            });
            return response.data;
          }
        } catch (e: any) {
          try {
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/user/assets`,
              params: { pageSize, page, type },
            });
            return response.data;
          } catch (e2) {
            const response = await this.request({
              method: 'GET',
              url: `${API_BASE}/tenant/assets`,
              params: { pageSize, page, type },
            });
            return response.data;
          }
        }
      }
      throw error;
    }
  }

  static async getCurrentUser() {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/auth/user`,
    });
    return response.data;
  }

  static async getAssetById(assetId: string) {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/asset/${assetId}`,
    });
    return response.data;
  }

  static async saveAsset(asset: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/asset`,
      data: asset,
    });
    return response.data;
  }

  static async deleteAsset(assetId: string) {
    const response = await this.request({
      method: 'DELETE',
      url: `${API_BASE}/asset/${assetId}`,
    });
    return response.data;
  }

  static async getAssetProfiles(pageSize: number = 50, page: number = 0) {
    try {
      const response = await this.request({
        method: 'GET',
        url: `${API_BASE}/assetProfiles`,
        params: { pageSize, page },
      });
      return response.data;
    } catch (e) {
      // Fallback for TB CE or older versions
      return { data: [] };
    }
  }

  static async saveAssetProfile(profile: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/assetProfile`,
      data: profile,
    });
    return response.data;
  }

  static async deleteAssetProfile(profileId: string) {
    const response = await this.request({
      method: 'DELETE',
      url: `${API_BASE}/assetProfile/${profileId}`,
    });
    return response.data;
  }

  static async getAssetAttributes(assetId: string, scope: string = "SHARED_SCOPE") {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/plugins/telemetry/ASSET/${assetId}/values/attributes/${scope}`,
    });
    return response.data;
  }

  static async saveAssetAttributes(assetId: string, scope: string, attributes: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/plugins/telemetry/ASSET/${assetId}/${scope}`,
      data: attributes,
    });
    return response.data;
  }

  static async saveDevice(device: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/device`,
      data: device,
    });
    return response.data;
  }

  static async deleteDevice(deviceId: string) {
    const response = await this.request({
      method: 'DELETE',
      url: `${API_BASE}/device/${deviceId}`,
    });
    return response.data;
  }

  static async getDeviceProfiles(pageSize: number = 50, page: number = 0) {
    try {
      const response = await this.request({
        method: 'GET',
        url: `${API_BASE}/deviceProfiles`,
        params: { pageSize, page },
      });
      return response.data;
    } catch (e) {
      // Fallback for Customer users or older versions
      return { data: [] };
    }
  }

  static async getDeviceAttributes(deviceId: string, scope: string = "SHARED_SCOPE") {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/plugins/telemetry/DEVICE/${deviceId}/values/attributes/${scope}`,
    });
    return response.data;
  }

  static async saveDeviceAttributes(deviceId: string, scope: string, attributes: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/plugins/telemetry/DEVICE/${deviceId}/${scope}`,
      data: attributes,
    });
    return response.data;
  }

  static async getDeviceCredentials(deviceId: string) {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/device/${deviceId}/credentials`,
    });
    return response.data;
  }

  static async getAssetRelations(assetId: string, direction: "from" | "to" = "from") {
    const params: any = {};
    if (direction === "from") {
      params.fromId = assetId;
      params.fromType = "ASSET";
    } else {
      params.toId = assetId;
      params.toType = "ASSET";
    }

    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/relations/info`,
      params,
    });
    return response.data;
  }

  static async getDeviceRelations(deviceId: string, direction: "from" | "to" = "to") {
    const params: any = {};
    if (direction === "from") {
      params.fromId = deviceId;
      params.fromType = "DEVICE";
    } else {
      params.toId = deviceId;
      params.toType = "DEVICE";
    }

    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/relations/info`,
      params,
    });
    return response.data;
  }

  static async findByQuery(query: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/devicesQuery/find`,
      data: query,
    });
    return response.data;
  }

  static async saveRelation(relation: any) {
    const response = await this.request({
      method: 'POST',
      url: `${API_BASE}/relation`,
      data: relation,
    });
    return response.data;
  }

  static async deleteRelation(fromId: string, fromType: string, relationType: string, toId: string, toType: string) {
    const response = await this.request({
      method: 'DELETE',
      url: `${API_BASE}/relation`,
      params: {
        fromId,
        fromType,
        relationType,
        toId,
        toType
      }
    });
    return response.data;
  }

  static async getLatestTelemetry(deviceId: string) {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE}/plugins/telemetry/DEVICE/${deviceId}/values/timeseries`,
    });
    return response.data;
  }

  // Local SQLite API calls
  static async getOeeReports(deviceId: string) {
    const response = await axios.get(`/api/reports/oee`, { params: { deviceId } });
    return response.data;
  }

  static async saveOeeReport(report: any) {
    const response = await axios.post(`/api/reports/oee`, report);
    return response.data;
  }

  static async getPlanning() {
    const response = await axios.get(`/api/planning`);
    return response.data;
  }

  static async savePlanning(plan: any) {
    const response = await axios.post(`/api/planning`, plan);
    return response.data;
  }

  static async getDowntime() {
    const response = await axios.get(`/api/downtime`);
    return response.data;
  }

  static async saveDowntime(event: any) {
    const response = await axios.post(`/api/downtime`, event);
    return response.data;
  }

  // Analytics API calls
  static async getOeeTrends(deviceId: string, period: string = "day") {
    const response = await axios.get(`/api/analytics/oee-trends`, { params: { deviceId, period } });
    return response.data;
  }

  static async getDowntimePareto(deviceId: string) {
    const response = await axios.get(`/api/analytics/downtime-pareto`, { params: { deviceId } });
    return response.data;
  }

  static async getLossAnalysis(deviceId: string) {
    const response = await axios.get(`/api/analytics/loss-analysis`, { params: { deviceId } });
    return response.data;
  }

  static async getAnalyticsSummary(deviceId: string) {
    const response = await axios.get(`/api/analytics/summary`, { params: { deviceId } });
    return response.data;
  }
}
