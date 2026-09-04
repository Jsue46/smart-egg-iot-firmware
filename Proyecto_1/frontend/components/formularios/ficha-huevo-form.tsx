"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CustomDatePicker } from "@/components/formularios/custom-date-picker";
import { CapacityIcon, LotIcon, PlusEggIcon, TemperatureIcon } from "@/components/icons/egg-icons";
import { useToast } from "@/components/ui/toast-provider";
import { useSimulatedTelemetry } from "@/hooks/use-simulated-telemetry";
import type { Lot } from "@/lib/types";

const formSchema = z.object({
  label: z.string().trim().min(3, "Escribe una etiqueta de al menos 3 caracteres").max(40, "Usa máximo 40 caracteres"),
  entryDate: z.string().min(1, "Selecciona la fecha de ingreso"),
  quantity: z.number({ error: "Ingresa una cantidad válida" }).int("Usa un número entero").min(1, "Registra al menos 1 huevo").max(3, "El disco admite un máximo de 3 huevos"),
  requiredTemperature: z.number({ error: "Ingresa una temperatura válida" }).min(36, "La temperatura mínima es 36 °C").max(38, "La temperatura máxima es 38 °C"),
});

type FormValues = z.infer<typeof formSchema>;

const today = new Date().toISOString().slice(0, 10);

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error" role="alert">{message}</span> : null;
}

function FichaCard({ lot }: { lot: Lot }) {
  return (
    <motion.aside className="ficha-card" initial={{ opacity: 0, scale: 1.08, rotate: -1.2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 220, damping: 20 }} aria-live="polite">
      <div className="ficha-top"><span className="ficha-seal"><LotIcon size={54} /></span><div><span>FICHA DE INCUBACIÓN</span><strong>SmartEgg · Equipo 15</strong></div></div>
      <div className="ficha-identity"><p>Etiqueta del lote</p><h3>{lot.label}</h3><span className="mono">{lot.id}</span></div>
      <dl className="ficha-data">
        <div><dt>Fecha de ingreso</dt><dd>{new Intl.DateTimeFormat("es-GT", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${lot.entryDate}T00:00:00Z`))}</dd></div>
        <div><dt>Cantidad registrada</dt><dd>{lot.quantity} {lot.quantity === 1 ? "huevo" : "huevos"}</dd></div>
        <div><dt>Temperatura requerida</dt><dd><TemperatureIcon size={23} />{lot.requiredTemperature.toFixed(1)} °C</dd></div>
      </dl>
      <div className="ficha-footer"><span /><p>Registro guardado en PostgreSQL</p></div>
    </motion.aside>
  );
}

export function FichaHuevoForm() {
  const { addLot, capacity, occupied } = useSimulatedTelemetry();
  const { showToast } = useToast();
  const [created, setCreated] = useState<Lot | null>(null);
  const available = Math.max(0, capacity - occupied);
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: { label: "", entryDate: today, quantity: 1, requiredTemperature: 37.5 },
  });

  const submit = async (values: FormValues) => {
    if (values.quantity > available) {
      const message = available === 0 ? "El disco está lleno; completa un ciclo antes de registrar otro huevo" : `Solo ${available} espacio disponible en el disco`;
      setError("quantity", { message });
      showToast({ title: "Capacidad insuficiente", message, tone: "warning" });
      return;
    }
    try {
      const lot = await addLot(values);
      setCreated(lot);
      showToast({ title: "Ficha creada", message: `${lot.label} ya está disponible en el listado de lotes.`, tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible registrar el lote";
      setError("quantity", { message });
      showToast({ title: "No se pudo guardar la ficha", message, tone: "error" });
    }
  };

  return (
    <div className="new-lot-layout">
      <section className="form-panel">
        <div className="form-heading"><span className="form-step">01</span><div><p className="eyebrow">Nueva ficha</p><h2>Datos de ingreso</h2><p>Completa la información que acompañará al lote durante todo el ciclo.</p></div></div>
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="field full"><label htmlFor="label">Etiqueta del lote</label><input id="label" placeholder="Ej. Criollo dorado" aria-invalid={Boolean(errors.label)} {...register("label")} /><small>Usa un nombre fácil de reconocer en el panel.</small><FieldError message={errors.label?.message} /></div>
          <div className="form-grid">
            <div className="field"><label htmlFor="entryDate">Fecha de ingreso</label><Controller name="entryDate" control={control} render={({ field }) => <CustomDatePicker value={field.value} onChange={field.onChange} invalid={Boolean(errors.entryDate)} max={today} />} /><FieldError message={errors.entryDate?.message} /></div>
            <div className="field"><label htmlFor="quantity">Cantidad de huevos</label><div className="input-suffix"><input id="quantity" type="number" min="1" max="3" aria-invalid={Boolean(errors.quantity)} {...register("quantity", { valueAsNumber: true })} /><span>unidades</span></div><small>{available} de {capacity} espacios disponibles.</small><FieldError message={errors.quantity?.message} /></div>
          </div>
          <div className="field full"><label htmlFor="requiredTemperature">Temperatura requerida al ingreso</label><div className="temperature-input"><TemperatureIcon size={29} /><input id="requiredTemperature" type="number" min="36" max="38" step="0.1" aria-invalid={Boolean(errors.requiredTemperature)} {...register("requiredTemperature", { valueAsNumber: true })} /><span>°C</span></div><small>Rango recomendado para incubación: 36–38 °C.</small><FieldError message={errors.requiredTemperature?.message} /></div>
          <div className="form-actions"><Link href="/lotes" className="button ghost">Cancelar</Link><button type="submit" className="button primary" disabled={isSubmitting || Boolean(created)}><PlusEggIcon />{created ? "Ficha creada" : "Crear ficha"}</button></div>
        </form>
      </section>
      <div className="registration-side">
        <motion.aside className="registration-nature-card" initial={false} animate={{ opacity: 1, y: 0 }}>
          <span><CapacityIcon size={42} /></span>
          <div><p>Disco disponible</p><strong>{available} de {capacity} espacios libres</strong><small>Listo para recibir un nuevo ciclo.</small></div>
        </motion.aside>
        <div className="preview-panel"><div className="preview-label"><span>Vista previa</span><small>Se genera al guardar</small></div><AnimatePresence mode="wait">{created ? <FichaCard key={created.id} lot={created} /> : <motion.div className="empty-ficha" initial={false} animate={{ opacity: 1 }}><LotIcon size={70} /><h3>Tu ficha aparecerá aquí</h3><p>Al crear el registro tendrás una identificación clara y lista para consultar.</p></motion.div>}</AnimatePresence>{created && <button className="button secondary compact preview-reset" type="button" onClick={() => { setCreated(null); reset(); }}>Registrar otro</button>}</div>
      </div>
    </div>
  );
}
