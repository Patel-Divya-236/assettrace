import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { api, setUnauthorizedHandler, tokenStore } from "../api/client";
import { type Role, STAFF_ROLES, type User } from "../api/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  signup: (name: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Any 401 from the API (expired token) logs the user out.
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // On page load, if a token is saved, ask the API who we are.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api<{ user: User }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (login: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/api/auth/login", { body: { login, password } });
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  // Citizens create their own account; staff accounts are created by an admin.
  const signup = useCallback(async (name: string, phone: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/api/auth/signup", { body: { name, phone, password } });
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** True if the current user has one of these roles. For hiding buttons only; the API enforces. */
export function useCan(...roles: Role[]) {
  const { user } = useAuth();
  return !!user && roles.includes(user.role);
}

export const isStaff = (user: User | null) => !!user && STAFF_ROLES.includes(user.role);

/** Route guard: must be logged in with a staff role (default) or one of the given roles. */
export function RequireRole({ roles = STAFF_ROLES, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to={isStaff(user) ? "/app" : "/"} replace />;
  return <>{children}</>;
}
