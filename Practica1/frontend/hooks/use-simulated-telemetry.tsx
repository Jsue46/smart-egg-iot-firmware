"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authenticatedTechnician, initialAlarms, initialLots } from "@/lib/mock-data";
import type { Alarm, Lot, TelemetryPoint, TelemetryState } from "@/lib/types";

interface TelemetryContextValue extends TelemetryState {
  addLot: (lot: Omit<Lot, "id" | "status" | "progress">) => Lot;
  togglePaused: () => void;
  triggerDemoAlarm: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const CAPACITY = 3;

function normalizeLots(lots: Lot[]) {
  let remaining = CAPACITY;
  return lots.map((lot) => {
    const quantity = clamp(Math.round(lot.quantity || 1), 1, CAPACITY);
    if (lot.status === "completo") return { ...lot, quantity };
    if (remaining === 0) return { ...lot, quantity, status: "completo" as const, progress: 100 };
    const allocated = Math.min(quantity, remaining);
    remaining -= allocated;
    return { ...lot, quantity: allocated };
  });
}

const initialHistory = Array.from({ length: 20 }, (_, index): TelemetryPoint => ({
  at: Date.now() - (19 - index) * 2_000,
  temperature: 37.35 + Math.sin(index / 3.4) * 0.12,
  humidity: 57.5 + Math.cos(index / 4.2) * 1.1,
}));

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [temperature, setTemperature] = useState(37.4);
  const [humidity, setHumidity] = useState(58.2);
  const [servoAngle, setServoAngle] = useState(-18);
  const [history, setHistory] = useState<TelemetryPoint[]>(initialHistory);
  const [lots, setLots] = useState<Lot[]>(initialLots);
  const [alarms, setAlarms] = useState<Alarm[]>(initialAlarms);
  const [isPaused, setIsPaused] = useState(false);
  const [demoAlarmUntil, setDemoAlarmUntil] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("smartegg-lots");
    if (saved) {
      try {
        const normalized = normalizeLots(JSON.parse(saved) as Lot[]);
        setLots(normalized);
        window.localStorage.setItem("smartegg-lots", JSON.stringify(normalized));
      } catch {
        window.localStorage.removeItem("smartegg-lots");
      }
    }
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      const now = Date.now();
      const forcedAlarm = now < demoAlarmUntil;
      setTemperature((current) => {
        const centerPull = (37.4 - current) * 0.08;
        const next = forcedAlarm
          ? clamp(current + 0.15, 36, 38.45)
          : clamp(current + (Math.random() - 0.5) * 0.12 + centerPull, 36.15, 37.92);
        setHistory((points) => [
          ...points.slice(-29),
          { at: now, temperature: next, humidity },
        ]);
        return next;
      });
      setHumidity((current) =>
        clamp(current + (Math.random() - 0.5) * 0.8 + (58 - current) * 0.04, 50.5, 64.5),
      );
      const cycle = ((tickRef.current % 40) / 40) * Math.PI * 2;
      setServoAngle(Math.sin(cycle) * 45);
    }, 1_600);
    return () => window.clearInterval(interval);
  }, [demoAlarmUntil, humidity, isPaused]);

  const addLot = useCallback(
    (input: Omit<Lot, "id" | "status" | "progress">) => {
      const occupied = lots
        .filter((lot) => lot.status !== "completo")
        .reduce((sum, lot) => sum + lot.quantity, 0);
      if (input.quantity > CAPACITY - occupied) {
        throw new Error("No hay suficientes espacios disponibles en el disco.");
      }
      const lot: Lot = {
        ...input,
        id: `LT-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(lots.length + 1).padStart(2, "0")}`,
        status: "incubando",
        progress: 1,
      };
      setLots((current) => {
        const next = [lot, ...current];
        window.localStorage.setItem("smartegg-lots", JSON.stringify(next));
        return next;
      });
      return lot;
    },
    [lots.length],
  );

  const triggerDemoAlarm = useCallback(() => {
    const now = Date.now();
    setDemoAlarmUntil(now + 9_000);
    setAlarms((current) => {
      const demoAlarm: Alarm = {
        id: "AL-DEMO-01",
        timestamp: new Date(now).toISOString(),
        title: "Temperatura fuera del rango",
        detail: "Alerta de demostración: revisa la ventilación de la cámara.",
        severity: "critical",
      };
      return [demoAlarm, ...current.filter((alarm) => alarm.id !== demoAlarm.id)];
    });
  }, []);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      temperature,
      humidity,
      servoAngle,
      occupied: clamp(lots.filter((lot) => lot.status !== "completo").reduce((sum, lot) => sum + lot.quantity, 0), 0, CAPACITY),
      capacity: CAPACITY,
      isOnline: true,
      isAlarm: temperature > 38 || Date.now() < demoAlarmUntil,
      isPaused,
      history,
      lots,
      alarms,
      technician: authenticatedTechnician,
      addLot,
      togglePaused: () => setIsPaused((paused) => !paused),
      triggerDemoAlarm,
    }),
    [addLot, alarms, demoAlarmUntil, history, humidity, isPaused, lots, servoAngle, temperature, triggerDemoAlarm],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useSimulatedTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useSimulatedTelemetry must be used inside TelemetryProvider");
  }
  return context;
}
