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
import type { MqttClient } from "mqtt";
import { authenticatedTechnician } from "@/lib/mock-data";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-provider";
import { API_BASE_URL, MQTT_WS_URL, NODE_ID } from "@/lib/config";
import type { Alarm, Lot, TelemetryPoint, TelemetryState } from "@/lib/types";

interface TelemetryContextValue extends TelemetryState {
  addLot: (lot: Omit<Lot, "id" | "status" | "progress">) => Promise<Lot>;
  togglePaused: () => void;
  triggerDemoAlarm: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);
const CAPACITY = 3;

function toDateOnly(value: unknown): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function actuatorIsOn(value: unknown): boolean {
  return ["ON", "1", "TRUE", "ENCENDIDO", "ACTIVO"].includes(String(value ?? "").trim().toUpperCase());
}

function doorIsOpen(value: unknown): boolean {
  return ["ABRIR", "ABIERTO", "OPEN", "OPENED", "1", "TRUE"].includes(String(value ?? "").trim().toUpperCase());
}

function mqttAlarm(payload: any): Alarm {
  const severity = payload.severidad === "warning" || payload.severity === "warning" ? "warning" : "critical";
  return {
    id: `AL-${payload.id ?? `${payload.tipo ?? "sistema"}-${payload.timestamp ?? Date.now()}`}`,
    timestamp: toIso(payload.timestamp ?? payload.inicio_at),
    title: payload.tipo ?? "SISTEMA",
    detail: payload.mensaje ?? payload.descripcion ?? "Alarma reportada por el nodo",
    severity,
    active: payload.activa === true || payload.activa === 1 || payload.active === true,
  };
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [temperature, setTemperature] = useState(0);
  const [humidity, setHumidity] = useState(0);
  const [heaterOn, setHeaterOn] = useState(false);
  const [fanOn, setFanOn] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [servoAngle, setServoAngle] = useState(0);
  const [occupied, setOccupied] = useState(0);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isAlarm, setIsAlarm] = useState(false);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    if (isPaused) return;
    try {
      const resDatos = await fetch(`${API_BASE_URL}/datos`, { cache: "no-store" });
      if (resDatos.ok) {
        const data = await resDatos.json();
        setTemperature(Number(data.temperatura) || 0);
        setHumidity(Number(data.humedad) || 0);
        setHeaterOn(actuatorIsOn(data.foco));
        setFanOn(actuatorIsOn(data.ventilador ?? data.fan));
        if ("puerta" in data || "door" in data) setDoorOpen(doorIsOpen(data.puerta ?? data.door));
        const restRotation = Number(data.rotacion_grados ?? data.servo_ang);
        if (Number.isFinite(restRotation)) setServoAngle(restRotation);
        setOccupied(Math.max(0, CAPACITY - (Number(data.espacios_libres) || 0)));
        setIsAlarm(data.alarma === 1 || data.alarma === true);
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }

      const resHistorial = await fetch(`${API_BASE_URL}/historial?limit=100`, { cache: "no-store" });
      if (resHistorial.ok) {
        const histData = await resHistorial.json();
        const mappedHistory = histData
          .map((d: any) => ({
            at: new Date(d.timestamp).getTime(),
            temperature: Number(d.temperatura) || 0,
            humidity: Number(d.humedad) || 0,
          }))
          .filter((point: TelemetryPoint) => Number.isFinite(point.at))
          .reverse();
        setHistory(mappedHistory);
      }

      const resHuevos = await fetch(`${API_BASE_URL}/huevos`, { cache: "no-store" });
      if (resHuevos.ok) {
        const huevosData = await resHuevos.json();
        setLots(
          huevosData.map((h: any) => ({
            id: `LT-${h.id}`,
            label: h.etiqueta,
            entryDate: toDateOnly(h.fecha_ingreso),
            quantity: Number(h.cantidad ?? h.quantity) || 1,
            requiredTemperature: Number(h.temperatura_requerida ?? h.requiredTemperature) || 37.5,
            status: h.status === "completo" ? "completo" : "incubando",
            progress: Number(h.progress) || 50,
          })),
        );
      }

      const resAlarmas = await fetch(`${API_BASE_URL}/alarmas`, { cache: "no-store" });
      if (resAlarmas.ok) {
        const alarmasData = await resAlarmas.json();
        setAlarms(alarmasData.map((alarm: any) => mqttAlarm({ ...alarm, id: alarm.id })));
        setIsAlarm(
          alarmasData.some((alarm: any) => alarm.activa === true || alarm.activa === 1),
        );
      }

      const resPuerta = await fetch(`${API_BASE_URL}/accesos-puerta?limit=1`, { cache: "no-store" });
      if (resPuerta.ok) {
        const puertaData = await resPuerta.json();
        const lastDoorEvent = puertaData?.[0];
        if (lastDoorEvent?.accion) setDoorOpen(doorIsOpen(lastDoorEvent.accion));
      }
    } catch {
      setIsOnline(false);
    }
  }, [isPaused]);

  useEffect(() => {
    fetchData();
    const interval = window.setInterval(fetchData, 2000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    let disposed = false;
    let client: MqttClient | null = null;

    const connectMqtt = async () => {
      try {
        const mqtt = await import("mqtt");
        if (disposed) return;
        client = mqtt.connect(MQTT_WS_URL, {
          clientId: `smartegg-web-${Math.random().toString(16).slice(2)}`,
          clean: true,
          reconnectPeriod: 2000,
          connectTimeout: 5000,
        });

        client.on("connect", () => {
          setIsOnline(true);
          client?.subscribe(
            [
              `smartegg/${NODE_ID}/status`,
              `smartegg/${NODE_ID}/actuadores/estado`,
              `smartegg/${NODE_ID}/alarmas/critica`,
              `smartegg/${NODE_ID}/puerta/evento`,
            ],
            { qos: 1 },
          );
        });
        client.on("message", (topic, message) => {
          try {
            const payload = JSON.parse(message.toString());
            if (topic.endsWith("/status")) {
              setIsOnline(payload.estado === "online");
            } else if (topic.endsWith("/actuadores/estado")) {
              const mqttRotation = Number(payload.rotacion_grados ?? payload.servo_ang);
              if (Number.isFinite(mqttRotation)) setServoAngle(mqttRotation);
              if ("foco" in payload) setHeaterOn(actuatorIsOn(payload.foco));
              if ("ventilador" in payload || "fan" in payload) setFanOn(actuatorIsOn(payload.ventilador ?? payload.fan));
            } else if (topic.endsWith("/alarmas/critica")) {
              const alarm = mqttAlarm(payload);
              setIsAlarm(payload.activa === true || payload.activa === 1);
              setAlarms((current) => {
                const withoutCurrent = current.filter((item) => item.id !== alarm.id);
                return [alarm, ...withoutCurrent].slice(0, 50);
              });
            } else if (topic.endsWith("/puerta/evento")) {
              setDoorOpen(doorIsOpen(payload.accion ?? payload.action));
            }
          } catch {
            // Ignore non-JSON broker messages on the application topics.
          }
        });
      } catch {
        // The REST API remains usable when the optional WebSocket broker is down.
      }
    };

    connectMqtt();
    return () => {
      disposed = true;
      if (client) client.end(true);
    };
  }, []);

  const addLot = useCallback(
    async (input: Omit<Lot, "id" | "status" | "progress">): Promise<Lot> => {
      const response = await fetch(`${API_BASE_URL}/huevo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lote: `LT-${Date.now()}`,
          etiqueta: input.label,
          tecnico: user?.name ?? authenticatedTechnician.name,
          entryDate: input.entryDate,
          quantity: input.quantity,
          requiredTemperature: input.requiredTemperature,
          notas: "",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "No fue posible registrar el lote");
      }
      await fetchData();
      return { ...input, id: `LT-${result.id ?? Date.now()}`, status: "incubando", progress: 1 };
    },
    [fetchData, user],
  );

  const triggerDemoAlarm = useCallback(() => {
    const alarm: Alarm = {
      id: `DEMO-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: "TEMPERATURA",
      detail: "Alerta local de demostración; no se publicó en el broker.",
      severity: "warning",
    };
    setAlarms((current) => [alarm, ...current].slice(0, 50));
    setIsAlarm(true);
    window.setTimeout(() => setIsAlarm(false), 9000);
  }, []);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      temperature,
      humidity,
      heaterOn,
      fanOn,
      doorOpen,
      servoAngle,
      occupied,
      capacity: CAPACITY,
      isOnline,
      isAlarm,
      isPaused,
      history,
      lots,
      alarms,
      technician:
        user ? { name: user.name, id: user.badge, role: ROLE_LABELS[user.role] } : authenticatedTechnician,
      addLot,
      togglePaused: () => setIsPaused((paused) => !paused),
      triggerDemoAlarm,
    }),
    [addLot, alarms, doorOpen, fanOn, heaterOn, history, humidity, isAlarm, isOnline, isPaused, lots, occupied, servoAngle, temperature, triggerDemoAlarm, user],
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
