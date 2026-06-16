"use client";

import { useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { GithubIcon } from "@/components/dashboard/github-icon";
import { MotionButton } from "@/components/dashboard/motion-button";
import { cn } from "@/lib/utils";

const featuredAutomations = [
  {
    id: "slack",
    icon: "💬",
    title: "Triage Bug Reports on Slack",
    description: "Automatically triage and respond to bug reports in Slack",
  },
  {
    id: "ci",
    icon: "github",
    title: "CI Failure Fixer",
    description: "Fix CI failures automatically when tests fail on PRs",
  },
  {
    id: "issue",
    icon: "github",
    title: "/devin Issue Fix",
    description: "Respond to GitHub issues tagged with /devin",
  },
];

export function AutomationsView() {
  const [prompt, setPrompt] = useState("");
  const [activeTab, setActiveTab] = useState<"automations" | "triage">(
    "automations",
  );

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col">
      <h1 className="mb-6 text-[22px] font-semibold text-white">Automations</h1>

      <div className="overflow-hidden rounded-[20px] border border-[#333] bg-[#1a1a1a]">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Fix lint errors whenever CI fails on a PR"
          rows={2}
          className="w-full resize-none bg-transparent px-5 pt-5 pb-2 text-[15px] text-white italic outline-none placeholder:text-gray-500 placeholder:italic"
        />
        <div className="flex justify-end px-3 pb-3">
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
            aria-label="Create automation"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </MotionButton>
        </div>

        <div className="border-t border-[#2a2a2a] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-medium text-gray-400">
              Featured automations
            </span>
            <MotionButton
              type="button"
              className="cursor-pointer text-[13px] text-gray-500 transition-colors hover:text-gray-300"
            >
              View all examples
            </MotionButton>
          </div>

          <div className="space-y-1">
            {featuredAutomations.map((item) => (
              <MotionButton
                key={item.id}
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[#222]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#252525] text-[14px]">
                  {item.icon === "github" ? (
                    <GithubIcon className="size-4 text-gray-300" />
                  ) : (
                    item.icon
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-white">
                    {item.title}
                  </p>
                  <p className="truncate text-[12px] text-gray-500">
                    {item.description}
                  </p>
                </div>
                <Plus className="size-4 shrink-0 text-gray-500" />
              </MotionButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-b border-[#2a2a2a] pb-0">
        <div className="flex gap-4">
          <MotionButton
            type="button"
            onClick={() => setActiveTab("automations")}
            className={cn(
              "cursor-pointer border-b-2 pb-2.5 text-[14px] font-medium transition-colors",
              activeTab === "automations"
                ? "border-white text-white"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            Automations
          </MotionButton>
          <MotionButton
            type="button"
            onClick={() => setActiveTab("triage")}
            className={cn(
              "cursor-pointer border-b-2 pb-2.5 text-[14px] font-medium transition-colors",
              activeTab === "triage"
                ? "border-white text-white"
                : "border-transparent text-gray-500 hover:text-gray-300",
            )}
          >
            Triage Devins
          </MotionButton>
        </div>
        <MotionButton
          type="button"
          pressStyle="primary"
          className="mb-2 cursor-pointer rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-gray-100"
        >
          + Create automation
        </MotionButton>
      </div>

      <p className="mt-12 text-center text-[14px] text-gray-500">
        No automations yet
      </p>
    </div>
  );
}
