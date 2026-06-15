import type { Metadata } from "next";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Sessions — Devin",
  description: "Your Devin workspace",
};

export default function DashboardRoute() {
  return <DashboardPage />;
}
