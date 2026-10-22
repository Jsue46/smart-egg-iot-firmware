"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";

interface SensorCardProps {
  label: string;
  value: number;
  suffix: string;
  decimals?: number;
  detail: string;
  icon: ReactNode;
  accent?: "yolk" | "sprout" | "aqua" | "violet" | "alert";
  state?: string;
  className?: string;
}

function AnimatedReading({ value, decimals }: { value: number; decimals: number }) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 90, damping: 22, mass: 0.5 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    spring.set(value);
    if (reduceMotion) setDisplay(value);
  }, [reduceMotion, spring, value]);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(latest));
  return <>{display.toFixed(decimals)}</>;
}

export function SensorCard({ label, value, suffix, decimals = 0, detail, icon, accent = "sprout", state = "Óptimo", className = "" }: SensorCardProps) {
  return (
    <motion.article className={`sensor-card ${accent} ${className}`} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
      <div className="sensor-head"><span className="sensor-icon">{icon}</span><span className={`sensor-state ${accent}`}>{state}</span></div>
      <p>{label}</p>
      <div className="sensor-reading"><span><AnimatedReading value={value} decimals={decimals} /></span><small>{suffix}</small></div>
      <div className="sensor-foot"><span>{detail}</span></div>
    </motion.article>
  );
}
