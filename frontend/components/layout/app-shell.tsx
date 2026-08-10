"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import {
  ConnectionIcon,
  DashboardIcon,
  LotIcon,
  PlusEggIcon,
  ReportIcon,
} from "@/components/icons/egg-icons";

const navigation = [
  { href: "/dashboard", label: "Panel", icon: DashboardIcon },
  { href: "/lotes", label: "Lotes", icon: LotIcon },
  { href: "/reportes", label: "Reportes", icon: ReportIcon },
];

function Brand() {
  return (
    <Link className="brand" href="/dashboard" aria-label="SmartEgg, ir al panel">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span><strong>SmartEgg</strong><small>Incubación precisa</small></span>
    </Link>
  );
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={mobile ? "mobile-nav" : "sidebar-nav"} aria-label="Navegación principal">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/lotes" && pathname.startsWith("/lotes"));
        return (
          <Link key={href} href={href} className={active ? "nav-link active" : "nav-link"} aria-current={active ? "page" : undefined}>
            <Icon size={mobile ? 27 : 30} />
            <span>{label}</span>
          </Link>
        );
      })}
      {mobile && (
        <Link href="/lotes/nuevo" className={pathname === "/lotes/nuevo" ? "nav-link active" : "nav-link"}>
          <PlusEggIcon size={27} /><span>Registrar</span>
        </Link>
      )}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isOnline } = useSimulatedTelemetry();
  const title = pathname === "/dashboard" ? "Panel de incubación" : pathname === "/reportes" ? "Reportes" : pathname === "/lotes/nuevo" ? "Registrar lote" : "Lotes";

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <aside className="sidebar">
        <Brand />
        <Navigation />
        <div className="sidebar-foot">
          <div className="sidebar-status"><ConnectionIcon size={34} color="var(--sprout)" /><span><strong>Sistema conectado</strong><small>Nodo SE-01 · ahora</small></span></div>
          <div className="team-badge"><span>E15</span><div><strong>Equipo SmartEgg</strong><small>USAC · AYC2</small></div></div>
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
            <span className="live-dot" /> En línea
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
