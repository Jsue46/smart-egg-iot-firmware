"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authenticatedTechnician } from "@/lib/mock-data";
import type { Alarm, Lot, TelemetryPoint, TelemetryState } from "@/lib/types";

interface TelemetryContextValue extends TelemetryState {
  addLot: (lot: Omit<Lot, "id" | "status" | "progress">) => Lot;
  togglePaused: () => void;
  triggerDemoAlarm: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);
const CAPACITY = 3;

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [servoAngle, setServoAngle] = useState(0);
  const [occupied, setOccupied] = useState(0);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isAlarm, setIsAlarm] = useState(false);

  const fetchData = useCallback(async () => {
    if (isPaused) return;
    try {
      const resDatos = await fetch("http://localhost:5000/datos");
      if (resDatos.ok) {
        const data = await resDatos.json();
        setTemperature(data.temperatura || 0);
        setHumidity(data.humedad || 0);
        // Si data.espacios_libres es 3, entonces hay 0 ocupados. Si es 0 libres, hay 3 ocupados.
        setOccupied(Math.max(0, CAPACITY - (data.espacios_libres || 0)));
        setIsAlarm(data.alarma === 1 || data.alarma === true);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }

      const resHistorial = await fetch("http://localhost:5000/historial");
      if (resHistorial.ok) {
        const histData = await resHistorial.json();
        const mappedHistory = histData.map((d: any) => ({
          at: new Date(d.timestamp).getTime(),
          temperature: d.temperatura,
          humidity: d.humedad,
        })).reverse();
        setHistory(mappedHistory);
      }

      const resHuevos = await fetch("http://localhost:5000/huevos");
      if (resHuevos.ok) {
        const huevosData = await resHuevos.json();
        setLots(huevosData.map((h: any) => ({
          id: `LT-${h.id}`,
          label: h.etiqueta,
          entryDate: h.fecha_ingreso ? h.fecha_ingreso.split(" ")[0] : new Date().toISOString().split(" ")[0],
          quantity: 1, // Por simplicidad, 1 espacio por registro
          requiredTemperature: 37.5,
          status: "incubando",
          progress: 50,
        })));
      }

      const resAlarmas = await fetch("http://localhost:5000/alarmas");
      if (resAlarmas.ok) {
        const alarmasData = await resAlarmas.json();
        setAlarms(alarmasData.map((a: any) => ({
          id: `AL-${a.id}`,
          timestamp: a.timestamp ? a.timestamp.replace(" ", "T") : new Date().toISOString(),
          title: a.tipo,
          detail: a.descripcion,
          severity: "critical",
        })));
      }
    } catch (e) {
      console.log("No backend connection");
      setIsOnline(false);
    }
  }, [isPaused]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setServoAngle(prev => (prev > 0 ? -45 : 45));
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const addLot = useCallback(
    (input: Omit<Lot, "id" | "status" | "progress">) => {
      fetch("http://localhost:5000/huevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lote: "LT-NUEVO",
          etiqueta: input.label,
          tecnico: authenticatedTechnician.name,
          notas: "",
        })
      }).then(() => fetchData());
      
      const newLot: Lot = { ...input, id: "TEMP", status: "incubando", progress: 1 };
      return newLot;
    },
    [fetchData]
  );

  const value = useMemo<TelemetryContextValue>(
    () => ({
      temperature,
      humidity,
      servoAngle,
      occupied,
      capacity: CAPACITY,
      isOnline,
      isAlarm,
      isPaused,
      history,
      lots,
      alarms,
      technician: authenticatedTechnician,
      addLot,
      togglePaused: () => setIsPaused((paused) => !paused),
      triggerDemoAlarm: () => {},
    }),
    [addLot, alarms, history, humidity, isAlarm, isOnline, isPaused, lots, occupied, servoAngle, temperature]
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
