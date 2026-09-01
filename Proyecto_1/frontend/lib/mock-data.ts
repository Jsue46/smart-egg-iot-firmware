import type { Alarm, Lot, Technician } from "@/lib/types";

export const authenticatedTechnician: Technician = {
  name: "Técnico Grupo 7",
  id: "AYC2-G7-01",
  role: "Responsable de incubación",
};

export const initialLots: Lot[] = [
  {
    id: "LT-2608-01",
    label: "Criollo dorado",
    entryDate: "2026-08-02",
    quantity: 2,
    requiredTemperature: 37.5,
    status: "incubando",
    progress: 38,
  },
  {
    id: "LT-2607-04",
    label: "Plymouth Rock",
    entryDate: "2026-07-24",
    quantity: 1,
    requiredTemperature: 37.4,
    status: "completo",
    progress: 100,
  },
  {
    id: "LT-2607-02",
    label: "Leghorn blanca",
    entryDate: "2026-07-11",
    quantity: 3,
    requiredTemperature: 37.6,
    status: "completo",
    progress: 100,
  },
];

export const initialAlarms: Alarm[] = [
  {
    id: "AL-0841",
    timestamp: "2026-08-09T05:42:00",
    title: "Temperatura fuera del rango",
    detail: "La cámara alcanzó 38.2 °C durante 46 segundos.",
    severity: "critical",
  },
  {
    id: "AL-0839",
    timestamp: "2026-08-08T22:18:00",
    title: "Humedad por debajo del rango",
    detail: "Lectura mínima de 49.4 %. Se estabilizó automáticamente.",
    severity: "warning",
  },
  {
    id: "AL-0832",
    timestamp: "2026-08-07T14:06:00",
    title: "Rotación pospuesta",
    detail: "El ciclo se completó 3 minutos después de lo previsto.",
    severity: "info",
  },
];

export const weeklyHistory = [
  { day: "Lun", min: 36.8, max: 37.7, humidity: 57 },
  { day: "Mar", min: 36.9, max: 37.6, humidity: 58 },
  { day: "Mié", min: 37.0, max: 37.8, humidity: 56 },
  { day: "Jue", min: 36.7, max: 37.5, humidity: 59 },
  { day: "Vie", min: 36.9, max: 37.7, humidity: 60 },
  { day: "Sáb", min: 37.1, max: 37.9, humidity: 58 },
  { day: "Dom", min: 36.8, max: 37.6, humidity: 57 },
];
