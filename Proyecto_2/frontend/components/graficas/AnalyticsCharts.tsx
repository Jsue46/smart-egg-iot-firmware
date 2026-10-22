"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTelemetry } from "@/hooks/use-telemetry";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export function AnalyticsCharts() {
  const { history } = useTelemetry();
  const samples = history.slice(-24);
  const labels = samples.map((point) => new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(point.at));

  const data = {
    labels,
    datasets: [
      {
        label: "Temperatura (°C)",
        data: samples.map((point) => point.temperature),
        borderColor: "#bd8a38",
        backgroundColor: "rgba(189, 138, 56, .08)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
      {
        label: "Humedad (%)",
        data: samples.map((point) => point.humidity),
        borderColor: "#368b87",
        backgroundColor: "rgba(54, 139, 135, .06)",
        fill: false,
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  };

  return (
    <section className="report-card chart-card" aria-labelledby="live-sensor-chart-title">
      <div className="report-card-head"><div><p className="eyebrow">Muestras MQTT</p><h2 id="live-sensor-chart-title">Temperatura y humedad</h2></div><span className="updated-label">{samples.length} lecturas recientes</span></div>
      {samples.length > 1 ? <Line data={data} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: false } } }} /> : <p style={{ color: "var(--muted)", fontSize: 12 }}>El gráfico aparecerá al recibir lecturas del nodo por MQTT.</p>}
    </section>
  );
}
