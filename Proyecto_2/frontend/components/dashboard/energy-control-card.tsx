"use client";

import { useEffect, useState } from "react";
import { EnergyEggIcon } from "@/components/icons/egg-icons";
import { useToast } from "@/components/ui/toast-provider";
import { useTelemetry } from "@/hooks/use-telemetry";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainder} s` : `${remainder} s`;
}

export function EnergyControlCard() {
  const telemetry = useTelemetry();
  const { showToast } = useToast();
  const [limit, setLimit] = useState(telemetry.energyLimitWatts);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [pending, setPending] = useState<"limit" | "timer" | null>(null);

  useEffect(() => setLimit(telemetry.energyLimitWatts), [telemetry.energyLimitWatts]);

  const sendLimit = async () => {
    setPending("limit");
    try {
      await telemetry.publishControl("control/energia", { limite_watts: limit });
      showToast({ tone: "success", title: "Límite enviado", message: `El nodo recibió el nuevo límite de ${limit} W.` });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo enviar", message: error instanceof Error ? error.message : "Revisa la conexión MQTT." });
    } finally {
      setPending(null);
    }
  };

  const sendTimer = async () => {
    setPending("timer");
    try {
      await telemetry.publishControl("control/energia", { temporizador_minutos: timerMinutes });
      showToast({ tone: "success", title: timerMinutes === 0 ? "Temporizador cancelado" : "Temporizador enviado", message: timerMinutes === 0 ? "El nodo recibió la orden para cancelar el temporizador." : `El ciclo quedó programado por ${timerMinutes} minutos.` });
    } catch (error) {
      showToast({ tone: "error", title: "No se pudo enviar", message: error instanceof Error ? error.message : "Revisa la conexión MQTT." });
    } finally {
      setPending(null);
    }
  };

  const watts = telemetry.powerWatts;
  const energy = telemetry.energyKwh;
  const load = watts === null ? 0 : Math.min(100, (watts / Math.max(1, limit)) * 100);

  return (
    <article className="energy-control-card" aria-labelledby="energy-card-title">
      <header className="dashboard-card-heading">
        <span className="dashboard-card-title">
          <span className="dashboard-card-icon energy-icon" aria-hidden="true"><EnergyEggIcon size={26} /></span>
          <span id="energy-card-title">Consumo eléctrico</span>
        </span>
        {telemetry.energyAlert ? <span className="energy-warning-tag active">Sobre el límite</span> : null}
      </header>
      <div className="energy-main-reading">
        <div><p>Potencia instantánea</p><strong>{watts === null ? "—" : watts.toFixed(1)}<small> W</small></strong></div>
        <span className="energy-kwh"><strong>{energy === null ? "—" : energy.toFixed(4)}</strong><small>kWh acumulados</small></span>
      </div>
      <div className={`energy-load-track ${telemetry.energyAlert ? "alert" : ""}`} aria-hidden="true">
        <span style={{ width: `${load}%` }} />
      </div>
      <div className="energy-load-caption"><span>{watts === null ? "Sin medición" : `${load.toFixed(0)}% del límite`}</span></div>

      <div className="energy-component-note" aria-label="Potencia nominal de los componentes">
        <span>Foco <strong>60 W</strong></span><span>Ventilador <strong>5 W</strong></span><span>Servo <strong>2.5 W</strong></span><span>Base <strong>3 W</strong></span>
      </div>

      <div className="energy-setting">
        <label htmlFor="power-limit"><span>Límite máximo</span><output>{limit} W</output></label>
        <input id="power-limit" type="range" min="40" max="150" step="5" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
        <button type="button" className="energy-apply-button" onClick={sendLimit} disabled={!telemetry.isMqttConnected || pending !== null}>
          {pending === "limit" ? "Enviando…" : "Aplicar límite"}
        </button>
      </div>

      <div className="energy-timer-setting">
        <div><span>Temporizador</span><small>{telemetry.timerActive ? `${formatTime(telemetry.timerSecondsRemaining)} restantes` : "Inactivo"}</small></div>
        <select aria-label="Duración del temporizador en minutos" value={timerMinutes} onChange={(event) => setTimerMinutes(Number(event.target.value))}>
          <option value={0}>Cancelar</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
        </select>
        <button type="button" className="energy-timer-button" onClick={sendTimer} disabled={!telemetry.isMqttConnected || pending !== null}>
          {pending === "timer" ? "Enviando…" : timerMinutes === 0 ? "Cancelar" : "Programar"}
        </button>
      </div>
    </article>
  );
}
