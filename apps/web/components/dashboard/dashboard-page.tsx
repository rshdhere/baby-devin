"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { authClient } from "@/lib/auth-client";
import { useMinimumLoadingDuration } from "@/lib/use-minimum-loading-duration";

export function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const minDurationElapsed = useMinimumLoadingDuration();

  useEffect(() => {
    if (!isPending && !session && minDurationElapsed) {
      router.replace("/login");
    }
  }, [isPending, minDurationElapsed, router, session]);

  if (isPending || !minDurationElapsed || !session) {
    return <LoadingScreen />;
  }

  return <DashboardShell userName={session.user.name} />;
}
