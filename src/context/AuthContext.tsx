import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ThingsBoardService } from "@/src/services/ThingsBoardService";
import { jwtDecode } from "jwt-decode";

interface UserInfo {
  sub: string;
  scopes: string[];
  userId: string;
  firstName?: string;
  lastName?: string;
  tenantId?: string;
  customerId?: string;
  isSystemAdmin: boolean;
  isTenantAdmin: boolean;
  isCustomerUser: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!ThingsBoardService.getToken());
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const decodeUserFromToken = (token: string) => {
    try {
      const decoded: any = jwtDecode(token);
      setUser({
        sub: decoded.sub,
        scopes: decoded.scopes || [],
        userId: decoded.userId,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        tenantId: decoded.tenantId,
        customerId: decoded.customerId,
        isSystemAdmin: decoded.scopes?.includes("SYS_ADMIN"),
        isTenantAdmin: decoded.scopes?.includes("TENANT_ADMIN"),
        isCustomerUser: decoded.scopes?.includes("CUSTOMER_USER"),
      });
    } catch (e) {
      console.error("Failed to decode token", e);
      setUser(null);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = ThingsBoardService.getToken();
      if (token) {
        if (ThingsBoardService.isTokenExpired(token)) {
          try {
            const newToken = await ThingsBoardService.refreshAccessToken();
            setIsAuthenticated(true);
            decodeUserFromToken(newToken);
          } catch (e) {
            ThingsBoardService.logout();
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          setIsAuthenticated(true);
          decodeUserFromToken(token);
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setUser(null);
    };

    window.addEventListener("tb_auth_expired", handleAuthExpired);
    return () => window.removeEventListener("tb_auth_expired", handleAuthExpired);
  }, []);

  const login = async (credentials: any) => {
    const data = await ThingsBoardService.login(credentials);
    setIsAuthenticated(true);
    decodeUserFromToken(data.token);
  };

  const logout = () => {
    ThingsBoardService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
