"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { ConnectionIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon } from "@/components/icons/egg-icons";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Escribe tu usuario"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [denied, setDenied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const submit = (values: LoginValues) => {
    const result = login(values.username, values.password);
    if (!result.ok) {
      setDenied(true);
      showToast({ title: "Acceso denegado", message: result.message, tone: "error" });
      return;
    }
    setDenied(false);
    showToast({ title: "Bienvenido", message: `Sesión iniciada como ${result.user.name}.`, tone: "success" });
  };

  return (
    <main className="login-page">
      <section className="login-showcase" aria-labelledby="login-showcase-title">
        <div className="login-orbit login-orbit-one" aria-hidden="true" />
        <div className="login-orbit login-orbit-two" aria-hidden="true" />
        <div className="login-showcase-inner">
          <div className="login-brand-lockup">
            <span className="brand-mark login-brand-mark" aria-hidden="true"><span /></span>
            <div>
              <strong>SmartEgg</strong>
              <small>Incubación precisa</small>
            </div>
          </div>

          <div className="login-showcase-copy">
            <span className="login-kicker"><span className="login-kicker-dot" aria-hidden="true" /> Plataforma de monitoreo inteligente</span>
            <h1 id="login-showcase-title">Cada ciclo,<br /><em>bajo control.</em></h1>
            <p>Supervisa el ambiente de tu incubadora, toma decisiones a tiempo y protege cada etapa del proceso desde un solo lugar.</p>
          </div>

          <div className="login-showcase-bottom">
            <div className="login-sensor-preview" aria-label="Resumen de telemetría de demostración">
              <div className="login-preview-head">
                <span><span className="login-live-dot" aria-hidden="true" /> Nodo SE-01</span>
                <small>Telemetría en vivo</small>
              </div>
              <div className="login-sensor-grid">
                <div className="login-sensor-item">
                  <small>Temperatura</small>
                  <strong>37.5 <span>°C</span></strong>
                </div>
                <div className="login-sensor-item">
                  <small>Humedad</small>
                  <strong>60.5 <span>%</span></strong>
                </div>
                <div className="login-sensor-item login-sensor-item-wide">
                  <small>Estado del sistema</small>
                  <strong>Estable <span>· 3 espacios disponibles</span></strong>
                </div>
              </div>
            </div>
            <div className="login-showcase-footer">
              <span>Proyecto 2 · Grupo 7</span>
              <span><span className="login-live-dot" aria-hidden="true" /> Sistema preparado para monitoreo</span>
            </div>
          </div>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-panel-title">
        <div className="login-panel-inner">
          <div className="login-mobile-brand" aria-label="SmartEgg, incubación precisa">
            <span className="brand-mark login-mobile-brand-mark" aria-hidden="true"><span /></span>
            <div>
              <strong>SmartEgg</strong>
              <small>Incubación precisa</small>
            </div>
          </div>

          <div className="login-panel-header">
            <p className="eyebrow">Acceso seguro</p>
            <h2 id="login-panel-title">Bienvenido de nuevo</h2>
            <p>Ingresa con las credenciales asignadas a tu rol para continuar.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit(submit)} noValidate>
            <div className="login-field">
              <label htmlFor="username">Usuario</label>
              <div className="login-input-wrap">
                <UserIcon size={20} color="var(--forest)" aria-hidden="true" />
                <input id="username" autoComplete="username" placeholder="Ej. op1" aria-invalid={Boolean(errors.username)} {...register("username")} />
              </div>
              {errors.username ? <span className="field-error" role="alert">{errors.username.message}</span> : null}
            </div>

            <div className="login-field">
              <label htmlFor="password">Contraseña</label>
              <div className="login-input-wrap">
                <LockIcon size={20} color="var(--forest)" aria-hidden="true" />
                <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña" aria-invalid={Boolean(errors.password)} {...register("password")} />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOffIcon size={20} color="var(--muted)" /> : <EyeIcon size={20} color="var(--muted)" />}
                </button>
              </div>
              {errors.password ? <span className="field-error" role="alert">{errors.password.message}</span> : null}
            </div>

            {denied ? <p className="login-form-error" role="alert">Usuario o contraseña incorrectos. Revisa las credenciales de tu rol.</p> : null}

            <button type="submit" className="button primary login-submit" disabled={isSubmitting}>
              <span>Entrar al panel</span>
              <span className="login-submit-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="login-role-note">
            <ConnectionIcon size={27} color="var(--forest)" aria-hidden="true" />
            <div>
              <strong>Acceso por roles</strong>
              <span>Administrador · Operador 1 · Operador 2</span>
            </div>
          </div>

          <p className="login-panel-footer">SmartEgg · Monitoreo de incubación avícola</p>
          <p className="login-mobile-footer">SmartEgg · Proyecto 2 · Grupo 7</p>
        </div>
      </section>
    </main>
  );
}
