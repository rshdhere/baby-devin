"use client";

import { useState } from "react";
import type { NavId } from "@/components/dashboard/dashboard-nav";
import { Sidebar } from "@/components/dashboard/sidebar";
import { AskView } from "@/components/dashboard/views/ask-view";
import { AutomationsView } from "@/components/dashboard/views/automations-view";
import { ReviewView } from "@/components/dashboard/views/review-view";
import { SessionsView } from "@/components/dashboard/views/sessions-view";
import { WikiView } from "@/components/dashboard/views/wiki-view";

interface DashboardShellProps {
  userName: string;
}

function MainContent({ activeNav }: { activeNav: NavId }) {
  switch (activeNav) {
    case "sessions":
      return <SessionsView />;
    case "ask":
      return (
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <AskView />
        </div>
      );
    case "automations":
      return (
        <div className="flex w-full flex-1 flex-col pt-4">
          <AutomationsView />
        </div>
      );
    case "review":
      return (
        <div className="flex w-full flex-1 flex-col pt-4">
          <ReviewView />
        </div>
      );
    case "wiki":
      return (
        <div className="flex w-full flex-1 flex-col pt-4">
          <WikiView />
        </div>
      );
    default:
      return <SessionsView />;
  }
}

export function DashboardShell({ userName }: DashboardShellProps) {
  const [activeNav, setActiveNav] = useState<NavId>("sessions");

  const isSessionsLayout = activeNav === "sessions";

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0d] text-white">
      <Sidebar
        userName={userName}
        activeNav={activeNav}
        onNavChange={setActiveNav}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <main
          className={
            isSessionsLayout
              ? "relative flex min-h-0 flex-1 flex-col items-center overflow-hidden px-6 pt-3 pb-8"
              : "relative flex flex-1 [scrollbar-gutter:stable] flex-col overflow-y-auto px-8 pt-3 pb-8"
          }
        >
          <MainContent activeNav={activeNav} />
        </main>
      </div>
    </div>
  );
}
