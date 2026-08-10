"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotationIcon, TemperatureIcon } from "@/components/icons/egg-icons";

const Scene = dynamic(() => import("./incubator-scene"), { ssr: false });

function FallbackIllustration({ angle }: { angle: number }) {
  return (
    <div className="incubator-fallback" role="img" aria-label="Ilustración de la bandeja de la incubadora">
      <div className="fallback-shell">
        <div className="fallback-window">
          <motion.div className="fallback-tray" animate={{ rotate: angle * 0.25 }} transition={{ type: "spring", stiffness: 55, damping: 18 }}>
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </motion.div>
        </div>
        <div className="fallback-light" />
      </div>
    </div>
  );
}

export function IncubatorSignature({ angle, temperature, isAlarm }: { angle: number; temperature: number; isAlarm: boolean }) {
  const reduceMotion = useReducedMotion();
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    // Browsers may cap hardwareConcurrency for privacy, so it is not a
    // reliable signal for deciding whether a desktop can render WebGL.
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <motion.section className={`incubator-hero ${isAlarm ? "alarm" : ""}`} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}>
      <div className="hero-copy">
        <span className={`hero-kicker ${isAlarm ? "alarm" : ""}`}><span /> {isAlarm ? "Atención requerida" : "Ambiente estable"}</span>
        <h2>Todo está en su<br />punto de <em>calor.</em></h2>
        <p>La cámara mantiene las condiciones ideales para los lotes activos. Los cambios se actualizan suavemente en tiempo real.</p>
        <div className="hero-readings">
          <div><TemperatureIcon size={32} /><span><strong>{temperature.toFixed(1)} °C</strong><small>temperatura actual</small></span></div>
          <div><RotationIcon size={32} /><span><strong>{Math.round(angle)}°</strong><small>posición de bandeja</small></span></div>
        </div>
      </div>
      <div className="scene-wrap" aria-label="Modelo de incubadora sincronizado con la telemetría">
        {compact || reduceMotion ? <FallbackIllustration angle={angle} /> : <Scene angle={angle} temperature={temperature} />}
        <div className="scene-note"><span className="scene-note-line" /><span><small>Servo activo</small><strong>Ciclo automático</strong></span></div>
      </div>
    </motion.section>
  );
}
