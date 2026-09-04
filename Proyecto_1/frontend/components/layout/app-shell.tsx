"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import {
  ConnectionIcon,
  DashboardIcon,
  LotIcon,
  MenuIcon,
  PlusEggIcon,
  ReportIcon,
} from "@/components/icons/egg-icons";

const navigation = [
  { href: "/dashboard", label: "Panel", icon: DashboardIcon },
  { href: "/lotes", label: "Lotes", icon: LotIcon },
  { href: "/reportes", label: "Reportes", icon: ReportIcon },
  { href: "/lotes/nuevo", label: "Registrar", icon: PlusEggIcon },
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

function Navigation({ mobile = false, collapsed = false }: { mobile?: boolean; collapsed?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "mobile-nav" : "sidebar-nav"} aria-label="Navegación principal">
      {navigation.map(({ href, label, icon: Icon }) => {
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOnline, technician } = useSimulatedTelemetry();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [narrowRail, setNarrowRail] = useState(false);
  const title = pathname === "/dashboard" ? "Panel de incubación" : pathname === "/reportes" ? "Reportes" : pathname === "/lotes/nuevo" ? "Registrar lote" : "Lotes";

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    const mediaQuery = window.matchMedia("(min-width: 761px) and (max-width: 920px)");
    const updateRail = () => setNarrowRail(mediaQuery.matches);
    updateRail();
    mediaQuery.addEventListener("change", updateRail);
    return () => mediaQuery.removeEventListener("change", updateRail);
  }, []);

  const effectiveCollapsed = sidebarCollapsed || narrowRail;
  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

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
        <div id="sidebar-navigation"><Navigation collapsed={effectiveCollapsed} /></div>
        <div className="sidebar-foot">
          <div className="sidebar-status"><ConnectionIcon size={34} color="var(--sprout)" /><span><strong>{isOnline ? "Sistema conectado" : "Sistema desconectado"}</strong><small>Nodo SE-01 · ahora</small></span></div>
          <div className="team-badge"><span>G7</span><div><strong>{technician.name}</strong><small>{technician.id}</small></div></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand"><Brand /></div>
          <div>
            <p className="eyebrow">Incubadora principal · Zona 1</p>
            <h1>{title}</h1>
          </div>
          <div className="live-chip" aria-label={isOnline ? "Sistema en línea" : "Sistema desconectado"}>
            <span className="live-dot" /> {isOnline ? "En línea" : "Desconectado"}
          </div>
        </header>
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
      <Navigation mobile />
    </div>
    </MotionConfig>
  );
}
