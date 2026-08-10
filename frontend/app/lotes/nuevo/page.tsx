import type { Metadata } from "next";
import { FichaHuevoForm } from "@/components/formularios/ficha-huevo-form";

export const metadata: Metadata = { title: "Registrar lote" };

export default function NuevoLotePage() {
  return <FichaHuevoForm />;
}
