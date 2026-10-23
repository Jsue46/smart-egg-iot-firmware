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
import type { MqttClient } from "mqtt";
import { authenticatedTechnician } from "@/lib/mock-data";
import { ROLE_LABELS } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-provider";
import { API_BASE_URL, MQTT_WS_URL, NODE_ID, getMqttWsUrl } from "@/lib/config";
import type { Alarm, DoorEvent, Lot, TelemetryPoint, TelemetryState } from "@/lib/types";

type ControlChannel = "control/bloqueo" | "control/energia";

interface TelemetryContextValue extends TelemetryState {
  addLot: (lot: Omit<Lot, "id" | "status" | "progress">) => Promise<Lot>;
  refreshLots: () => Promise<void>;
  publishControl: (channel: ControlChannel, payload: Record<string, unknown>) => Promise<void>;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);
const CAPACITY = 3;
const HISTORY_LIMIT = 60;

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "online", "activo", "abierto", "bloqueado"].includes(normalized)) return true;
    if (["false", "0", "off", "offline", "inactivo", "cerrado", "desbloqueado"].includes(normalized)) return false;
  }
  return null;
}

function isoTimestamp(value: unknown): string {
  if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (value) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function timestampMs(value: unknown): number {
  return new Date(isoTimestamp(value)).getTime();
}

function actuatorIsOn(value: unknown): boolean {
  return asBoolean(value) ?? ["ENCENDIDO", "ACTIVO"].includes(String(value ?? "").trim().toUpperCase());
}

function normalizeVisionClass(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["huevo", "egg"].includes(normalized)) return "huevo";
  if (["vacio", "empty", "sin_huevo"].includes(normalized)) return "vacio";
  if (["objeto_extrano", "objeto extrano", "foreign_object", "objeto"].includes(normalized)) return "objeto_extrano";
  return normalized || null;
}

function mapLot(row: Record<string, unknown>): Lot {
  const entryDate = row.fecha_ingreso ? new Date(String(row.fecha_ingreso)) : new Date();
  return {
    id: `LT-${row.id ?? Date.now()}`,
    label: String(row.etiqueta ?? row.label ?? "Lote"),
    entryDate: Number.isNaN(entryDate.getTime()) ? new Date().toISOString().slice(0, 10) : entryDate.toISOString().slice(0, 10),
    quantity: asNumber(row.cantidad ?? row.quantity) ?? 1,
    requiredTemperature: asNumber(row.temperatura_requerida ?? row.requiredTemperature) ?? 37.5,
    status: row.status === "completo" ? "completo" : "incubando",
    progress: asNumber(row.progress) ?? 1,
  };
}

function mqttAlarm(payload: Record<string, unknown>): Alarm {
  const title = String(payload.tipo ?? payload.title ?? "SISTEMA");
  const timestamp = isoTimestamp(payload.timestamp ?? payload.inicio_at);
  const severityValue = String(payload.severidad ?? payload.severity ?? "critical").toLowerCase();
  const severity: Alarm["severity"] = severityValue === "info" || severityValue === "informative" ? "info" : severityValue === "warning" ? "warning" : "critical";
  const active = asBoolean(payload.activa ?? payload.active) ?? true;
  return {
    id: String(payload.id ?? `${title}-${timestamp}`),
    timestamp,
    title,
    detail: String(payload.mensaje ?? payload.descripcion ?? payload.detail ?? "Alarma reportada por el nodo"),
    severity,
    active,
  };
}

