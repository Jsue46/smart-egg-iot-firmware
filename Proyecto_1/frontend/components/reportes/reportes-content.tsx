"use client";

import { useMemo, useState } from "react";
import { downloadSelectableReport } from "@/components/reportes/create-selectable-report";
import { HistoricoSVG } from "@/components/graficas/historico-svg";
import { AlarmIcon, DownloadIcon, HumidityIcon, ReportIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { useToast } from "@/components/ui/toast-provider";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";

const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const formatTimestamp = (timestamp: string) => {
  const [date, time] = timestamp.split("T");
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${monthNames[Number(month) - 1]} ${year} · ${time.slice(0, 5)}`;
};

export function ReportesContent() {
  const { lots, alarms, temperature, humidity, occupied, capacity, technician } = useSimulatedTelemetry();
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const uniqueAlarms = useMemo(() => alarms.filter((alarm, index, all) => index === all.findIndex((candidate) => candidate.id === alarm.id || (candidate.title === alarm.title && candidate.timestamp === alarm.timestamp))), [alarms]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const now = new Date().toISOString();
      await downloadSelectableReport({ lots, alarms: uniqueAlarms, technician, temperature, humidity, occupied, capacity, generatedAt: now });
      showToast({ title: "Reporte listo", message: "El PDF se descargó con texto y datos seleccionables.", tone: "success" });
    } catch (error) {
      showToast({ title: "No se pudo generar el reporte", message: error instanceof Error ? error.message : "Inténtalo de nuevo en unos segundos.", tone: "error", duration: 7_000 });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="reports-stack">
      <div className="page-intro-row lots-intro"><div><p className="page-lead">Del dato diario a una historia útil para cuidar cada ciclo.</p><span className="report-author-chip">Firmado por {technician.name} · {technician.id}</span></div><button className="button primary" type="button" onClick={downloadPdf} disabled={downloading}><DownloadIcon />{downloading ? "Diseñando reporte…" : "Descargar reporte PDF"}</button></div>
      <section className="report-kpis" aria-label="Resumen del periodo">
        <article><span><TemperatureIcon size={37} /></span><div><p>Promedio semanal</p><strong>37.3 <small>°C</small></strong><em>Dentro del objetivo</em></div></article>
        <article><span><HumidityIcon size={37} /></span><div><p>Humedad media</p><strong>57.9 <small>%</small></strong><em>Estable</em></div></article>
        <article><span><ReportIcon size={37} /></span><div><p>Lecturas procesadas</p><strong>4,320</strong><em>Últimos 7 días</em></div></article>
      </section>
      <section className="report-card chart-card"><div className="report-card-head"><div><p className="eyebrow">Últimos siete días</p><h2>Historial de temperatura</h2></div><span className="optimal-label"><i /> Banda óptima 36.8–38 °C</span></div><HistoricoSVG /></section>
      <section className="report-card alarms-card"><div className="report-card-head"><div><p className="eyebrow">Bitácora del sistema</p><h2>Alarmas y eventos</h2></div><span className="updated-label">{uniqueAlarms.length} eventos únicos</span></div><ol className="alarm-timeline">{uniqueAlarms.map((alarm) => <li key={alarm.id} className={alarm.severity}><span className="timeline-icon"><AlarmIcon size={34} /></span><div><div><h3>{alarm.title}</h3><time dateTime={alarm.timestamp}>{formatTimestamp(alarm.timestamp)}</time></div><p>{alarm.detail}</p><span className={`alarm-severity-label ${alarm.severity}`}>{alarm.severity === "critical" ? "Crítica" : alarm.severity === "warning" ? "Advertencia" : "Informativa"}</span><span className="mono">{alarm.id}</span></div></li>)}</ol></section>
    </div>
  );
}
