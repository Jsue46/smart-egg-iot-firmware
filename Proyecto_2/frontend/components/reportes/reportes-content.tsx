"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadSelectableReport } from "@/components/reportes/create-selectable-report";
import { HistoricoSVG } from "@/components/graficas/historico-svg";
import { AlarmIcon, DownloadIcon, HumidityIcon, ReportIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { useToast } from "@/components/ui/toast-provider";
import { useTelemetry } from "@/hooks/use-telemetry";
import type { Alarm } from "@/lib/types";

type ReportEvent = {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  severity: Alarm["severity"];
  kind: "alarm" | "door";
};

type EventKindFilter = "all" | ReportEvent["kind"];
type EventSeverityFilter = "all" | Alarm["severity"];

function parseTimestamp(timestamp: string) {
  const normalized = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

const formatTimestamp = (timestamp: string) => {
  const date = parseTimestamp(timestamp);
  if (!date) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(",", " ·");
};

const severityLabel = (severity: Alarm["severity"]) => severity === "critical" ? "Crítica" : severity === "warning" ? "Advertencia" : "Informativa";

export function ReportesContent() {
  const { lots, alarms, doorEvents, temperature, humidity, occupied, capacity, technician } = useTelemetry();
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [eventKind, setEventKind] = useState<EventKindFilter>("all");
  const [eventSeverity, setEventSeverity] = useState<EventSeverityFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const uniqueAlarms = useMemo(() => alarms.filter((alarm, index, all) => index === all.findIndex((candidate) => candidate.id === alarm.id || (candidate.title === alarm.title && candidate.timestamp === alarm.timestamp))), [alarms]);

  const reportEvents = useMemo<ReportEvent[]>(() => {
    const alarmEvents: ReportEvent[] = uniqueAlarms.map((alarm) => ({
      id: alarm.id,
      timestamp: alarm.timestamp,
      title: alarm.title,
      detail: alarm.detail,
      severity: alarm.severity,
      kind: "alarm",
    }));
    const doorReportEvents: ReportEvent[] = doorEvents.map((event) => ({
      id: `PUERTA-${event.id}`,
      timestamp: event.timestamp,
      title: `Puerta · ${String(event.accion).toUpperCase()}`,
      detail: `${String(event.accion).toUpperCase() === "ABRIR" ? "Apertura registrada" : "Cierre registrado"}${event.operador ? ` por ${event.operador}` : ""}${event.cantidad_huevos ? ` · ${event.cantidad_huevos} huevos` : ""}.`,
      severity: "info",
      kind: "door",
    }));

    return [...alarmEvents, ...doorReportEvents].sort((left, right) => (parseTimestamp(right.timestamp)?.getTime() ?? 0) - (parseTimestamp(left.timestamp)?.getTime() ?? 0));
  }, [doorEvents, uniqueAlarms]);

  useEffect(() => {
    setEventPage(1);
  }, [dateFrom, dateTo, eventKind, eventSeverity]);

  const filteredEvents = useMemo(() => {
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return reportEvents.filter((event) => {
      const timestamp = parseTimestamp(event.timestamp)?.getTime() ?? 0;
      return (eventKind === "all" || event.kind === eventKind) && (eventSeverity === "all" || event.severity === eventSeverity) && timestamp >= from && timestamp <= to;
    });
  }, [dateFrom, dateTo, eventKind, eventSeverity, reportEvents]);

  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(eventPage, pageCount);
  const visibleEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <section className="report-card chart-card history-card"><div className="report-card-head"><div><p className="eyebrow">Últimos siete días</p><h2>Historial de temperatura</h2></div><span className="optimal-label"><i /> Banda óptima 36.8–38 °C</span></div><HistoricoSVG /></section>
      <section className="report-card alarms-card" aria-labelledby="events-heading">
        <div className="report-card-head"><div><p className="eyebrow">Bitácora del sistema</p><h2 id="events-heading">Alarmas y eventos</h2></div><span className="updated-label">{filteredEvents.length} de {reportEvents.length} eventos MQTT</span></div>
        <div className="event-filters" role="search" aria-label="Filtros de alarmas y eventos">
          <label><span>Desde</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Hasta</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label><span>Tipo</span><select value={eventKind} onChange={(event) => setEventKind(event.target.value as EventKindFilter)}><option value="all">Todos</option><option value="alarm">Alarmas</option><option value="door">Puerta</option></select></label>
          <label><span>Severidad</span><select value={eventSeverity} onChange={(event) => setEventSeverity(event.target.value as EventSeverityFilter)}><option value="all">Todas</option><option value="critical">Crítica</option><option value="warning">Advertencia</option><option value="info">Informativa</option></select></label>
          <button className="button ghost compact" type="button" onClick={() => { setDateFrom(""); setDateTo(""); setEventKind("all"); setEventSeverity("all"); }}>Limpiar filtros</button>
        </div>
        {visibleEvents.length > 0 ? <ul className="event-grid" aria-live="polite">{visibleEvents.map((event) => <li key={event.id} className={`event-card ${event.severity} ${event.kind}`}><div className="event-card-head"><span className="event-icon">{event.kind === "door" ? <ReportIcon size={31} /> : <AlarmIcon size={31} />}</span><div><span className="event-kind">{event.kind === "door" ? "Acceso de puerta" : "Alarma ambiental"}</span><time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time></div></div><h3>{event.title}</h3><p>{event.detail}</p><footer><span className={`alarm-severity-label ${event.severity}`}>{severityLabel(event.severity)}</span><span className="mono">{event.id}</span></footer></li>)}</ul> : <div className="event-empty" role="status"><ReportIcon size={38} /><strong>Sin registros para estos filtros</strong><span>Amplía el rango de fechas o restablece los filtros.</span></div>}
        <div className="event-pagination"><span>Mostrando {visibleEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredEvents.length)} de {filteredEvents.length}</span><div><button className="event-page-button" type="button" onClick={() => setEventPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Página anterior">‹</button><strong>Página {currentPage} de {pageCount}</strong><button className="event-page-button" type="button" onClick={() => setEventPage((page) => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} aria-label="Página siguiente">›</button></div></div>
      </section>
    </div>
  );
}
