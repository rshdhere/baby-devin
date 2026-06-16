"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  Globe,
  Info,
  List,
  MessageSquare,
  Mic,
  Plus,
} from "lucide-react";
import { DashboardLogo } from "@/components/dashboard/dashboard-logo";
import { MotionButton } from "@/components/dashboard/motion-button";
import { cn } from "@/lib/utils";

type AskMode = "auto" | "qa" | "plan";

const modes = [
  {
    id: "auto" as const,
    label: "Auto",
    description: "Automatically select mode",
    icon: Globe,
  },
  {
    id: "qa" as const,
    label: "Q&A",
    description: "Answer questions about codebase",
    icon: MessageSquare,
  },
  {
    id: "plan" as const,
    label: "Plan",
    description: "Create actionable plans for tasks",
    icon: List,
  },
];

export function AskView() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AskMode>("auto");
  const [deepMode, setDeepMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const activeMode = modes.find((item) => item.id === mode) ?? modes[0]!;
  const ActiveIcon = activeMode.icon;

  return (
    <div className="flex w-full max-w-[840px] flex-col items-center">
      <div className="mb-6 flex justify-center">
        <DashboardLogo size={52} className="text-[#525252]" />
      </div>

      <h1 className="mb-6 text-[22px] font-medium text-gray-200">
        What questions do you have?
      </h1>

      <div className="relative w-full">
        <div className="w-full overflow-hidden rounded-[28px] border border-[#333] bg-[#1a1a1a] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_32px_rgba(0,0,0,0.4)]">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask Devin questions about your code"
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] leading-relaxed text-white outline-none selection:bg-white selection:text-[#1a1a1a] placeholder:text-gray-500"
          />

          <div className="flex items-center justify-between px-3 pt-1 pb-3.5">
            <div className="relative flex items-center gap-0.5" ref={menuRef}>
              <MotionButton
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#333] bg-[#161616] px-2.5 py-1 text-[13px] text-gray-300 transition-colors hover:bg-[#222] hover:text-white"
              >
                <ActiveIcon
                  className="size-3.5 text-gray-400"
                  strokeWidth={1.75}
                />
                {activeMode.label}
                <ChevronDown className="size-3 text-gray-500" />
              </MotionButton>
              <MotionButton
                type="button"
                pressStyle="icon"
                className="cursor-pointer rounded-full p-1.5 text-gray-500 transition-colors hover:bg-[#222] hover:text-gray-300"
                aria-label="Add attachment"
              >
                <Plus className="size-4" />
              </MotionButton>

              {menuOpen ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-[280px] overflow-hidden rounded-xl border border-[#333] bg-[#1e1e1e] py-1 shadow-2xl">
                  {modes.map((item) => {
                    const Icon = item.icon;
                    const isSelected = mode === item.id;

                    return (
                      <MotionButton
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setMode(item.id);
                          setMenuOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#252525]",
                          isSelected && "bg-[#252525]/60",
                        )}
                      >
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-gray-400"
                          strokeWidth={1.75}
                        />
                        <div>
                          <p className="text-[14px] font-medium text-white">
                            {item.label}
                          </p>
                          <p className="text-[12px] text-gray-500">
                            {item.description}
                          </p>
                        </div>
                      </MotionButton>
                    );
                  })}

                  <div className="mt-1 border-t border-[#2a2a2a] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-2">
                        <Info className="mt-0.5 size-4 shrink-0 text-gray-500" />
                        <div>
                          <p className="text-[14px] font-medium text-white">
                            Deep mode
                          </p>
                          <p className="text-[12px] leading-relaxed text-gray-500">
                            More thorough answers with deeper reasoning
                          </p>
                        </div>
                      </div>
                      <MotionButton
                        type="button"
                        role="switch"
                        aria-checked={deepMode}
                        onClick={() => setDeepMode((on) => !on)}
                        className={cn(
                          "relative mt-1 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors",
                          deepMode ? "bg-[#4a90e2]" : "bg-[#3a3a3a]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                            deepMode ? "left-[18px]" : "left-0.5",
                          )}
                        />
                      </MotionButton>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <MotionButton
                type="button"
                pressStyle="icon"
                className="cursor-pointer rounded-full p-1.5 text-gray-500 transition-colors hover:bg-[#222] hover:text-gray-300"
                aria-label="Voice input"
              >
                <Mic className="size-4" />
              </MotionButton>
              <MotionButton
                type="button"
                pressStyle="primary"
                disabled={!prompt.trim()}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
                  prompt.trim()
                    ? "bg-[#4a90e2] text-white hover:bg-[#3d7ec8]"
                    : "bg-[#2a2a2a] text-gray-600",
                )}
                aria-label="Send prompt"
              >
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </MotionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
