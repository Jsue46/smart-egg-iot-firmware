import { RequireRole } from "@/components/auth/require-role";
import { AdminConsole } from "@/components/admin/admin-console";

export default function AdminPage() {
  return (
    <RequireRole roles={["administrador"]}>
      <AdminConsole />
    </RequireRole>
  );
}