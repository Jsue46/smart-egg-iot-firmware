"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { weeklyHistory } from "@/lib/mock-data";

const W = 720;
const H = 280;
const padding = { left: 48, right: 22, top: 24, bottom: 42 };

function linePath(values: number[], min: number, max: number) {
  return values.map((value, index) => {
    const x = padding.left + (index / (values.length - 1)) * (W - padding.left - padding.right);
    const y = padding.top + ((max - value) / (max - min)) * (H - padding.top - padding.bottom);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function HistoricoSVG() {
  const reduceMotion = useReducedMotion();
  const maxPath = useMemo(() => linePath(weeklyHistory.map((item) => item.max), 36, 38.5), []);
  const minPath = useMemo(() => linePath(weeklyHistory.map((item) => item.min), 36, 38.5), []);
  return (
    <div className="history-chart-wrap">
      <div className="chart-legend"><span><i className="legend-line max" />Máxima diaria</span><span><i className="legend-line min" />Mínima diaria</span></div>
      <svg className="history-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">Temperatura máxima y mínima de los últimos siete días</title>
        <desc id="chart-desc">Ambas series permanecen entre 36.7 y 37.9 grados Celsius.</desc>
        {[36, 36.5, 37, 37.5, 38, 38.5].map((tick) => {
          const y = padding.top + ((38.5 - tick) / 2.5) * (H - padding.top - padding.bottom);
          return <g key={tick}><line x1={padding.left} x2={W - padding.right} y1={y} y2={y} className="grid-line" /><text x={padding.left - 10} y={y + 4} textAnchor="end">{tick.toFixed(1)}°</text></g>;
        })}
        <rect x={padding.left} y={padding.top + ((38.0 - 38) / 2.5) * (H - padding.top - padding.bottom)} width={W - padding.left - padding.right} height={((38 - 36.8) / 2.5) * (H - padding.top - padding.bottom)} className="optimal-band" />
        {weeklyHistory.map((item, index) => {
          const x = padding.left + (index / (weeklyHistory.length - 1)) * (W - padding.left - padding.right);
          return <text key={item.day} x={x} y={H - 12} textAnchor="middle" className="day-label">{item.day}</text>;
        })}
        <motion.path d={maxPath} className="history-path max" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.9, ease: "easeOut" }} />
        <motion.path d={minPath} className="history-path min" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.12, ease: "easeOut" }} />
        {weeklyHistory.flatMap((item, index) => {
          const x = padding.left + (index / (weeklyHistory.length - 1)) * (W - padding.left - padding.right);
          const maxY = padding.top + ((38.5 - item.max) / 2.5) * (H - padding.top - padding.bottom);
          const minY = padding.top + ((38.5 - item.min) / 2.5) * (H - padding.top - padding.bottom);
          return [<circle key={`max-${item.day}`} cx={x} cy={maxY} r="4" className="history-point max" />, <circle key={`min-${item.day}`} cx={x} cy={minY} r="4" className="history-point min" />];
        })}
      </svg>
    </div>
  );
}
