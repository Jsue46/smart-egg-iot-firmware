"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CapacityIcon, LotIcon, PlusEggIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import type { LotStatus } from "@/lib/types";

const statusLabel: Record<LotStatus, string> = {
  incubando: "Incubando",
  observacion: "En observación",
  completo: "Ciclo completo",
};

const formatDate = (date: string) => new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

export function LotesContent() {
  const { lots, occupied, capacity } = useSimulatedTelemetry();
  return (
    <div className="lotes-stack">
      <div className="page-intro-row lots-intro">
        <p className="page-lead">Cada huevo conserva su historia desde el ingreso hasta la eclosión.</p>
        <Link href="/lotes/nuevo" className="button primary"><PlusEggIcon />Registrar lote</Link>
      </div>

      <section className="lot-summary" aria-label="Resumen de capacidad">
        <div className="summary-copy"><CapacityIcon size={52} /><div><p>Capacidad actual</p><strong>{occupied} de {capacity}</strong><span>espacios ocupados</span></div></div>
        <div className="egg-capacity" aria-label={`${capacity - occupied} espacios disponibles`}>
          {Array.from({ length: 30 }, (_, index) => <span key={index} className={index < Math.round((occupied / capacity) * 30) ? "occupied" : ""} />)}
        </div>
        <div className="capacity-number"><strong>{Math.max(0, capacity - occupied)}</strong><span>libres</span></div>
      </section>

      <div className="section-heading"><div><p className="eyebrow">Registro de incubación</p><h2>Lotes recientes</h2></div><span className="updated-label">{lots.length} registros</span></div>
      <section className="lot-list" aria-label="Listado de lotes">
        {lots.map((lot, index) => (
          <motion.article className="lot-card" key={lot.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }}>
            <div className="lot-main">
              <span className="lot-icon"><LotIcon size={45} /></span>
              <div><div className="lot-title"><h3>{lot.label}</h3><span className={`status-badge ${lot.status}`}>{statusLabel[lot.status]}</span></div><p className="mono">{lot.id}</p></div>
            </div>
            <div className="lot-metrics">
              <div><span>Ingreso</span><strong>{formatDate(lot.entryDate)}</strong></div>
              <div><span>Cantidad</span><strong>{lot.quantity} huevos</strong></div>
              <div><span>Temperatura</span><strong><TemperatureIcon size={20} />{lot.requiredTemperature.toFixed(1)} °C</strong></div>
            </div>
            <div className="lot-progress">
              <div><span>Progreso del ciclo</span><strong>{lot.progress}%</strong></div>
              <div className="progress-track"><motion.span initial={{ width: 0 }} animate={{ width: `${lot.progress}%` }} transition={{ duration: 0.7, delay: 0.15 + index * 0.04 }} /></div>
            </div>
          </motion.article>
        ))}
      </section>
    </div>
  );
}
