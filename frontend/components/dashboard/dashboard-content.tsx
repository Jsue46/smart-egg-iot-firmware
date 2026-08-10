"use client";

import { motion, useReducedMotion } from "motion/react";
import { IncubatorSignature } from "@/components/escena3d/incubator-signature";
import { AlarmIcon, CapacityIcon, HumidityIcon, PauseIcon, PlayIcon, RotationIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { SensorCard } from "@/components/sensores/sensor-card";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";

export function DashboardContent() {
  const telemetry = useSimulatedTelemetry();
  const reduceMotion = useReducedMotion();
  const temperatureTrend = telemetry.history.map((point) => point.temperature);
  const humidityTrend = telemetry.history.map((point) => point.humidity);
  const angleTrend = telemetry.history.map((_, index) => Math.sin(index / 3) * 45);
  const capacityTrend = telemetry.history.map((_, index) => telemetry.occupied + Math.sin(index / 6) * 0.4);

  return (
    <div className="dashboard-stack">
      <div className="page-intro-row">
        <div><p className="page-lead">Una lectura clara de lo que ocurre dentro de la cámara.</p></div>
        <div className="dashboard-actions">
          <button className="button secondary compact" type="button" onClick={telemetry.togglePaused} aria-pressed={telemetry.isPaused}>
            {telemetry.isPaused ? <PlayIcon /> : <PauseIcon />}{telemetry.isPaused ? "Reanudar" : "Pausar datos"}
          </button>
          <button className="button ghost compact alert-action" type="button" onClick={telemetry.triggerDemoAlarm}><AlarmIcon size={23} />Probar alerta</button>
        </div>
      </div>
      <IncubatorSignature angle={telemetry.servoAngle} temperature={telemetry.temperature} isAlarm={telemetry.isAlarm} />
      <div className="section-heading"><div><p className="eyebrow">Lecturas del nodo SE-01</p><h2>Sensores en vivo</h2></div><span className="updated-label">Actualiza cada 1.6 s</span></div>
      <motion.section
        className="sensor-grid"
        aria-label="Lecturas de sensores"
        variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06, delayChildren: reduceMotion ? 0 : 0.12 } } }}
        initial="hidden"
        animate="show"
      >
        <SensorCard label="Temperatura" value={telemetry.temperature} suffix="°C" decimals={1} detail="Objetivo 37.5 °C" icon={<TemperatureIcon />} trend={temperatureTrend} accent={telemetry.isAlarm ? "alert" : "yolk"} />
        <SensorCard label="Humedad" value={telemetry.humidity} suffix="%" decimals={1} detail="Rango 50–65 %" icon={<HumidityIcon />} trend={humidityTrend} />
        <SensorCard label="Rotación" value={telemetry.servoAngle} suffix="°" detail="Ciclo ±45°" icon={<RotationIcon />} trend={angleTrend} accent="yolk" />
        <SensorCard label="Espacios ocupados" value={telemetry.occupied} suffix={` / ${telemetry.capacity}`} detail={`${Math.max(0, telemetry.capacity - telemetry.occupied)} espacios libres`} icon={<CapacityIcon />} trend={capacityTrend} />
      </motion.section>
    </div>
  );
}
