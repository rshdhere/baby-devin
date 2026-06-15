"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { OnboardingPanel } from "@/components/dashboard/onboarding-panel";
import { PromptComposer } from "@/components/dashboard/prompt-composer";
import { cn } from "@/lib/utils";

const collapseTransition = {
  height: {
    type: "tween" as const,
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  opacity: { duration: 0.28, ease: "easeOut" as const },
  paddingTop: {
    type: "tween" as const,
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  paddingBottom: {
    type: "tween" as const,
    duration: 0.4,
    ease: [0.4, 0, 0.2, 1] as const,
  },
};

export function SessionsView() {
  const panelSectionRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  function handleDismissConfirmed() {
    const measured = panelSectionRef.current?.offsetHeight ?? 0;
    setPanelHeight(measured);
    setIsDismissed(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsCollapsing(true);
      });
    });
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div
        className={cn(
          "grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto]",
          isCollapsing && "overflow-hidden",
        )}
      >
        <div className="flex min-h-0 items-center justify-center">
          <div className="w-full max-w-[720px]">
            <PromptComposer />
          </div>
        </div>

        <motion.div
          ref={panelSectionRef}
          initial={false}
          animate={{
            height: isCollapsing ? 0 : (panelHeight ?? "auto"),
            opacity: isCollapsing ? 0 : 1,
            paddingTop: isCollapsing ? 0 : 32,
            paddingBottom: isCollapsing ? 0 : 8,
          }}
          transition={collapseTransition}
          className="min-h-0 overflow-hidden"
          aria-hidden={isDismissed}
        >
          <div
            className={cn(
              "mx-auto w-full max-w-[720px]",
              isDismissed && "pointer-events-none select-none",
            )}
          >
            <OnboardingPanel
              onDismissConfirmed={
                isDismissed ? undefined : handleDismissConfirmed
              }
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
