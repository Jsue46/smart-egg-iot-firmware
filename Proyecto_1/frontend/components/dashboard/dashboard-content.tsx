"use client";

import { motion, useReducedMotion } from "motion/react";
import { IncubatorSignature } from "@/components/escena3d/incubator-signature";
import { AlarmIcon, CapacityIcon, ConnectionIcon, HumidityIcon, PauseIcon, PlayIcon, RotationIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { SensorCard } from "@/components/sensores/sensor-card";
import { useToast } from "@/components/ui/toast-provider";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";

export function DashboardContent() {
  const telemetry = useSimulatedTelemetry();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const temperatureTrend = telemetry.history.map((point) => point.temperature);
  const humidityTrend = telemetry.history.map((point) => point.humidity);
  const angleTrend = telemetry.history.map((_, index) => Math.sin(index / 3) * 45);
  const capacityTrend = telemetry.history.map((_, index) => telemetry.occupied + Math.sin(index / 6) * 0.4);
  const freeSlots = Math.max(0, telemetry.capacity - telemetry.occupied);
  const toggleTelemetry = () => {
    telemetry.togglePaused();
    showToast({
      tone: "info",
      title: telemetry.isPaused ? "Telemetría reanudada" : "Telemetría pausada",
      message: telemetry.isPaused ? "Las lecturas vuelven a actualizarse cada 1.6 segundos." : "Los valores permanecerán fijos hasta que reanudes los datos.",
    });
  };
  const showDemoAlarm = () => {
    telemetry.triggerDemoAlarm();
    showToast({ tone: "warning", title: "Alerta de demostración", message: "Se simuló una temperatura elevada durante nueve segundos." });
  };

  return (
    <div className="dashboard-stack">
      <div className="page-intro-row">
        <div><p className="page-lead">Una lectura clara de lo que ocurre dentro de la cámara.</p></div>
        <div className="dashboard-actions">
          <button className="button secondary compact pause-action" type="button" onClick={toggleTelemetry} aria-pressed={telemetry.isPaused}>
            {telemetry.isPaused ? <PlayIcon /> : <PauseIcon />}{telemetry.isPaused ? "Reanudar" : "Pausar datos"}
          </button>
          <button className="button ghost compact alert-action" type="button" onClick={showDemoAlarm}><AlarmIcon size={23} />Probar alerta</button>
        </div>
      </div>
      <div className="section-heading"><div><p className="eyebrow">Lecturas del nodo SE-01</p><h2>Sensores en vivo</h2></div><span className="updated-label">Actualiza cada 1.6 s</span></div>
      <motion.section
        className="dashboard-bento"
        aria-label="Estado y lecturas de la incubadora"
        variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.06, delayChildren: reduceMotion ? 0 : 0.12 } } }}
        initial="hidden"
        animate="show"
      >
        <IncubatorSignature angle={telemetry.servoAngle} temperature={telemetry.temperature} occupied={telemetry.occupied} capacity={telemetry.capacity} isAlarm={telemetry.isAlarm} />
        <motion.article className="system-bento-card" variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
          <div className="system-bento-head">
            <span className="system-bento-icon"><ConnectionIcon size={35} /></span>
            <span className={telemetry.isOnline ? "system-live-tag" : "system-live-tag offline"}><i /> {telemetry.isOnline ? "En línea" : "Desconectado"}</span>
          </div>
          <div className="system-bento-copy">
            <p>Estado general</p>
            <h3>{telemetry.isOnline ? "Sistema conectado" : "Buscando nodo..."}</h3>
            <span>{telemetry.isOnline ? "Nodo SE-01 · lectura estable" : "Sin conexión con Arduino"}</span>
          </div>
          <footer><span>Operado por</span><strong>{telemetry.technician.name}</strong></footer>
        </motion.article>
        <SensorCard className="bento-temperature" label="Temperatura" value={telemetry.temperature} suffix="°C" decimals={1} detail="Objetivo 37.5 °C" icon={<TemperatureIcon />} trend={temperatureTrend} accent={telemetry.isAlarm ? "alert" : "yolk"} state={telemetry.isAlarm ? "Atención" : "Óptimo"} />
        <SensorCard className="bento-humidity" label="Humedad" value={telemetry.humidity} suffix="%" decimals={1} detail="Rango 50–65 %" icon={<HumidityIcon />} trend={humidityTrend} accent="aqua" state="Estable" />
        <SensorCard className="bento-rotation" label="Rotación" value={telemetry.servoAngle} suffix="°" detail="Ciclo ±45°" icon={<RotationIcon />} trend={angleTrend} accent="violet" state="En ciclo" />
        <SensorCard className="bento-capacity" label="Espacios ocupados" value={telemetry.occupied} suffix={` / ${telemetry.capacity}`} detail={`${freeSlots} ${freeSlots === 1 ? "espacio libre" : "espacios libres"}`} icon={<CapacityIcon />} trend={capacityTrend} accent="sprout" state="Disco" />
      </motion.section>
    </div>
  );
}