function mqttDoorEvent(payload: Record<string, unknown>): DoorEvent | null {
  const action = String(payload.accion ?? payload.action ?? "").trim().toUpperCase();
  if (action !== "ABRIR" && action !== "CERRAR") return null;
  const timestamp = isoTimestamp(payload.timestamp);
  const operatorId = asNumber(payload.operador_id ?? payload.operatorId);
  return {
    id: String(payload.id ?? `${action}-${timestamp}`),
    operador: typeof payload.operador === "string" ? payload.operador : operatorId === null ? null : `Operador ${operatorId}`,
    operador_id: operatorId,
    accion: action,
    cantidad_huevos: asNumber(payload.cantidad_huevos ?? payload.eggCount),
    timestamp,
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
  const [doorEvents, setDoorEvents] = useState<DoorEvent[]>([]);
  const [isMqttConnected, setIsMqttConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [visionClass, setVisionClass] = useState<string | null>(null);
  const [visionConfidence, setVisionConfidence] = useState<number | null>(null);
  const [isVisionLocked, setIsVisionLocked] = useState(false);
  const [powerWatts, setPowerWatts] = useState<number | null>(null);
  const [energyKwh, setEnergyKwh] = useState<number | null>(null);
  const [energyLimitWatts, setEnergyLimitWatts] = useState(80);
  const [energyAlert, setEnergyAlert] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSecondsRemaining, setTimerSecondsRemaining] = useState(0);
  const mqttClient = useRef<MqttClient | null>(null);
  const latestReadings = useRef({ temperature: 0, humidity: 0 });
  const energyLimitRef = useRef(80);
  const { user } = useAuth();

  const refreshLots = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/huevos`, { cache: "no-store" });
      if (!response.ok) return;
      const rows = await response.json();
      if (Array.isArray(rows)) setLots(rows.map((row: Record<string, unknown>) => mapLot(row)));
    } catch {
      // Los registros de lotes quedan disponibles cuando responde el servicio administrativo.
    }
  }, []);

  useEffect(() => {
    void refreshLots();
  }, [refreshLots]);

  const appendHistory = useCallback((kind: "temperature" | "humidity", value: number, at: number) => {
    latestReadings.current[kind] = value;
    if (kind === "temperature") setTemperature(value);
    else setHumidity(value);

    setHistory((current) => {
      const last = current[current.length - 1];
      if (last && Math.abs(last.at - at) <= 1_500) {
        const next = [...current];
        next[next.length - 1] = { ...last, at: Math.max(last.at, at), ...latestReadings.current };
        return next;
      }
      return [...current, { at, ...latestReadings.current }].slice(-HISTORY_LIMIT);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let client: MqttClient | null = null;

    const connect = async () => {
      try {
        const mqtt = await import("mqtt");
        if (disposed) return;
        const wsUrl = getMqttWsUrl();
        const connectFn =
          mqtt.connect ??
          (mqtt as unknown as { default?: { connect?: typeof mqtt.connect } }).default?.connect ??
          (mqtt as unknown as { default?: typeof mqtt.connect }).default;

        if (typeof connectFn !== "function") {
          console.error("[useTelemetry] Could not find connect function in mqtt import:", mqtt);
          return;
        }

        client = connectFn(wsUrl, {
          clientId: `smartegg-dashboard-${Math.random().toString(16).slice(2)}`,
          clean: true,
          reconnectPeriod: 2_000,
          connectTimeout: 5_000,
        });
        mqttClient.current = client;

        client.on("connect", () => {
          setIsMqttConnected(true);
          client?.subscribe(
            [
              `smartegg/${NODE_ID}/status`,
              `smartegg/${NODE_ID}/sensores/temperatura`,
              `smartegg/${NODE_ID}/sensores/humedad`,
              `smartegg/${NODE_ID}/actuadores/estado`,
              `smartegg/${NODE_ID}/alarmas/critica`,
              `smartegg/${NODE_ID}/puerta/evento`,
              `smartegg/${NODE_ID}/vision/estado`,
              `smartegg/${NODE_ID}/control/bloqueo`,
              `smartegg/${NODE_ID}/energia/consumo`,
            ],
            { qos: 0 },
          );
        });
        client.on("close", () => {
          setIsMqttConnected(false);
          setIsOnline(false);
        });
        client.on("offline", () => {
          setIsMqttConnected(false);
          setIsOnline(false);
        });
        client.on("error", (err) => {
          console.warn("[useTelemetry] MQTT error:", err);
          setIsMqttConnected(false);
          setIsOnline(false);
        });
        client.on("message", (topic, message) => {
          try {
            const payload = JSON.parse(message.toString()) as Record<string, unknown>;
            const at = timestampMs(payload.timestamp);

            if (topic.endsWith("/status")) {
              const online = asBoolean(payload.estado ?? payload.online ?? payload.valor);
              if (online !== null) setIsOnline(online);
              updateOccupied(payload);
            } else if (topic.endsWith("/sensores/temperatura")) {
              setIsOnline(true);
              const value = asNumber(payload.valor ?? payload.temperatura);
              if (value !== null) appendHistory("temperature", value, at);
            } else if (topic.endsWith("/sensores/humedad")) {
              setIsOnline(true);
              const value = asNumber(payload.valor ?? payload.humedad);
              if (value !== null) appendHistory("humidity", value, at);
            } else if (topic.endsWith("/actuadores/estado")) {
              setIsOnline(true);
              const angle = asNumber(payload.rotacion_grados ?? payload.servo_ang);
              if (angle !== null) setServoAngle(angle);
              if ("foco" in payload) setHeaterOn(actuatorIsOn(payload.foco));
              if ("ventilador" in payload || "fan" in payload) setFanOn(actuatorIsOn(payload.ventilador ?? payload.fan));
              if ("puerta" in payload || "door" in payload) setDoorOpen(actuatorIsOn(payload.puerta ?? payload.door));
              updateOccupied(payload);
            } else if (topic.endsWith("/alarmas/critica")) {
              const alarm = mqttAlarm(payload);
              setAlarms((current) => {
                if (alarm.active) return [alarm, ...current.filter((item) => item.id !== alarm.id)].slice(0, 50);

                let resolvedExisting = false;
                const updated = current.map((item) => {
                  if (item.title === alarm.title && item.active) {
                    resolvedExisting = true;
                    return { ...item, timestamp: alarm.timestamp, detail: alarm.detail, active: false };
                  }
                  return item.id === alarm.id ? alarm : item;
                });
                return resolvedExisting ? updated : [alarm, ...updated.filter((item) => item.id !== alarm.id)].slice(0, 50);
              });
            } else if (topic.endsWith("/puerta/evento")) {
              const event = mqttDoorEvent(payload);
              if (event) {
                setDoorOpen(event.accion === "ABRIR");
                setDoorEvents((current) => [event, ...current.filter((item) => item.id !== event.id)].slice(0, 200));
              }
            } else if (topic.endsWith("/vision/estado")) {
              setVisionClass(normalizeVisionClass(payload.clase ?? payload.objeto));
              const confidence = asNumber(payload.confianza);
              setVisionConfidence(confidence === null ? null : Math.min(100, Math.max(0, confidence <= 1 ? confidence * 100 : confidence)));
              const locked = asBoolean(payload.bloqueado);
              if (locked !== null) setIsVisionLocked(locked);
            } else if (topic.endsWith("/control/bloqueo")) {
              const locked = asBoolean(payload.bloquear ?? payload.bloqueado);
              // A false value may be this client's own unlock command. Wait for
              // the detector's vision/estado confirmation before clearing the lock.
              if (locked === true) setIsVisionLocked(true);
            } else if (topic.endsWith("/energia/consumo")) {
              const watts = asNumber(payload.watts ?? payload.potencia_watts ?? payload.potencia);
              const kwh = asNumber(payload.kwh ?? payload.consumo_kwh);
              const limit = asNumber(payload.limite_watts);
              if (watts !== null) setPowerWatts(watts);
              if (kwh !== null) setEnergyKwh(kwh);
              if (limit !== null) {
                energyLimitRef.current = limit;
                setEnergyLimitWatts(limit);
              }
              setEnergyAlert(asBoolean(payload.alerta_consumo) ?? (watts !== null && watts > (limit ?? energyLimitRef.current)));
              const active = asBoolean(payload.temporizador_activo);
              if (active !== null) setTimerActive(active);
              const remaining = asNumber(payload.segundos_restantes);
              if (remaining !== null) setTimerSecondsRemaining(Math.max(0, remaining));
            }
          } catch {
            // Se ignoran mensajes que no correspondan al JSON de los tópicos de la aplicación.
          }
        });
      } catch (err) {
        console.error("[useTelemetry] Connection failed:", err);
        if (!disposed) {
          setIsMqttConnected(false);
          setIsOnline(false);
        }
      }
    };

    const updateOccupied = (payload: Record<string, unknown>) => {
      const count = asNumber(payload.espacios_ocupados ?? payload.occupied);
      const free = asNumber(payload.espacios_libres ?? payload.free_slots);
      if (count !== null) setOccupied(Math.max(0, Math.min(CAPACITY, count)));
      else if (free !== null) setOccupied(Math.max(0, Math.min(CAPACITY, CAPACITY - free)));
    };

    void connect();
    return () => {
      disposed = true;
      setIsMqttConnected(false);
      setIsOnline(false);
      if (mqttClient.current === client) mqttClient.current = null;
      if (client) client.end(true);
    };
  }, [appendHistory]);

  const publishControl = useCallback((channel: ControlChannel, payload: Record<string, unknown>) => {
    return new Promise<void>((resolve, reject) => {
      const client = mqttClient.current;
      if (!client?.connected) {
        reject(new Error("No hay conexión MQTT con el nodo."));
        return;
      }

      const retain = channel === "control/bloqueo";
      client.publish(
        `smartegg/${NODE_ID}/${channel}`,
        JSON.stringify(payload),
        { qos: 1, retain },
        (error) => error ? reject(error) : resolve(),
      );
    });
  }, []);

  const addLot = useCallback(async (input: Omit<Lot, "id" | "status" | "progress">): Promise<Lot> => {
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
    if (!response.ok) throw new Error(result.error ?? "No fue posible registrar el lote");
    const lot: Lot = { ...input, id: `LT-${result.id ?? Date.now()}`, status: "incubando", progress: 1 };
    setLots((current) => [lot, ...current]);
    return lot;
  }, [user]);

  const isAlarm = isVisionLocked || alarms.some((alarm) => alarm.active === true);
  const technician = user
    ? { name: user.name, id: user.badge, role: ROLE_LABELS[user.role] }
    : authenticatedTechnician;

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
      isMqttConnected,
      isAlarm,
      history,
      lots,
      alarms,
      doorEvents,
      technician,
      visionClass,
      visionConfidence,
      isVisionLocked,
      powerWatts,
      energyKwh,
      energyLimitWatts,
      energyAlert,
      timerActive,
      timerSecondsRemaining,
      addLot,
      refreshLots,
      publishControl,
    }),
    [addLot, alarms, doorEvents, doorOpen, energyAlert, energyKwh, energyLimitWatts, fanOn, heaterOn, history, humidity, isAlarm, isMqttConnected, isOnline, isVisionLocked, lots, occupied, powerWatts, publishControl, refreshLots, servoAngle, technician, temperature, timerActive, timerSecondsRemaining, visionClass, visionConfidence],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error("useTelemetry must be used inside TelemetryProvider");
  return context;
}
