import { RequireRole } from "@/components/auth/require-role";
import { PuertaContent } from "@/components/puerta/puerta-content";

export default function PuertaPage() {
  return (
    <RequireRole roles={["operador1", "operador2"]}>
      <PuertaContent />
    </RequireRole>
  );
}