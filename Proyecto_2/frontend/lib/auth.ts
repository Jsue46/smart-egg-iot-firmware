export type Role = "administrador" | "operador1" | "operador2";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  badge: string;
}

export interface UserAccount extends AuthUser {
  password: string;
}

const ACCOUNTS: UserAccount[] = [
  { id: "1", name: "Administrador", username: "admin", password: "admin123", role: "administrador", badge: "AYC2-G7-ADM" },
  { id: "2", name: "Operador 1", username: "op1", password: "op1pass", role: "operador1", badge: "AYC2-G7-OP1" },
  { id: "3", name: "Operador 2", username: "op2", password: "op2pass", role: "operador2", badge: "AYC2-G7-OP2" },
];

export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  operador1: "Operador 1",
  operador2: "Operador 2",
};

function toPublic(account: UserAccount): AuthUser {
  const { password: _password, ...user } = account;
  void _password;
  return user;
}

export function validateCredentials(username: string, password: string): AuthUser | null {
  const account = ACCOUNTS.find((candidate) => candidate.username === username.trim() && candidate.password === password);
  return account ? toPublic(account) : null;
}

export const SESSION_COOKIE = "smartegg_session";
export const SESSION_DURATION_DAYS = 1;

export function serializeSession(user: AuthUser): string {
  return encodeURIComponent(JSON.stringify(user));
}

export function deserializeSession(value: string | undefined): AuthUser | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "name" in parsed &&
      "username" in parsed &&
      "role" in parsed &&
      "badge" in parsed
    ) {
      return parsed as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}