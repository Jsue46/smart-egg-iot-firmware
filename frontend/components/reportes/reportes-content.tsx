"use client";

import { useState } from "react";
import { HistoricoSVG } from "@/components/graficas/historico-svg";
import { AlarmIcon, DownloadIcon, HumidityIcon, ReportIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { weeklyHistory } from "@/lib/mock-data";

const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const formatTimestamp = (timestamp: string) => {
  const [date, time] = timestamp.split("T");
  const [year, month, day] = date.split("-");
  return `${Number(day)} ${monthNames[Number(month) - 1]} ${year} · ${time.slice(0, 5)}`;
};

export function ReportesContent() {
  const { lots, alarms, temperature, humidity } = useSimulatedTelemetry();
  const [downloading, setDownloading] = useState(false);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      pdf.setFillColor(247, 245, 241);
      pdf.rect(0, 0, 210, 297, "F");
      pdf.setFillColor(221, 168, 58);
      pdf.ellipse(24, 23, 7, 9, "F");
      pdf.setTextColor(43, 42, 40);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("SmartEgg", 38, 21);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(139, 136, 128);
      pdf.text("REPORTE DE INCUBACIÓN · NODO SE-01", 38, 28);
      pdf.setDrawColor(228, 224, 216);
      pdf.line(18, 39, 192, 39);
      pdf.setTextColor(43, 42, 40);
      pdf.setFontSize(15);
      pdf.text("Resumen actual", 18, 52);
      pdf.setFontSize(11);
      pdf.text(`Temperatura: ${temperature.toFixed(1)} °C`, 18, 64);
      pdf.text(`Humedad: ${humidity.toFixed(1)} %`, 76, 64);
      pdf.text(`Lotes registrados: ${lots.length}`, 132, 64);
      pdf.setFontSize(15);
      pdf.text("Lotes", 18, 82);
      let y = 93;
      lots.slice(0, 8).forEach((lot) => {
        pdf.setFont("courier", "normal");
        pdf.setFontSize(9);
        pdf.text(lot.id, 18, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(lot.label, 52, y);
        pdf.text(`${lot.quantity} huevos`, 125, y);
        pdf.text(`${lot.requiredTemperature.toFixed(1)} °C`, 164, y);
        y += 9;
      });
      y += 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("Historial semanal", 18, y);
      y += 11;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      weeklyHistory.forEach((item) => {
        pdf.text(`${item.day}: mín. ${item.min.toFixed(1)} °C · máx. ${item.max.toFixed(1)} °C · humedad ${item.humidity}%`, 18, y);
        y += 7;
      });
      y += 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.text("Alarmas recientes", 18, y);
      y += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      alarms.slice(0, 5).forEach((alarm) => {
        pdf.text(`${formatTimestamp(alarm.timestamp)} · ${alarm.title}`, 18, y);
        y += 6;
        pdf.setTextColor(139, 136, 128);
        pdf.text(alarm.detail, 22, y, { maxWidth: 160 });
        pdf.setTextColor(43, 42, 40);
        y += 10;
      });
      pdf.setFontSize(8);
      pdf.setTextColor(139, 136, 128);
      pdf.text(`Generado el ${new Intl.DateTimeFormat("es-GT", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`, 18, 282);
      pdf.save(`SmartEgg-reporte-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="reports-stack">
      <div className="page-intro-row lots-intro"><p className="page-lead">Del dato diario a una historia útil para cuidar cada ciclo.</p><button className="button primary" type="button" onClick={downloadPdf} disabled={downloading}><DownloadIcon />{downloading ? "Preparando PDF…" : "Descargar reporte PDF"}</button></div>
      <section className="report-kpis" aria-label="Resumen del periodo">
        <article><span><TemperatureIcon size={37} /></span><div><p>Promedio semanal</p><strong>37.3 <small>°C</small></strong><em>Dentro del objetivo</em></div></article>
        <article><span><HumidityIcon size={37} /></span><div><p>Humedad media</p><strong>57.9 <small>%</small></strong><em>Estable</em></div></article>
        <article><span><ReportIcon size={37} /></span><div><p>Lecturas procesadas</p><strong>4,320</strong><em>Últimos 7 días</em></div></article>
      </section>
      <section className="report-card chart-card"><div className="report-card-head"><div><p className="eyebrow">Últimos siete días</p><h2>Historial de temperatura</h2></div><span className="optimal-label"><i /> Banda óptima 36.8–38 °C</span></div><HistoricoSVG /></section>
      <section className="report-card alarms-card"><div className="report-card-head"><div><p className="eyebrow">Bitácora del sistema</p><h2>Alarmas y eventos</h2></div><span className="updated-label">{alarms.length} eventos</span></div><ol className="alarm-timeline">{alarms.map((alarm) => <li key={alarm.id} className={alarm.severity}><span className="timeline-icon"><AlarmIcon size={34} /></span><div><div><h3>{alarm.title}</h3><time dateTime={alarm.timestamp}>{formatTimestamp(alarm.timestamp)}</time></div><p>{alarm.detail}</p><span className="mono">{alarm.id}</span></div></li>)}</ol></section>
    </div>
  );
}
