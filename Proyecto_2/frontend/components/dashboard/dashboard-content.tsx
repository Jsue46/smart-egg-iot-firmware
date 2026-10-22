"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlarmIcon } from "@/components/icons/egg-icons";
import { IncubatorSignature } from "@/components/escena3d/incubator-signature";
import { EnergyControlCard } from "@/components/dashboard/energy-control-card";
import { TelemetryMetricCard } from "@/components/dashboard/telemetry-metric-card";
import { VisionStatusCard } from "@/components/dashboard/vision-status-card";
import { useToast } from "@/components/ui/toast-provider";
import { useTelemetry } from "@/hooks/use-telemetry";

export function DashboardContent() {
  const telemetry = useTelemetry();
  const { showToast } = useToast();
  const [unlocking, setUnlocking] = useState(false);

  const requestUnlock = async () => {
    setUnlocking(true);
    try {
      await telemetry.publishControl("control/bloqueo", { bloquear: false });
      showToast({ tone: "success", title: "Orden enviada", message: "Se pidió al nodo retirar el bloqueo. Esperando confirmación MQTT." });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo desbloquear", message: error instanceof Error ? error.message : "Revisa la conexión con el nodo." });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="dashboard-stack dashboard-v3">
      <header className="dashboard-page-heading">
        <div>
          <p className="dashboard-kicker">SmartEgg · monitoreo ambiental</p>
          <h2>Estado de incubación</h2>
          <p>Condiciones, visión y consumo · SE-01</p>
        </div>
        <div className={`dashboard-mqtt-status ${telemetry.isMqttConnected ? "connected" : "disconnected"}`} role="status" aria-live="polite">
          <span className="dashboard-mqtt-mark"><i /></span>
          <span><strong>{telemetry.isMqttConnected ? "MQTT conectado" : "MQTT desconectado"}</strong><small>Broker · WebSockets · 9001</small></span>
          <span className="dashboard-node-pill">SE-01</span>
        </div>
      </header>

      {telemetry.isVisionLocked ? (
        <motion.section className="dashboard-emergency" role="alert" aria-live="assertive" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
          <span className="emergency-icon" aria-hidden="true"><AlarmIcon size={25} /></span>
          <div className="emergency-copy"><strong>Bloqueo crítico por visión artificial</strong><span>Se detectó un objeto extraño. El nodo mantiene apagados los actuadores de seguridad.</span></div>
          <button type="button" onClick={requestUnlock} disabled={!telemetry.isMqttConnected || unlocking}>
            {unlocking ? "Enviando orden…" : "Restablecer sistema"}
          </button>
        </motion.section>
      ) : null}

      <section className="dashboard-primary-grid" aria-label="Gemelo digital y estado de la incubadora">
        <IncubatorSignature
          angle={telemetry.isOnline ? telemetry.servoAngle : 90}
          temperature={telemetry.temperature}
          humidity={telemetry.humidity}
          occupied={telemetry.occupied}
          capacity={telemetry.capacity}
          isAlarm={telemetry.isAlarm}
          isVisionLocked={telemetry.isVisionLocked}
          isOnline={telemetry.isOnline}
          heaterOn={telemetry.heaterOn}
          fanOn={telemetry.fanOn}
          doorOpen={telemetry.doorOpen}
        />
        <aside className="dashboard-control-column" aria-label="Visión y consumo">
          <VisionStatusCard visionClass={telemetry.visionClass} confidence={telemetry.visionConfidence} isLocked={telemetry.isVisionLocked} />
          <EnergyControlCard />
        </aside>
      </section>

      <section className="dashboard-telemetry-section" aria-labelledby="environment-heading">
        <header className="dashboard-section-heading">
          <div><h3 id="environment-heading">Condiciones ambientales</h3></div>
        </header>
        <div className="dashboard-metric-grid">
          <TelemetryMetricCard kind="temperature" label="Temperatura" value={telemetry.temperature} unit="°C" detail="Objetivo · 37.5 °C" history={telemetry.history} isMqttConnected={telemetry.isMqttConnected} />
          <TelemetryMetricCard kind="humidity" label="Humedad relativa" value={telemetry.humidity} unit="%" detail="Rango recomendado · 50–65 %" history={telemetry.history} isMqttConnected={telemetry.isMqttConnected} />
        </div>
      </section>
    </div>
  );
}
