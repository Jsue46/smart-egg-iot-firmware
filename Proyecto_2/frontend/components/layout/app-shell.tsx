"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { useAuth } from "@/components/auth/auth-provider";
import { AlarmBanner, AlarmCenter } from "@/components/alarmas/alarm-center";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import {
  AdminIcon,
  ConnectionIcon,
  DashboardIcon,
  DoorIcon,
  LogoutIcon,
  LotIcon,
  MenuIcon,
  PlusEggIcon,
  ReportIcon,
  RotationIcon,
  UserIcon,
} from "@/components/icons/egg-icons";

interface NavItem {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
  roles: Role[];
}

const navigation: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: DashboardIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/simulador", label: "Simulador p5.js", icon: RotationIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/lotes", label: "Lotes", icon: LotIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/reportes", label: "Reportes", icon: ReportIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/puerta", label: "Puerta", icon: DoorIcon, roles: ["operador1", "operador2"] },
  { href: "/lotes/nuevo", label: "Registrar", icon: PlusEggIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/perfil", label: "Perfil", icon: UserIcon, roles: ["administrador", "operador1", "operador2"] },
  { href: "/admin", label: "Administración", icon: AdminIcon, roles: ["administrador"] },
];

const SIDEBAR_STORAGE_KEY = "smartegg-sidebar-collapsed";

function Brand() {
  return (
    <Link className="brand" href="/dashboard" aria-label="SmartEgg, ir al panel">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span><strong>SmartEgg</strong><small>Incubación precisa</small></span>
    </Link>
  );
}

function Navigation({ mobile = false, collapsed = false, items }: { mobile?: boolean; collapsed?: boolean; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "mobile-nav" : "sidebar-nav"} aria-label="Navegación principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={active ? "nav-link active" : "nav-link"}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon size={mobile ? 27 : 30} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const titles: Record<string, string> = {
    "/dashboard": "Panel de incubación",
    "/simulador": "Simulador interactivo y Visión AI (Fase 3)",
    "/reportes": "Reportes",
    "/lotes/nuevo": "Registrar lote",
    "/lotes": "Lotes",
    "/puerta": "Control de puerta",
    "/perfil": "Mi perfil",
    "/admin": "Administración",
  };
  return <>{titles[pathname] ?? "SmartEgg"}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOnline, technician } = useSimulatedTelemetry();
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [narrowRail, setNarrowRail] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    const mediaQuery = window.matchMedia("(min-width: 761px) and (max-width: 920px)");
    const updateRail = () => setNarrowRail(mediaQuery.matches);
    updateRail();
    mediaQuery.addEventListener("change", updateRail);
    return () => mediaQuery.removeEventListener("change", updateRail);
  }, []);

  if (pathname === "/login") return <>{children}</>;

  const effectiveCollapsed = sidebarCollapsed || narrowRail;
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  const visibleNavigation = user ? navigation.filter((item) => item.roles.includes(user.role)) : navigation;
  const identityName = user?.name ?? technician.name;
  const identityBadge = user?.badge ?? technician.id;

  return (
    <MotionConfig reducedMotion="user">
    <div className={effectiveCollapsed ? "app-frame sidebar-collapsed" : "app-frame"}>
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className="sidebar" aria-label="Barra lateral">
        <div className="sidebar-head">
          <Brand />
          <button
            className="sidebar-toggle"
            type="button"
            aria-expanded={!effectiveCollapsed}
            aria-controls="sidebar-navigation"
            aria-label={effectiveCollapsed ? "Expandir navegación" : "Colapsar navegación"}
            onClick={toggleSidebar}
          >
            <MenuIcon size={27} />
          </button>
        </div>
        <div id="sidebar-navigation"><Navigation collapsed={effectiveCollapsed} items={visibleNavigation} /></div>
        <div className="sidebar-foot">
          <div className="sidebar-status"><ConnectionIcon size={34} color="var(--sprout)" /><span><strong>{isOnline ? "Sistema conectado" : "Sistema desconectado"}</strong><small>Nodo SE-01 · ahora</small></span></div>
          <div className="team-badge"><span>{user ? "OP" : "G7"}</span><div><strong>{identityName}</strong><small>{identityBadge}</small></div></div>
          <button className="logout-link" type="button" onClick={logout} aria-label="Cerrar sesión">
            <strong>Cerrar sesión</strong>
            <LogoutIcon size={20} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div>
            <p className="eyebrow">Incubadora principal · Zona 1</p>
            <h1><PageTitle pathname={pathname} /></h1>
          </div>
          <div className="topbar-actions">
            <AlarmCenter />
            <div className="live-chip" aria-label={isOnline ? "Sistema en línea" : "Sistema desconectado"}>
              <span className="live-dot" /> {isOnline ? "En línea" : "Desconectado"}
              {user ? <small style={{ marginLeft: 8, color: "var(--muted)", fontFamily: "var(--font-mono), monospace" }}>{ROLE_LABELS[user.role]}</small> : null}
            </div>
            <button className="mobile-logout" type="button" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogoutIcon size={19} />
            </button>
          </div>
        </header>
        <AlarmBanner />
        <motion.main
          id="main-content"
          tabIndex={-1}
          key={pathname}
          className="page-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.main>
      </div>
      <Navigation mobile items={visibleNavigation} />
    </div>
    </MotionConfig>
  );
}
