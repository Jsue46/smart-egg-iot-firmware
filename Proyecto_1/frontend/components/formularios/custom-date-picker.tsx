"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function fromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDays(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === "left" ? "m12.5 4.5-5 5.5 5 5.5" : "m7.5 4.5 5 5.5-5 5.5"} />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" />
      <path d="M8 13h.1m3.9 0h.1m3.9 0h.1M8 16.5h.1m3.9 0h.1" />
    </svg>
  );
}

export function CustomDatePicker({
  value,
  onChange,
  invalid,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  max: string;
}) {
  const selected = value ? fromIso(value) : fromIso(max);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => monthDays(view), [view]);
  const maxDate = fromIso(max);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.querySelector(".calendar-popover")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const canAdvance = new Date(view.getFullYear(), view.getMonth() + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        id="entryDate"
        className="date-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarIcon />
        <span>{value ? new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "long", year: "numeric" }).format(selected) : "Seleccionar fecha"}</span>
      </button>
      {open && (
        <div className="calendar-popover" role="dialog" aria-label="Seleccionar fecha de ingreso">
          <div className="calendar-head">
            <button type="button" aria-label="Mes anterior" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ArrowIcon direction="left" /></button>
            <strong>{new Intl.DateTimeFormat("es-GT", { month: "long", year: "numeric" }).format(view)}</strong>
            <button type="button" aria-label="Mes siguiente" disabled={!canAdvance} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ArrowIcon direction="right" /></button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {days.map((date) => {
              const iso = toIso(date);
              const outside = date.getMonth() !== view.getMonth();
              const disabled = date > maxDate;
              return (
                <button
                  type="button"
                  key={iso}
                  className={`${outside ? "outside" : ""} ${iso === value ? "selected" : ""}`}
                  disabled={disabled}
                  aria-label={new Intl.DateTimeFormat("es-GT", { dateStyle: "long" }).format(date)}
                  aria-pressed={iso === value}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <button className="calendar-today" type="button" onClick={() => { onChange(max); setView(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)); setOpen(false); }}>Usar hoy</button>
        </div>
      )}
    </div>
  );
}
