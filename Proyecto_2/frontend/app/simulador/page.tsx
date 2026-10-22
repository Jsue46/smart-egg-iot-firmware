"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  AlarmIcon,
  ConnectionIcon,
  HumidityIcon,
  LockIcon,
  RotationIcon,
  TemperatureIcon,
} from "@/components/icons/egg-icons";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { useToast } from "@/components/ui/toast-provider";
import { MQTT_WS_URL, NODE_ID } from "@/lib/config";

export default function SimuladorPage() {
  const telemetry = useSimulatedTelemetry();
  const { showToast } = useToast();
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [limiteWatts, setLimiteWatts] = useState(80);

  const desbloquearSistema = async () => {
    setDesbloqueando(true);
    try {
      // Enviar comando MQTT de desbloqueo vía WebSocket
      const mqtt = await import("mqtt");
      const client = mqtt.connect(MQTT_WS_URL, {
        clientId: `web-reset-${Math.random().toString(16).slice(2)}`,
        clean: true,
      });

      client.on("connect", () => {
        const topicBloqueo = `smartegg/${NODE_ID}/control/bloqueo`;
        const payload = JSON.stringify({
          nodo_id: NODE_ID,
          bloquear: false,
          motivo: "desbloqueo_manual_frontend",
          timestamp: new Date().toISOString(),
        });
        client.publish(topicBloqueo, payload, { qos: 1, retain: true }, () => {
          client.end();
          setDesbloqueando(false);
          showToast({
            tone: "success",
            title: "Sistema Desbloqueado",
            message: "Se envió la orden de reanudación a la incubadora y al Arduino.",
          });
        });
      });

      client.on("error", (err) => {
        client.end();
        setDesbloqueando(false);
        showToast({
          tone: "error",
          title: "Error de conexión",
          message: `No se pudo enviar el desbloqueo: ${err.message}`,
        });
      });
    } catch (e: any) {
      setDesbloqueando(false);
      showToast({
        tone: "error",
        title: "Error",
        message: e.message || "Error al conectar con el broker MQTT",
      });
    }
  };

  const aplicarLimitePotencia = async (nuevoLimite: number) => {
    setLimiteWatts(nuevoLimite);
    try {
      const mqtt = await import("mqtt");
      const client = mqtt.connect(MQTT_WS_URL, {
        clientId: `web-energy-${Math.random().toString(16).slice(2)}`,
        clean: true,
      });

      client.on("connect", () => {
        const topicCmd = `smartegg/${NODE_ID}/control/energia`;
        const payload = JSON.stringify({
          limite_watts: nuevoLimite,
          timestamp: new Date().toISOString(),
        });
        client.publish(topicCmd, payload, { qos: 1 }, () => {
          client.end();
          showToast({
            tone: "info",
            title: "Límite de Potencia Actualizado",
            message: `Nuevo umbral máximo fijado en ${nuevoLimite} Watts.`,
          });
        });
      });
    } catch {
      // Ignorar si el broker no responde inmediatamente
    }
  };

  const isLocked = Boolean(telemetry.isVisionLocked);
  const visionClass = telemetry.visionClass || "vacio";
  const visionConfidence = telemetry.visionConfidence ? (telemetry.visionConfidence * 100).toFixed(1) : "0.0";
  const powerWatts = telemetry.powerWatts ?? 3.5;
  const energyKwh = telemetry.energyKwh ?? 0.0004;

  return (
    <div className="dashboard-stack">
      {/* Encabezado */}
      <div className="page-intro-row">
        <div>
          <p className="page-lead">
            Gemelo digital interactivo en <strong>p5.js</strong>, control inteligente de energía y supervisión de seguridad por Visión Artificial.
          </p>
        </div>
        <div className="dashboard-actions">
          {isLocked && (
            <button
              className="button alert compact"
              type="button"
              disabled={desbloqueando}
              onClick={desbloquearSistema}
            >
              <LockIcon size={18} />
              {desbloqueando ? "Restableciendo..." : "Desbloquear Sistema"}
            </button>
          )}
          <a
            className="button secondary compact"
            href="/visualizacion_p5.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir Canvas Pantalla Completa ↗
          </a>
        </div>
      </div>

      {/* Banner de Bloqueo Crítico por Visión Artificial */}
      {isLocked && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="alarm-banner"
          style={{
            background: "linear-gradient(135deg, #7e1d1d 0%, #991b1b 100%)",
            color: "#ffffff",
            padding: "16px 20px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.2)",
            boxShadow: "0 10px 30px rgba(153, 27, 27, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{ fontSize: "28px" }}>🚨</span>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>
                ¡SISTEMA BLOQUEADO POR OBJETO EXTRAÑO!
              </strong>
              <span style={{ fontSize: "13px", opacity: 0.9 }}>
                La cámara de Visión Artificial detectó un objeto no autorizado en la bandeja. El servomotor y los actuadores se encuentran detenidos por seguridad.
              </span>
            </div>
          </div>
          <button
            className="button primary compact"
            style={{ background: "#ffffff", color: "#991b1b", fontWeight: 600 }}
            onClick={desbloquearSistema}
            disabled={desbloqueando}
          >
            {desbloqueando ? "Restableciendo..." : "Restablecer y Desbloquear"}
          </button>
        </motion.div>
      )}

      {/* Grid Bento con Simulador p5.js y Tarjetas de Fase 3 */}
      <section className="dashboard-bento" aria-label="Simulador y métricas Fase 3">
        {/* Canvas embebido del Simulador p5.js */}
        <article
          className="system-bento-card"
          style={{
            gridColumn: "span 2",
            minHeight: "680px",
            padding: 0,
            overflow: "hidden",
            position: "relative",
            background: "#181716",
            border: "1px solid var(--border-strong)",
            borderRadius: "20px",
          }}
        >
          <div
            style={{
              padding: "12px 18px",
              background: "rgba(35, 34, 32, 0.9)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="brand-mark" style={{ width: "24px", height: "28px" }}>
                <span style={{ width: "4px", height: "4px", top: "5px", right: "5px" }} />
              </span>
              <strong style={{ color: "#fff", fontSize: "14px" }}>
                Simulador de Incubadora en Tiempo Real (p5.js + MQTT)
              </strong>
            </div>
            <span
              className={telemetry.isOnline ? "system-live-tag" : "system-live-tag offline"}
            >
              <i /> {telemetry.isOnline ? "MQTT Conectado" : "Buscando broker..."}
            </span>
          </div>
          <iframe
            src="/visualizacion_p5.html"
            title="Simulador p5.js Incubadora SmartEgg"
            style={{
              width: "100%",
              height: "calc(100% - 50px)",
              minHeight: "630px",
              border: "none",
              display: "block",
            }}
          />
        </article>

        {/* Tarjeta de Visión Artificial (IA) */}
        <article
          className="system-bento-card"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div className="system-bento-head">
            <span className="system-bento-icon" style={{ color: "var(--yolk-deep)" }}>
              <LockIcon size={32} />
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "20px",
                background:
                  visionClass === "huevo"
                    ? "var(--sprout-soft)"
                    : visionClass === "objeto_extrano" || isLocked
                    ? "var(--alert-soft)"
                    : "var(--aqua-soft)",
                color:
                  visionClass === "huevo"
                    ? "var(--sprout)"
                    : visionClass === "objeto_extrano" || isLocked
                    ? "var(--alert)"
                    : "var(--aqua)",
              }}
            >
              {isLocked
                ? "BLOQUEADO"
                : visionClass === "huevo"
                ? "HUEVO VÁLIDO"
                : visionClass === "objeto_extrano"
                ? "OBJETO EXTRAÑO"
                : "VACÍO"}
            </span>
          </div>

          <div>
            <p style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Módulo de Visión Artificial (IA)
            </p>
            <h3 style={{ fontSize: "22px", margin: "4px 0 0", color: "var(--ink)" }}>
              {visionClass === "huevo"
                ? "Huevo Detectado"
                : visionClass === "objeto_extrano"
                ? "Objeto no identificado"
                : "Bandeja Vacía"}
            </h3>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Confianza del modelo: <strong>{visionConfidence}%</strong>
            </span>
          </div>

          <div style={{ marginTop: "auto", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
              <span>Certidumbre IA</span>
              <strong>{visionConfidence}%</strong>
            </div>
            <div style={{ height: "8px", background: "var(--shell)", borderRadius: "4px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${visionConfidence}%`,
                  background:
                    visionClass === "objeto_extrano" || isLocked
                      ? "var(--alert)"
                      : "var(--sprout)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </article>

        {/* Tarjeta de Gestión Inteligente de Energía */}
        <article
          className="system-bento-card"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
            padding: "22px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div className="system-bento-head">
            <span className="system-bento-icon" style={{ color: "var(--yolk)" }}>
              ⚡
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "20px",
                background: "var(--yolk-soft)",
                color: "var(--yolk-deep)",
              }}
            >
              GESTIÓN ENERGÉTICA
            </span>
          </div>

          <div>
            <p style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
              Consumo Eléctrico en Tiempo Real
            </p>
            <h3 style={{ fontSize: "28px", margin: "4px 0 0", color: "var(--ink)", fontWeight: 700 }}>
              {powerWatts.toFixed(1)} <small style={{ fontSize: "16px", fontWeight: 500 }}>Watts</small>
            </h3>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Energía acumulada: <strong>{energyKwh.toFixed(4)} kWh</strong>
            </span>
          </div>

          <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px" }}>Límite programado:</span>
              <strong style={{ fontSize: "13px" }}>{limiteWatts} W</strong>
            </div>
            <input
              type="range"
              min="40"
              max="120"
              step="5"
              value={limiteWatts}
              onChange={(e) => aplicarLimitePotencia(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--yolk)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
              <span>40 W</span>
              <span>80 W (Recomendado)</span>
              <span>120 W</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
