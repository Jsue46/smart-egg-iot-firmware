"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_DURATION_DAYS,
  deserializeSession,
  serializeSession,
  validateCredentials,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => { ok: true; user: AuthUser } | { ok: false; message: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1] : undefined;
}

function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${days * 86400}; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setUser(deserializeSession(readCookie(SESSION_COOKIE)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
    } else if (user && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [hydrated, user, pathname, router]);

  const login = useCallback((username: string, password: string) => {
    const found = validateCredentials(username, password);
    if (!found) return { ok: false as const, message: "Credenciales incorrectas" };
    writeCookie(SESSION_COOKIE, serializeSession(found), SESSION_DURATION_DAYS);
    setUser(found);
    return { ok: true as const, user: found };
  }, []);

  const logout = useCallback(() => {
    clearCookie(SESSION_COOKIE);
    setUser(null);
    router.replace("/login");
  }, [router]);

  // El middleware protege la carga inicial. Esta barrera evita que una
  // navegación del cliente llegue a pintar contenido antes de validar la sesión.
  if ((!hydrated || !user) && pathname !== "/login") return null;

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
