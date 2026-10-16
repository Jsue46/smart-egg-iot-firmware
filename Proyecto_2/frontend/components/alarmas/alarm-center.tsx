"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { useToast } from "@/components/ui/toast-provider";
import { AlarmIcon, CloseIcon } from "@/components/icons/egg-icons";
import { isAlarmSoundEnabled, playAlarmSound, setAlarmSoundEnabled, unlockAudio } from "@/lib/sounds";
import type { Alarm } from "@/lib/types";

const timeFormatter = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function toastTone(alarm: Alarm) {
  return alarm.severity === "critical" ? "error" : "warning";
}

export function AlarmCenter() {
  const { alarms, isAlarm } = useSimulatedTelemetry();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => !isAlarmSoundEnabled());
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const activeKindsRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(true);
  const mountRef = useRef(0);

  useEffect(() => {
    mountRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (bootRef.current) {
      bootRef.current = false;
      alarms.forEach((alarm) => seenRef.current.add(alarm.id));
      activeKindsRef.current = new Set(alarms.filter((alarm) => alarm.active ?? isAlarm).map((alarm) => alarm.title));
      return;
    }
    const fresh = alarms.filter((alarm) => !seenRef.current.has(alarm.id));
    for (const alarm of fresh) {
      seenRef.current.add(alarm.id);
    }
    if (fresh.length === 0 || Date.now() - mountRef.current < 2000) return;
    for (const alarm of fresh) {
      const active = alarm.active ?? isAlarm;
      const wasActive = activeKindsRef.current.has(alarm.title);
      if (active && !wasActive) {
        activeKindsRef.current.add(alarm.title);
        playAlarmSound();
        showToast({
          title: `Alarma ${alarm.severity === "warning" ? "de aviso" : "crítica"}: ${alarm.title}`,
          message: alarm.detail,
          tone: toastTone(alarm),
          duration: 7000,
        });
      } else if (!active && wasActive) {
        activeKindsRef.current.delete(alarm.title);
        showToast({
          title: `Alarma resuelta: ${alarm.title}`,
          message: alarm.detail,
          tone: "info",
          duration: 4000,
        });
      }
    }
  }, [alarms, isAlarm, showToast]);

  const unreadCount = alarms.filter((alarm) => alarm.active !== false && !readIds.has(alarm.id)).length;

  const togglePanel = () => {
    unlockAudio();
    setOpen((current) => {
      const next = !current;
      if (next) {
        const activeIds = alarms.filter((alarm) => alarm.active !== false).map((alarm) => alarm.id);
        setReadIds((currentRead) => new Set([...currentRead, ...activeIds]));
      }
      return next;
    });
  };

  const markAllRead = () => {
    setReadIds((current) => {
      const merged = new Set(current);
      alarms.forEach((alarm) => merged.add(alarm.id));
      return merged;
    });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAlarmSoundEnabled(!next);
    if (!next) unlockAudio();
  };

  return (
    <div className="alarm-hub">
      <button
        type="button"
        className={isAlarm ? "alarm-bell is-alarm" : "alarm-bell"}
        aria-label={`Centro de alarmas${unreadCount > 0 ? `, ${unreadCount} sin leer` : ""}`}
        aria-expanded={open}
        onClick={togglePanel}
      >
        <AlarmIcon size={24} />
        {unreadCount > 0 ? <span className="alarm-badge">{unreadCount}</span> : null}
      </button>
      {open ? <button className="alarm-backdrop" type="button" tabIndex={-1} aria-label="Cerrar centro de alarmas" onClick={() => setOpen(false)} /> : null}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="alarm-panel"
            className="alarm-panel"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="false"
            aria-label="Centro de alarmas"
          >
            <div className="alarm-panel-head">
              <div>
                <p className="eyebrow" style={{ margin: 0 }}>Centro de alarmas</p>
                <strong>{isAlarm ? "Hay condiciones críticas activas" : "Sin alertas activas"}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" className="alarm-icon-btn" onClick={toggleMute} aria-label={muted ? "Activar sonido de alarma" : "Silenciar sonido de alarma"}>
                  {muted ? "Sonido: no" : "Sonido: sí"}
                </button>
                <button type="button" className="alarm-icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar centro de alarmas"><CloseIcon size={18} /></button>
              </div>
            </div>
            <div className="alarm-panel-list">
              {alarms.length === 0 ? (
                <p className="alarm-empty">Sin eventos de alarma reportados por el nodo.</p>
              ) : (
                alarms.slice(0, 12).map((alarm) => {
                  const active = alarm.active !== false;
                  return (
                    <div key={alarm.id} className={`alarm-item ${alarm.severity === "warning" ? "warning" : "critical"}`}>
                      <div className="alarm-item-head">
                        <span className={active ? "alarm-status activa" : "alarm-status resuelta"}>{active ? "Activa" : "Resuelta"}</span>
                        <strong>{alarm.title}</strong>
                        <time>{timeFormatter.format(new Date(alarm.timestamp))}</time>
                      </div>
                      <p>{alarm.detail}</p>
                    </div>
                  );
                })
              )}
            </div>
            {unreadCount > 0 ? (
              <div className="alarm-panel-foot">
                <button type="button" className="button secondary compact" onClick={markAllRead}>Marcar como leídas</button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AlarmBanner() {
  const { isAlarm, alarms } = useSimulatedTelemetry();
  const [dismissed, setDismissed] = useState(false);
  const latestActive = alarms.find((alarm) => alarm.active === true);

  useEffect(() => {
    setDismissed(false);
  }, [alarms.length]);

  if (!isAlarm || dismissed || !latestActive) return null;

  return (
    <div className="alarm-banner" role="alert">
      <AlarmIcon size={28} color="currentColor" />
      <div>
        <strong>ALARMA ACTIVA</strong>
        <p>{latestActive.title} · {latestActive.detail}</p>
      </div>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Ocultar banner de alarma"><CloseIcon size={20} /></button>
    </div>
  );
}