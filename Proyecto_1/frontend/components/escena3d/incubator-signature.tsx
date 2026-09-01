"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotationIcon, TemperatureIcon } from "@/components/icons/egg-icons";

const Scene = dynamic(() => import("./incubator-scene"), { ssr: false });

function FallbackIllustration({ angle, occupied }: { angle: number; occupied: number }) {
  return (
    <div className="incubator-fallback" role="img" aria-label={`Disco giratorio de la incubadora con ${occupied} de 3 espacios ocupados`}>
      <div className="fallback-disc-stage">
        <motion.div className="fallback-disc" animate={{ rotate: angle }} transition={{ type: "spring", stiffness: 48, damping: 18, mass: 0.8 }}>
          {Array.from({ length: 3 }, (_, index) => <span key={index} className={`fallback-hole slot-${index} ${index < occupied ? "occupied" : ""}`}><i /></span>)}
          <span className="fallback-axis"><i /></span>
        </motion.div>
        <span className="fallback-servo-base" />
      </div>
    </div>
  );
}

export function IncubatorSignature({ angle, temperature, occupied, capacity, isAlarm }: { angle: number; temperature: number; occupied: number; capacity: number; isAlarm: boolean }) {
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
        <h2>Todo está en su punto de <em>calor.</em></h2>
        <p>La cámara mantiene las condiciones ideales para los lotes activos. Los cambios se actualizan suavemente en tiempo real.</p>
        <div className="hero-readings">
          <div><TemperatureIcon size={32} /><span><strong>{temperature.toFixed(1)} °C</strong><small>temperatura actual</small></span></div>
          <div><RotationIcon size={32} /><span><strong>{Math.round(angle)}°</strong><small>posición del disco</small></span></div>
        </div>
      </div>
      <div className="scene-wrap" aria-label="Modelo de incubadora sincronizado con la telemetría">
        {compact || reduceMotion ? <FallbackIllustration angle={angle} occupied={occupied} /> : <Scene angle={angle} temperature={temperature} occupied={occupied} />}
        <div className="scene-note"><span className="scene-note-line" /><span><small>{occupied} de {capacity} espacios</small><strong>Disco giratorio</strong></span></div>
      </div>
    </motion.section>
  );
}
