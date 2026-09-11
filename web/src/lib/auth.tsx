import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWorks } from "@/lib/wataseru/store";
import { api } from "./api";

export type Me = {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: "member" | "contractor";
};

type AuthState = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const data = await api<{ user: Me | null }>("/api/auth/me");
    setMe(data.user);
  }

  useEffect(() => {
    void refresh()
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setMe(null);
    useWorks.setState({ works: [], loaded: false });
  }

  return <Ctx.Provider value={{ me, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
