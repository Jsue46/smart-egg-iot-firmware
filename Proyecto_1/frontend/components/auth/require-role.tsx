"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/auth";
import { useAuth } from "@/components/auth/auth-provider";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user && !roles.includes(user.role)) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || !user || !roles.includes(user.role)) return null;
  return <>{children}</>;
}