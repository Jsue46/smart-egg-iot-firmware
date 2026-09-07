"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { useToast } from "@/components/ui/toast-provider";
import { API_BASE_URL } from "@/lib/config";
import { DoorIcon } from "@/components/icons/egg-icons";
import type { Role } from "@/lib/auth";

interface DoorEvent {
  id: number;
  operador: string | null;
  operador_id: number | null;
  accion: "ABRIR" | "CERRAR";
  cantidad_huevos: number | null;
  timestamp: string;
}

const OPERATOR_BACKEND_NAME: Record<Role, string | null> = {
  administrador: null,
  operador1: "Operador 1",
  operador2: "Operador 2",
};

const timeFormatter = new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" });

function parseEggCount(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) throw new Error("Cantidad debe ser un número entero entre 1 y 50");
  return parsed;
}

export function PuertaContent() {
  const { user } = useAuth();
  const { doorOpen, isOnline, occupied } = useSimulatedTelemetry();
  const { showToast } = useToast();
  const [operatorId, setOperatorId] = useState<number | null>(null);
  const [eggCount, setEggCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [sending, setSending] = useState<"ABRIR" | "CERRAR" | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/accesos-puerta?limit=12`, { cache: "no-store" });
      if (response.ok) {
        const data: DoorEvent[] = await response.json();
        setEvents(data);
      }
    } catch {
      // El historial se vuelve a intentar con la siguiente acción.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!user || user.role === "administrador") return;
    let active = true;
    fetch(`${API_BASE_URL}/operadores`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((operators: Array<{ id: number; nombre: string | null }>) => {
        if (!active) return;
        const expected = OPERATOR_BACKEND_NAME[user.role];
        const match = expected ? operators.find((operator) => operator.nombre === expected) : undefined;
        setOperatorId(match?.id ?? (user.role === "operador1" ? 1 : user.role === "operador2" ? 2 : null));
      })
      .catch(() => {
        if (!active) return;
        setOperatorId(user.role === "operador1" ? 1 : 2);
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || user.role === "administrador") return null;

  const submit = async (action: "ABRIR" | "CERRAR") => {
    setError(null);
    let count: number | null = null;
    try {
      count = action === "ABRIR" ? parseEggCount(eggCount) : null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Cantidad inválida";
      setError(message);
      showToast({ title: "Verifica la cantidad", message, tone: "warning" });
      return;
    }

    setSending(action);
    try {
      const response = await fetch(`${API_BASE_URL}/puerta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: action, operador_id: operatorId, cantidad_huevos: count }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "No fue posible registrar la acción de la puerta");
      showToast({
        title: action === "ABRIR" ? "Puerta abierta" : "Puerta cerrada",
        message: `Acceso registrado por ${user.name}${count ? ` · ${count} ${count === 1 ? "huevo" : "huevos"}` : ""}.`,
        tone: "success",
      });
      setEggCount("");
      await loadHistory();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No fue posible completar la acción";
      setError(message);
      showToast({ title: "No se pudo registrar la puerta", message, tone: "error" });
    } finally {
      setSending(null);
    }
  };

  const canOperate = isOnline;

  return (
    <div className="new-lot-layout">
      <section className="form-panel">
        <div className="form-heading"><span className="form-step">03</span><div><p className="eyebrow">Acceso físico</p><h2>Control de puerta</h2><p>Abre o cierra la incubadora y registra la cantidad de huevos trasladados en esta operación.</p></div></div>

        <div style={{ display: "grid", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 20px",
              borderRadius: 18,
              border: `1px solid ${doorOpen ? "rgba(0,143,150,.4)" : "var(--border-strong)"}`,
              background: doorOpen ? "var(--aqua-soft)" : "#fdfcf9",
            }}
          >
            <DoorIcon size={44} color={doorOpen ? "var(--aqua)" : "var(--muted)"} />
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Estado actual</p>
              <strong style={{ display: "block", fontSize: 18 }}>{doorOpen ? "Puerta abierta" : "Puerta cerrada"}</strong>
              <small style={{ color: "var(--muted)", fontSize: 12 }}>{occupied} de 3 espacios ocupados · actualizado por MQTT</small>
            </div>
            <span
              style={{
                marginLeft: "auto",
                padding: "3px 10px",
                borderRadius: 999,
                color: "#fff",
                background: doorOpen ? "var(--aqua)" : "var(--muted)",
                font: "600 11px var(--font-mono), monospace",
                letterSpacing: ".06em",
                textTransform: "uppercase",
              }}
            >
              {doorOpen ? "Abierta" : "Cerrada"}
            </span>
          </div>

          <div>
            <div className="field">
              <label htmlFor="eggCount">Cantidad de huevos trasladados (opcional al abrir)</label>
              <div className="input-suffix">
                <input
                  id="eggCount"
                  type="number"
                  min="1"
                  max="50"
                  inputMode="numeric"
                  placeholder="Ej. 12"
                  value={eggCount}
                  disabled={sending !== null || doorOpen}
                  onChange={(event) => { setEggCount(event.target.value); setError(null); }}
                />
                <span>unidades</span>
              </div>
              {error ? <span className="field-error" role="alert">{error}</span> : <small>Solo aplica al abrir; al cerrar la cantidad no se registra.</small>}
            </div>

            <div className="form-actions" style={{ gap: 12 }}>
              <button
                type="button"
                className="button secondary"
                disabled={sending !== null || !canOperate || doorOpen}
                onClick={() => submit("ABRIR")}
              >
                {sending === "ABRIR" ? "Abriendo…" : doorOpen ? "Ya está abierta" : "Abrir puerta"}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={sending !== null || !canOperate || !doorOpen}
                onClick={() => submit("CERRAR")}
              >
                {sending === "CERRAR" ? "Cerrando…" : doorOpen ? "Cerrar puerta" : "Ya está cerrada"}
              </button>
            </div>
            {!canOperate ? <p className="field-error" role="alert" style={{ marginTop: 10 }}>El nodo está sin conexión; no puedes operar la puerta.</p> : null}
            <p style={{ margin: "14px 0 0", color: "var(--muted)", fontSize: 12 }}>Operando como <strong>{user.name}</strong>.</p>
          </div>
        </div>
      </section>

      <div className="registration-side">
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "var(--shadow-soft)", padding: "22px 20px" }}>
          <div className="form-heading" style={{ padding: 0, marginBottom: 14 }}>
            <div><p className="eyebrow">Historial de accesos</p><h2 style={{ fontSize: 20 }}>Últimos eventos</h2></div>
          </div>
          {events.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>Todavía no hay accesos registrados a la puerta.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 13px",
                    background: "#fdfcf9",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                >
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      color: "#fff",
                      background: event.accion === "ABRIR" ? "var(--aqua)" : "var(--sprout)",
                      font: "600 10px var(--font-mono), monospace",
                      letterSpacing: ".05em",
                    }}
                  >
                    {event.accion}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 500 }}>{event.operador ?? "Operador"}</strong>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>
                      {event.cantidad_huevos ? `${event.cantidad_huevos} ${event.cantidad_huevos === 1 ? "huevo" : "huevos"} · ` : ""}{timeFormatter.format(new Date(event.timestamp))}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}