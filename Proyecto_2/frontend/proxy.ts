import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, deserializeSession, type AuthUser } from "./lib/auth";

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function readSession(request: NextRequest): AuthUser | null {
  return deserializeSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const user = readSession(request);

  if (pathname === "/login") {
    return user ? redirectTo(request, "/dashboard") : NextResponse.next();
  }

  if (!user) return redirectTo(request, "/login");

  if (pathname.startsWith("/admin") && user.role !== "administrador") {
    return redirectTo(request, "/dashboard");
  }

  if (pathname.startsWith("/puerta") && !["operador1", "operador2"].includes(user.role)) {
    return redirectTo(request, "/dashboard");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/admin/:path*",
    "/lotes/:path*",
    "/reportes/:path*",
    "/puerta/:path*",
    "/perfil/:path*",
  ],
};
