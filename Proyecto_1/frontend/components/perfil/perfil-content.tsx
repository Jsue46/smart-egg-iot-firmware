"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import { API_BASE_URL } from "@/lib/config";
import { ROLE_LABELS, type Role } from "@/lib/auth";
import { DoorIcon, HumidityIcon, LotIcon, ReportIcon, TemperatureIcon, UserIcon } from "@/components/icons/egg-icons";
import type { Lot } from "@/lib/types";

interface DoorEvent {
  id: number;
  operador: string | null;
  accion: "ABRIR" | "CERRAR";
  cantidad_huevos: number | null;
  timestamp: string;
}

const OPERATOR_BACKEND_NAME: Record<Role, string | null> = {
  administrador: null,
  operador1: "Operador 1",
  operador2: "Operador 2",
};

function toDateOnly(value: unknown): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function mapLot(row: any): Lot {
  return {
    id: `LT-${row.id}`,
    label: row.etiqueta ?? "Lote",
    entryDate: toDateOnly(row.fecha_ingreso),
    quantity: Number(row.cantidad) || 1,
    requiredTemperature: Number(row.temperatura_requerida) || 37.5,
    status: row.status === "completo" ? "completo" : "incubando",
    progress: Number(row.progress) || 1,
  };
}

const dateFormatter = new Intl.DateTimeFormat("es-GT", { dateStyle: "long", timeZone: "UTC" });

