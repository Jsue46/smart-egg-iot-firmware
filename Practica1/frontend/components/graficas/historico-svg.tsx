"use client";

import { useMemo, useState, type CSSProperties } from "react";
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maxPath = useMemo(() => linePath(weeklyHistory.map((item) => item.max), 36, 38.5), []);
  const minPath = useMemo(() => linePath(weeklyHistory.map((item) => item.min), 36, 38.5), []);
  const activeItem = activeIndex === null ? null : weeklyHistory[activeIndex];
  const activeX = activeIndex === null ? 0 : padding.left + (activeIndex / (weeklyHistory.length - 1)) * (W - padding.left - padding.right);
  return (
    <div className="history-chart-wrap">
      <div className="chart-legend" aria-label="Leyenda de la gráfica">
        <span><i className="legend-line max" /><span><strong>Máxima diaria</strong><small>Pico térmico más alto</small></span></span>
        <span><i className="legend-line min" /><span><strong>Mínima diaria</strong><small>Lectura más baja</small></span></span>
      </div>
      <div className="chart-canvas">
      <svg className="history-chart" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Histórico semanal. Línea naranja: temperatura máxima diaria. Línea verde: temperatura mínima diaria.">
        {[36, 36.5, 37, 37.5, 38, 38.5].map((tick) => {
          const y = padding.top + ((38.5 - tick) / 2.5) * (H - padding.top - padding.bottom);
          return <g key={tick}><line x1={padding.left} x2={W - padding.right} y1={y} y2={y} className="grid-line" /><text x={padding.left - 10} y={y + 4} textAnchor="end">{tick.toFixed(1)}°</text></g>;
        })}
        <rect x={padding.left} y={padding.top + ((38.0 - 38) / 2.5) * (H - padding.top - padding.bottom)} width={W - padding.left - padding.right} height={((38 - 36.8) / 2.5) * (H - padding.top - padding.bottom)} className="optimal-band" />
        {activeIndex !== null && <line x1={activeX} x2={activeX} y1={padding.top} y2={H - padding.bottom} className="chart-active-guide" aria-hidden="true" />}
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
          return [<circle key={`max-${item.day}`} cx={x} cy={maxY} r={activeIndex === index ? 6 : 4} className={`history-point max${activeIndex === index ? " active" : ""}`} />, <circle key={`min-${item.day}`} cx={x} cy={minY} r={activeIndex === index ? 6 : 4} className={`history-point min${activeIndex === index ? " active" : ""}`} />];
        })}
        {weeklyHistory.map((item, index) => {
          const x = padding.left + (index / (weeklyHistory.length - 1)) * (W - padding.left - padding.right);
          const step = (W - padding.left - padding.right) / (weeklyHistory.length - 1);
          const left = index === 0 ? padding.left - step / 2 : x - step / 2;
          const right = index === weeklyHistory.length - 1 ? W - padding.right + step / 2 : x + step / 2;
          return <rect key={`hit-${item.day}`} className="chart-hit-area" x={Math.max(0, left)} y={padding.top} width={Math.min(W, right) - Math.max(0, left)} height={H - padding.top - padding.bottom} tabIndex={0} role="button" aria-label={`${item.day}: máxima ${item.max.toFixed(1)} grados, mínima ${item.min.toFixed(1)} grados`} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)} onClick={() => setActiveIndex(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveIndex(index); } }} />;
        })}
      </svg>
      {activeItem && (
        <motion.div className="chart-tooltip" role="status" initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} style={{ "--tooltip-x": `${(activeX / W) * 100}%` } as CSSProperties}>
          <strong>{activeItem.day}</strong>
          <span><i className="tooltip-dot max" />Máxima <b>{activeItem.max.toFixed(1)} °C</b></span>
          <span><i className="tooltip-dot min" />Mínima <b>{activeItem.min.toFixed(1)} °C</b></span>
          <small>Amplitud del día: {(activeItem.max - activeItem.min).toFixed(1)} °C</small>
        </motion.div>
      )}
      </div>
      <table className="sr-only">
        <caption>Temperatura máxima y mínima por día durante los últimos siete días</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Máxima</th><th scope="col">Mínima</th></tr></thead>
        <tbody>{weeklyHistory.map((item) => <tr key={`data-${item.day}`}><th scope="row">{item.day}</th><td>{item.max.toFixed(1)} °C</td><td>{item.min.toFixed(1)} °C</td></tr>)}</tbody>
      </table>
    </div>
  );
}
