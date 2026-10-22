"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CloseIcon, ExpandIcon, RotationIcon } from "@/components/icons/egg-icons";

const Scene = dynamic(() => import("./incubator-scene"), { ssr: false });
const HOME_SCENE_ZOOM = 1.14;

interface IncubatorSignatureProps {
  angle: number;
  temperature: number;
  humidity: number;
  occupied: number;
  isAlarm: boolean;
  isVisionLocked: boolean;
  isOnline: boolean;
  heaterOn: boolean;
  fanOn: boolean;
  doorOpen: boolean;
}

function FallbackIllustration({ angle, occupied, humidity, heaterOn, fanOn, doorOpen, yaw, zoom, motionEnabled, isOnline }: { angle: number; occupied: number; humidity: number; heaterOn: boolean; fanOn: boolean; doorOpen: boolean; yaw: number; zoom: number; motionEnabled: boolean; isOnline: boolean }) {
  return (
    <div className={`incubator-fallback ${heaterOn ? "heater-on" : ""} ${fanOn ? "fan-on" : ""} ${doorOpen ? "door-open" : ""}`} style={{ "--scene-yaw": `${yaw}deg`, "--scene-zoom": zoom } as CSSProperties} role="img" aria-label={`Vista 2D de la incubadora: ${isOnline ? `${occupied} de 3 espacios ocupados, humedad ${humidity.toFixed(0)} por ciento, puerta ${doorOpen ? "abierta" : "cerrada"}` : "esperando telemetría del nodo"}`}>
      <div className={`fallback-lamp ${heaterOn ? "active" : ""}`} aria-hidden="true"><span /></div>
      <div className={`fallback-fan ${fanOn ? "active" : ""}`} aria-hidden="true"><span className="fallback-fan-hub" /><div className="fallback-fan-blades"><i /><i /><i /><i /><i /><i /><i /></div></div>
      <div className="fallback-airflow" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <i key={index} className={`air-${index}`} />)}</div>
      <div className="fallback-disc-stage">
        <motion.div className="fallback-disc" animate={{ rotate: angle }} transition={motionEnabled ? { type: "spring", stiffness: 48, damping: 18, mass: 0.8 } : { duration: 0 }}>
          {Array.from({ length: 3 }, (_, index) => <span key={index} className={`fallback-hole slot-${index} ${index < occupied ? "occupied" : ""}`}><i /></span>)}
          <span className="fallback-axis"><i /></span>
        </motion.div>
      </div>
    </div>
  );
}

export function IncubatorSignature({ angle, temperature, humidity, occupied, isAlarm, isVisionLocked, isOnline, heaterOn, fanOn, doorOpen }: IncubatorSignatureProps) {
  const reduceMotion = useReducedMotion();
  const [compact, setCompact] = useState(true);
  const [sceneYaw, setSceneYaw] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragStart = useRef<{ x: number; yaw: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!compact && reduceMotion !== true) return;
    dragStart.current = null;
    setIsExpanded(false);
    setSceneYaw(0);
  }, [compact, reduceMotion]);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStart.current) return;
      const nextYaw = dragStart.current.yaw - (event.clientX - dragStart.current.x) * 0.55;
      setSceneYaw(Math.round(((nextYaw % 360) + 360) % 360));
    };
    const stopDragging = () => { dragStart.current = null; };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || reduceMotion) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    dragStart.current = { x: event.clientX, yaw: sceneYaw };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const toggleExpanded = () => setIsExpanded((expanded) => !expanded);

  return (
    <motion.section
      className={`incubator-hero ${isAlarm ? "alarm" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="digital-twin-title"
    >
      <header className="incubator-panel-head">
        <div>
          <p className="incubator-panel-kicker">Incubadora principal · SE-01</p>
          <h2 id="digital-twin-title">Gemelo digital</h2>
        </div>
      </header>

      <div
        className={`scene-wrap ${isExpanded ? "is-expanded" : ""}`}
        onPointerDown={handlePointerDown}
        aria-label="Modelo 3D sincronizado con la telemetría MQTT"
        title={!compact && !reduceMotion ? "Arrastra para girar el modelo" : undefined}
      >
        {reduceMotion ? (
          <FallbackIllustration angle={angle} occupied={occupied} humidity={humidity} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} yaw={0} zoom={1} motionEnabled={!reduceMotion} isOnline={isOnline} />
        ) : (
          <Scene key={isExpanded ? "expanded-scene" : "panel-scene"} angle={angle} temperature={temperature} humidity={humidity} occupied={occupied} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} yaw={sceneYaw} zoom={HOME_SCENE_ZOOM} alarm={isAlarm} animate isOnline={isOnline} compact={compact} />
        )}

        <div className="scene-live"><span className={isOnline ? "online" : "offline"} />{isOnline ? "MQTT en vivo" : "Esperando nodo"}</div>
        {isAlarm ? <div className="scene-alert visible" role="status"><span />{isVisionLocked ? "Bloqueo crítico activo" : "Alerta crítica activa"}</div> : null}
        {!compact && !reduceMotion ? (
          <button className="scene-expand-button" type="button" onClick={toggleExpanded} aria-pressed={isExpanded} aria-label={isExpanded ? "Cerrar vista ampliada" : "Ampliar gemelo digital"}>
            {isExpanded ? <CloseIcon size={17} /> : <ExpandIcon size={17} />}
            <span>{isExpanded ? "Cerrar" : "Ampliar"}</span>
          </button>
        ) : null}

      </div>

      <div className="scene-hud" aria-label="Estado de actuadores y bandeja">
        <div className="scene-hud-reading"><span>Rotación</span><strong><RotationIcon size={16} />{isOnline ? `${Math.round(angle)}°` : "—"}</strong></div>
        <div className={`scene-hud-reading ${isOnline && heaterOn ? "active" : ""}`}><span>Foco</span><strong><i />{isOnline ? heaterOn ? "Encendido" : "Apagado" : "Sin datos"}</strong></div>
        <div className={`scene-hud-reading ${isOnline && fanOn ? "active" : ""}`}><span>Ventilación</span><strong><i />{isOnline ? fanOn ? "Activa" : "Inactiva" : "Sin datos"}</strong></div>
        <div className="scene-hud-reading"><span>Humedad</span><strong>{isOnline ? `${humidity.toFixed(1)}%` : "—"}</strong></div>
      </div>
    </motion.section>
  );
}
