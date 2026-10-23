import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { TelemetryProvider } from "@/hooks/use-telemetry";

const inter = Inter({ subsets: ["latin"], variable: "--font-ui" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "SmartEgg", template: "%s · SmartEgg" },
  description: "Panel de monitoreo para incubación avícola de precisión.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#F7F5F1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable} ${mono.variable}`}>
      <body>
        <AuthProvider><ToastProvider><TelemetryProvider><AppShell>{children}</AppShell></TelemetryProvider></ToastProvider></AuthProvider>
      </body>
    </html>
  );
}
