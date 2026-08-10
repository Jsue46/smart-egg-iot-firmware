"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";

interface SensorCardProps {
  label: string;
  value: number;
  suffix: string;
  decimals?: number;
  detail: string;
  icon: ReactNode;
  trend: number[];
  accent?: "yolk" | "sprout" | "alert";
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

function Sparkline({ values, accent }: { values: number[]; accent: SensorCardProps["accent"] }) {
  const path = useMemo(() => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 150;
      const y = 34 - ((value - min) / span) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [values]);
  return (
    <svg className="sparkline" viewBox="0 0 150 40" role="img" aria-label="Tendencia reciente del sensor">
      <path className="sparkline-baseline" d="M0 34H150" />
      <motion.path
        className={`sparkline-path ${accent ?? "sprout"}`}
        d={path}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      />
    </svg>
  );
}

export function SensorCard({ label, value, suffix, decimals = 0, detail, icon, trend, accent = "sprout" }: SensorCardProps) {
  return (
    <motion.article className={`sensor-card ${accent}`} variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}>
      <div className="sensor-head"><span className="sensor-icon">{icon}</span><span className={`sensor-state ${accent}`}>{accent === "alert" ? "Revisar" : "Óptimo"}</span></div>
      <p>{label}</p>
      <div className="sensor-reading"><span><AnimatedReading value={value} decimals={decimals} /></span><small>{suffix}</small></div>
      <div className="sensor-foot"><span>{detail}</span><Sparkline values={trend} accent={accent} /></div>
    </motion.article>
  );
}
