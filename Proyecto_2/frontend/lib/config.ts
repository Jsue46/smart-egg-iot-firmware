export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
      return `http://${host}:5000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
}

export function getMqttWsUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!process.env.NEXT_PUBLIC_MQTT_WS_URL || process.env.NEXT_PUBLIC_MQTT_WS_URL.includes("localhost")) {
      return `ws://${host}:9001`;
    }
  }
  return process.env.NEXT_PUBLIC_MQTT_WS_URL ?? "ws://localhost:9001";
}

export const API_BASE_URL = getApiBaseUrl();
export const MQTT_WS_URL = getMqttWsUrl();
export const NODE_ID = process.env.NEXT_PUBLIC_NODE_ID ?? "SE-01";
