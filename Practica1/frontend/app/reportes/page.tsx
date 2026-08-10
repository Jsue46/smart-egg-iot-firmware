import type { Metadata } from "next";
import { ReportesContent } from "@/components/reportes/reportes-content";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesPage() {
  return <ReportesContent />;
}
