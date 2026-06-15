"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { authClient } from "@/lib/auth-client";
import { useMinimumLoadingDuration } from "@/lib/use-minimum-loading-duration";

export function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const minDurationElapsed = useMinimumLoadingDuration();

  useEffect(() => {
    if (!isPending && !session && minDurationElapsed) {
      const authError = searchParams.get("error");
      router.replace(
        authError ? `/login?error=${encodeURIComponent(authError)}` : "/login",
      );
    }
  }, [isPending, minDurationElapsed, router, searchParams, session]);

  if (isPending || !minDurationElapsed || !session) {
    return <LoadingScreen />;
  }

  return <DashboardShell userName={session.user.name} />;
}
