"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export type ToastTone = "success" | "info" | "warning" | "error";

interface ToastInput {
  title: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
}

interface ToastItem extends Required<ToastInput> {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let toastSequence = 0;

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.2 3.2 7.8-8" /></svg>;
  if (tone === "error") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8M16 8l-8 8" /></svg>;
  if (tone === "warning") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v6M12 7h.01" /></svg>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());
  const reduceMotion = useReducedMotion();

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = `toast-${Date.now()}-${toastSequence += 1}`;
    const toast: ToastItem = { id, title: input.title, message: input.message, tone: input.tone ?? "info", duration: input.duration ?? 5_200 };
    setToasts((current) => [...current.slice(-2), toast]);
    const timer = window.setTimeout(() => dismissToast(id), toast.duration);
    timers.current.set(id, timer);
  }, [dismissToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="toast-region" aria-label="Notificaciones" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`toast-card ${toast.tone}`}
              role={toast.tone === "error" ? "alert" : "status"}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: .97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: .98 }}
              transition={{ duration: reduceMotion ? 0 : .24, ease: [0.22, 1, 0.36, 1] }}
              style={{ "--toast-duration": `${toast.duration}ms` } as CSSProperties}
            >
              <span className="toast-icon"><ToastIcon tone={toast.tone} /></span>
              <div className="toast-copy"><strong>{toast.title}</strong><p>{toast.message}</p></div>
              <button type="button" onClick={() => dismissToast(toast.id)} aria-label={`Cerrar notificación: ${toast.title}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8M16 8l-8 8" /></svg>
              </button>
              <span className="toast-progress" aria-hidden="true" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
