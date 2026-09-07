"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { ConnectionIcon, UserIcon } from "@/components/icons/egg-icons";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Escribe tu usuario"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [denied, setDenied] = useState(false);
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
    showToast({ title: "Bienvenido", message: `Sesión iniciada como ${result.user.name}.`, tone: "success" });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "34px 20px",
        background:
          "radial-gradient(circle at 88% 9%, rgba(0,143,150,.075), transparent 26%), radial-gradient(circle at 9% 82%, rgba(102,131,66,.075), transparent 24%), var(--shell)",
      }}
    >
      <div style={{ width: "min(1020px, 100%)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, alignItems: "stretch" }}>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 24,
            padding: "38px 34px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "#fff8e9",
            background: "linear-gradient(165deg, #2f7262 0%, var(--forest) 50%, var(--forest-deep) 100%)",
            boxShadow: "var(--shadow-lift)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="brand-mark"
              style={{ width: 42, height: 49, display: "grid", placeItems: "center", background: "#efb216", borderRadius: "50% 50% 48% 48% / 62% 62% 40% 40%", transform: "rotate(2deg)" }}
              aria-hidden="true"
            >
              <span />
            </span>
            <div>
              <strong style={{ font: "500 22px Georgia, serif", letterSpacing: "-0.02em" }}>SmartEgg</strong>
              <p style={{ margin: 0, color: "rgba(255,248,233,.72)", fontSize: 12 }}>Incubación precisa</p>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ color: "#d9e7e0", margin: "30px 0 6px" }}>Control de acceso</p>
            <h2 style={{ margin: 0, font: "500 clamp(26px, 3vw, 34px) Georgia, serif", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Un panel, tres roles, mismo equipo.</h2>
            <p style={{ color: "#d9e7e0", fontSize: 14, margin: "14px 0 0", maxWidth: 380 }}>
              Accede con tu cuenta para vigilar la incubadora, registrar lotes, abrir la puerta o administrar el sistema según tu rol.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 30, padding: "12px 14px", borderRadius: 15, background: "rgba(102,131,66,.22)", border: "1px solid rgba(171,196,142,.22)" }}>
            <ConnectionIcon size={34} color="#a7c88a" />
            <span style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: 12, fontWeight: 500 }}>Nodo SE-01 en línea</strong>
              <small style={{ color: "#d9e7e0", fontSize: 11 }}>Monitoreo en vivo de tu incubadora</small>
            </span>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "var(--shadow-soft)", padding: "34px 32px" }}>
          <p className="eyebrow" style={{ margin: "0 0 8px" }}>Iniciar sesión</p>
          <h2 style={{ margin: 0, font: "500 26px Georgia, serif", letterSpacing: "-0.02em" }}>Bienvenido al panel</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 22px" }}>Usa las credenciales asignadas a tu rol.</p>

          <form onSubmit={handleSubmit(submit)} noValidate style={{ display: "grid", gap: 16 }}>
            <div className="field">
              <label htmlFor="username">Usuario</label>
              <div style={{ position: "relative" }}>
                <UserIcon size={19} color="var(--muted)" />
                <input id="username" autoComplete="username" placeholder="Ej. op1" aria-invalid={Boolean(errors.username)} {...register("username")} style={{ paddingLeft: 44 }} />
              </div>
              {errors.username ? <span className="field-error" role="alert">{errors.username.message}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input id="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" aria-invalid={Boolean(errors.password)} {...register("password")} />
              {errors.password ? <span className="field-error" role="alert">{errors.password.message}</span> : null}
            </div>
            {denied ? <p className="field-error" role="alert" style={{ margin: 0 }}>Usuario o contraseña incorrectos. Revisa las credenciales de tu rol.</p> : null}
            <button type="submit" className="button primary" disabled={isSubmitting} style={{ width: "100%" }}>
              Entrar al panel
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}