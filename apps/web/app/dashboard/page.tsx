import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = {
  title: "Sessions — Devin",
  description: "Your Devin workspace",
};

export default function DashboardRoute() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardPage />
    </Suspense>
  );
}