export function PerfilContent() {
  const { user } = useAuth();
  const { temperature, humidity, isOnline, doorOpen, occupied } = useSimulatedTelemetry();
  const [myLots, setMyLots] = useState<Lot[]>([]);
  const [myDoors, setMyDoors] = useState<DoorEvent[]>([]);

  const loadActivity = useCallback(() => {
    if (!user) return;
    const expected = OPERATOR_BACKEND_NAME[user.role];
    let active = true;

    fetch(`${API_BASE_URL}/huevos`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((rows: any[]) => {
        if (!active) return;
        const relevant = expected ? rows.filter((row) => row.tecnico === expected) : rows;
        setMyLots(relevant.map(mapLot));
      })
      .catch(() => { if (active) setMyLots([]); });

    fetch(`${API_BASE_URL}/accesos-puerta?limit=30`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((rows: DoorEvent[]) => {
        if (!active) return;
        const relevant = expected ? rows.filter((row) => row.operador === expected) : rows;
        setMyDoors(relevant);
      })
      .catch(() => { if (active) setMyDoors([]); });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (!user) return null;

  const isAdmin = user.role === "administrador";

  return (
    <div className="new-lot-layout">
      <section className="form-panel">
        <div className="form-heading"><span className="form-step">04</span><div><p className="eyebrow">Perfil de usuario</p><h2>Tu espacio en SmartEgg</h2><p>Revisa tu identificación, los registros que has hecho y el diagnóstico actual de la incubadora.</p></div></div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "18px 20px",
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "linear-gradient(165deg, #2f7262 0%, var(--forest) 55%, var(--forest-deep) 100%)",
            color: "#fff8e9",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 58,
              height: 66,
              flex: "none",
              color: "#33240a",
              background: "var(--yolk)",
              borderRadius: "50% 50% 47% 47% / 60% 60% 42% 42%",
              font: "600 15px var(--font-mono), monospace",
              boxShadow: "inset -6px -7px 10px rgba(132,82,9,.14)",
            }}
          >
            {user.name.split(" ").map((part) => part[0]).join("")}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "#d9e7e0", font: "500 11px var(--font-mono), monospace", letterSpacing: ".1em", textTransform: "uppercase" }}>{ROLE_LABELS[user.role]}</p>
            <strong style={{ display: "block", marginTop: 2, fontSize: 19 }}>{user.name}</strong>
            <small style={{ color: "#d9e7e0", fontSize: 12 }}>{user.badge} · usuario <code style={{ fontFamily: "var(--font-mono), monospace" }}>{user.username}</code></small>
          </div>
          <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 999, background: "rgba(255,248,233,.14)", border: "1px solid rgba(255,248,233,.24)", font: "600 11px var(--font-mono), monospace", letterSpacing: ".06em" }}>G7</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 4 }}>
          <div className="mini-stat"><TemperatureIcon size={26} color="var(--yolk-deep)" /><span><small>Temperatura</small><strong>{temperature.toFixed(1)} °C</strong></span></div>
          <div className="mini-stat"><HumidityIcon size={26} color="var(--aqua)" /><span><small>Humedad</small><strong>{humidity.toFixed(1)} %</strong></span></div>
          <div className="mini-stat"><DoorIcon size={26} color="var(--sprout)" /><span><small>Puerta</small><strong>{doorOpen ? "Abierta" : "Cerrada"}</strong></span></div>
          <div className="mini-stat"><LotIcon size={26} color="var(--violet)" /><span><small>Disco</small><strong>{occupied} / 3</strong></span></div>
        </div>

        <div className="form-actions" style={{ marginTop: 4 }}>
          <Link href="/reportes" className="button secondary"><ReportIcon size={18} />Ir a informes generales</Link>
          <span className="live-chip" style={{ marginLeft: "auto" }}><span className="live-dot" /> {isOnline ? "Nodo SE-01 en línea" : "Nodo SE-01 sin conexión"}</span>
        </div>
      </section>

      <div className="registration-side" style={{ display: "grid", gap: 16 }}>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "var(--shadow-soft)", padding: "20px" }}>
          <div className="form-heading" style={{ padding: 0, marginBottom: 12 }}><div><p className="eyebrow">Actividad propia</p><h2 style={{ fontSize: 20 }}>{isAdmin ? "Lotes registrados" : "Lotes que registraste"}</h2></div></div>
          {myLots.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>{isAdmin ? "Todavía no hay lotes en el sistema." : "Todavía no registras lotes. Crea uno desde la ficha de incubación."}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {myLots.slice(0, 5).map((lot) => (
                <div key={lot.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "#fdfcf9", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <LotIcon size={24} color="var(--sprout)" />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{lot.label}</strong>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>{lot.quantity} {lot.quantity === 1 ? "huevo" : "huevos"} · ingreso {dateFormatter.format(new Date(`${lot.entryDate}T00:00:00Z`))}</small>
                  </div>
                  <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 999, background: lot.status === "completo" ? "var(--sprout-soft)" : "var(--yolk-soft)", color: lot.status === "completo" ? "var(--sprout)" : "var(--yolk-deep)", font: "600 10px var(--font-mono), monospace", textTransform: "uppercase" }}>{lot.status === "completo" ? "Completo" : "Incubando"}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "var(--shadow-soft)", padding: "20px" }}>
          <div className="form-heading" style={{ padding: 0, marginBottom: 12 }}><div><p className="eyebrow">Accesos</p><h2 style={{ fontSize: 20 }}>{isAdmin ? "Accesos de puerta" : "Tus accesos de puerta"}</h2></div></div>
          {myDoors.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>{isAdmin ? "Todavía no hay accesos registrados." : "Todavía no abres la puerta. La verás aquí cada vez que lo hagas."}</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {myDoors.slice(0, 6).map((event) => (
                <div key={event.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: "#fdfcf9", border: "1px solid var(--border)", borderRadius: 12 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 999, color: "#fff", background: event.accion === "ABRIR" ? "var(--aqua)" : "var(--sprout)", font: "600 10px var(--font-mono), monospace", letterSpacing: ".05em" }}>{event.accion}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{event.operador ?? "Operador"}</strong>
                    <small style={{ color: "var(--muted)", fontSize: 11 }}>{event.cantidad_huevos ? `${event.cantidad_huevos} ${event.cantidad_huevos === 1 ? "huevo" : "huevos"} · ` : ""}{new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short" }).format(new Date(event.timestamp))}</small>
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