import type { TelemetryPoint } from "@/lib/types";
import { HumidityIcon, TemperatureIcon } from "@/components/icons/egg-icons";

interface TelemetryMetricCardProps {
  kind: "temperature" | "humidity";
  label: string;
  value: number;
  unit: string;
  detail: string;
  history: TelemetryPoint[];
  isMqttConnected: boolean;
}

function Sparkline({ values, tone }: { values: number[]; tone: "amber" | "aqua" }) {
  const samples = values.slice(-32);
  if (samples.length < 2) return null;

  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);
  const spread = maximum - minimum || 1;
  const points = samples.map((sample, index) => {
    const x = (index / (samples.length - 1)) * 180;
    const y = 36 - ((sample - minimum) / spread) * 28;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg className={`metric-sparkline ${tone}`} viewBox="0 0 180 44" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="40" x2="180" y2="40" />
      <polyline points={points} />
    </svg>
  );
}

export function TelemetryMetricCard({ kind, label, value, unit, detail, history, isMqttConnected }: TelemetryMetricCardProps) {
  const values = history.map((point) => point[kind]);
  const hasReading = history.length > 0;
  const latest = value.toFixed(1);
  const Icon = kind === "temperature" ? TemperatureIcon : HumidityIcon;
  const status = !hasReading ? "Sin lectura" : isMqttConnected ? "En vivo" : "Última lectura";

  return (
    <article className={`dashboard-metric-card ${kind}`} aria-label={`${label}: ${hasReading ? `${latest} ${unit}` : "esperando lectura MQTT"}`}>
      <header className="metric-card-head">
        <div className="metric-card-title"><span className={`metric-card-icon ${kind}`} aria-hidden="true"><Icon size={22} /></span><div><p>{label}</p><span>{detail}</span></div></div>
        {hasReading ? <span className={`metric-live-tag ${isMqttConnected ? "ready" : "pending"}`}><i />{status}</span> : null}
      </header>
      <div className="metric-card-main">
        {hasReading ? (
          <>
            <div className="metric-reading"><strong>{latest}</strong><span>{unit}</span></div>
            <Sparkline values={values} tone={kind === "temperature" ? "amber" : "aqua"} />
          </>
        ) : <p className="metric-empty">Sin lectura</p>}
      </div>
    </article>
  );
}
