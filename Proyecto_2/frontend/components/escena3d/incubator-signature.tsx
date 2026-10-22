"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CloseIcon, ExpandIcon, RotateLeftIcon, RotateRightIcon, RotationIcon, TemperatureIcon, ZoomInIcon, ZoomOutIcon } from "@/components/icons/egg-icons";

const Scene = dynamic(() => import("./incubator-scene"), { ssr: false });
const HOME_SCENE_ZOOM = 0.82;

interface IncubatorSignatureProps {
  angle: number;
  temperature: number;
  humidity: number;
  occupied: number;
  capacity: number;
  isAlarm: boolean;
  isOnline: boolean;
  heaterOn: boolean;
  fanOn: boolean;
  doorOpen: boolean;
}

function FallbackIllustration({ angle, occupied, humidity, heaterOn, fanOn, doorOpen, yaw, zoom, motionEnabled }: { angle: number; occupied: number; humidity: number; heaterOn: boolean; fanOn: boolean; doorOpen: boolean; yaw: number; zoom: number; motionEnabled: boolean }) {
  return (
    <div className={`incubator-fallback ${heaterOn ? "heater-on" : ""} ${fanOn ? "fan-on" : ""} ${doorOpen ? "door-open" : ""}`} style={{ "--scene-yaw": `${yaw}deg`, "--scene-zoom": zoom } as CSSProperties} role="img" aria-label={`Vista 2D de la incubadora: ${occupied} de 3 espacios ocupados, humedad ${humidity.toFixed(0)} por ciento, puerta ${doorOpen ? "abierta" : "cerrada"}`}>
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

export function IncubatorSignature({ angle, temperature, humidity, occupied, capacity, isAlarm, isOnline, heaterOn, fanOn, doorOpen }: IncubatorSignatureProps) {
  const reduceMotion = useReducedMotion();
  const [compact, setCompact] = useState(true);
  const [sceneYaw, setSceneYaw] = useState(0);
  const [sceneZoom, setSceneZoom] = useState(HOME_SCENE_ZOOM);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "p5">("3d");
  const dragStart = useRef<{ x: number; yaw: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    // Browsers may cap hardwareConcurrency for privacy, so it is not a
    // reliable signal for deciding whether a desktop can render WebGL.
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

  const updateYaw = (value: number) => setSceneYaw(Math.round(Math.max(0, Math.min(360, value))));
  const updateZoom = (value: number) => setSceneZoom(Math.max(0.82, Math.min(1.55, value)));
  const toggleExpanded = () => {
    if (isExpanded) {
      setSceneZoom(HOME_SCENE_ZOOM);
      setIsExpanded(false);
      return;
    }
    setSceneZoom(HOME_SCENE_ZOOM);
    setIsExpanded(true);
  };
  const handleScenePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || reduceMotion) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, input, label")) return;
    dragStart.current = { x: event.clientX, yaw: sceneYaw };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStart.current) return;
      const nextYaw = dragStart.current.yaw - (event.clientX - dragStart.current.x) * 0.55;
      setSceneYaw(Math.round(((nextYaw % 360) + 360) % 360));
    };
    const stopDragging = () => {
      dragStart.current = null;
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  return (
    <motion.section className={`incubator-hero ${isAlarm ? "alarm" : ""}`} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}>
      <div className="hero-copy">
        <span className={`hero-kicker ${isAlarm ? "alarm" : ""}`}><span /> {isAlarm ? "Alerta de condición crítica" : "Monitoreo en tiempo real"}</span>
        <h2>Cámara de incubación <em>interactiva.</em></h2>
        <p>La visualización combina la estructura de la incubadora con la telemetría real de temperatura, humedad, actuadores y rotación.</p>
        <div className="hero-metrics-grid" aria-label="Lecturas y estado de la incubadora">
          <div className="hero-reading"><TemperatureIcon size={32} /><span><strong>{temperature.toFixed(1)} °C</strong><small>temperatura actual</small></span></div>
          <div className="hero-reading"><RotationIcon size={32} /><span><strong>{Math.round(angle)}°</strong><small>posición del disco</small></span></div>
          <div className="hero-device-note"><span>Foco / Fan</span><strong>{heaterOn ? "ON" : "OFF"} / {fanOn ? "ON" : "OFF"}</strong><small>Humedad {humidity.toFixed(1)}% · SE-01</small></div>
          <div className="hero-device-note"><span>Canasta</span><strong>{occupied} / {capacity} ocupados</strong><small>Tapa {doorOpen ? "abierta" : "cerrada"}</small></div>
        </div>
      </div>
      <motion.div layout transition={{ layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }} className={`scene-wrap ${isExpanded ? "is-expanded" : ""}`} onPointerDown={handleScenePointerDown} aria-label={compact || reduceMotion ? "Vista 2D animada de la incubadora sincronizada con la telemetría" : "Modelo 3D de incubadora sincronizado con la telemetría. Arrastra para girarlo horizontalmente."} title={compact || reduceMotion ? undefined : "Arrastra la incubadora para girarla"}>
        <div style={{ position: "absolute", top: "14px", left: "14px", zIndex: 12, display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`button ${viewMode === "3d" ? "primary" : "secondary"} compact`}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              minHeight: "28px",
              borderRadius: "20px",
              cursor: "pointer",
            }}
            onClick={(e) => { e.stopPropagation(); setViewMode("3d"); }}
          >
            Modelo 3D
          </button>
          <button
            type="button"
            className={`button ${viewMode === "p5" ? "primary" : "secondary"} compact`}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              minHeight: "28px",
              borderRadius: "20px",
              cursor: "pointer",
            }}
            onClick={(e) => { e.stopPropagation(); setViewMode("p5"); }}
          >
            Simulación p5.js
          </button>
        </div>

        {viewMode === "p5" ? (
          <iframe
            src="/visualizacion_p5.html"
            title="Simulador p5.js Incubadora"
            style={{
              width: "100%",
              height: "100%",
              minHeight: "420px",
              border: "none",
              borderRadius: "16px",
              display: "block",
              background: "#181716",
            }}
          />
        ) : (
          compact || reduceMotion ? (
            <FallbackIllustration angle={angle} occupied={occupied} humidity={humidity} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} yaw={0} zoom={1} motionEnabled={!reduceMotion} />
          ) : (
            <Scene key={isExpanded ? "expanded-scene" : "panel-scene"} angle={angle} temperature={temperature} humidity={humidity} occupied={occupied} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} yaw={sceneYaw} zoom={isExpanded ? sceneZoom : HOME_SCENE_ZOOM} alarm={isAlarm} animate />
          )
        )}

        {!compact && !reduceMotion && (
          <div className="scene-controls" aria-label="Controles de la visualización">
            {viewMode === "3d" && (
              <div className="scene-control-group scene-rotate-control" role="group" aria-label="Rotación horizontal del modelo">
                <span>Rotación 360°</span>
                <button className="scene-step-button" type="button" onClick={() => updateYaw(sceneYaw - 15)} aria-label="Girar 15 grados a la izquierda"><RotateLeftIcon size={16} /></button>
                <input type="range" min="0" max="360" step="1" value={sceneYaw} onChange={(event) => updateYaw(Number(event.target.value))} aria-label="Rotación horizontal del modelo, de 0 a 360 grados" />
                <button className="scene-step-button" type="button" onClick={() => updateYaw(sceneYaw + 15)} aria-label="Girar 15 grados a la derecha"><RotateRightIcon size={16} /></button>
                <output>{sceneYaw}°</output>
              </div>
            )}
            {isExpanded && viewMode === "3d" && (
              <div className="scene-control-group scene-zoom-control" role="group" aria-label="Zoom del modelo">
                <span>Zoom</span>
                <button className="scene-step-button" type="button" onClick={() => updateZoom(sceneZoom - 0.08)} aria-label="Alejar modelo"><ZoomOutIcon size={16} /></button>
                <input type="range" min="0.82" max="1.55" step="0.01" value={sceneZoom} onChange={(event) => updateZoom(Number(event.target.value))} aria-label="Zoom del modelo, de 82 a 155 por ciento" />
                <button className="scene-step-button" type="button" onClick={() => updateZoom(sceneZoom + 0.08)} aria-label="Acercar modelo"><ZoomInIcon size={16} /></button>
                <output>{Math.round(sceneZoom * 100)}%</output>
              </div>
            )}
            <button className="scene-control-button" type="button" onClick={toggleExpanded} aria-pressed={isExpanded} aria-label={isExpanded ? "Cerrar vista ampliada" : "Ampliar modelo 3D"}>
              {isExpanded ? <CloseIcon size={18} /> : <ExpandIcon size={18} />}<span>{isExpanded ? "Cerrar" : "Ampliar"}</span>
            </button>
          </div>
        )}
        {isExpanded && isAlarm && <div className="scene-alert visible" role="status"><span />Alerta: condición crítica detectada</div>}
        <div className="scene-live"><span className={isOnline ? "online" : "offline"} />{isOnline ? "API · MQTT en vivo" : "Sin conexión"}</div>
      </motion.div>
    </motion.section>
  );
}
