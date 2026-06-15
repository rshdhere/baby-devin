"use client";

import { useState } from "react";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { GithubIcon } from "@/components/dashboard/github-icon";
import { MotionButton } from "@/components/dashboard/motion-button";

const repositories = [
  "advanced-typescript",
  "airbnb-shadcn-nextjs-template",
  "argocd-deployment",
  "better-auth",
  "devin",
  "drizzle-orm",
  "nextjs-boilerplate",
  "turbo",
];

export function WikiView() {
  const [search, setSearch] = useState("");

  const filtered = repositories.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex w-full max-w-[900px] flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold text-white">DeepWiki</h1>
        <div className="flex items-center gap-2">
          <MotionButton
            type="button"
            pressStyle="icon"
            className="cursor-pointer rounded-lg p-2 text-gray-500 transition-colors hover:bg-[#1a1a1a] hover:text-gray-300"
            aria-label="Refresh"
          >
            <RefreshCw className="size-4" />
          </MotionButton>
          <MotionButton
            type="button"
            pressStyle="icon"
            className="cursor-pointer rounded-lg p-2 text-gray-500 transition-colors hover:bg-[#1a1a1a] hover:text-gray-300"
            aria-label="Filter"
          >
            <SlidersHorizontal className="size-4" />
          </MotionButton>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search repositories"
              className="w-[220px] rounded-lg border border-[#333] bg-[#1a1a1a] py-2 pr-3 pl-9 text-[13px] text-white outline-none placeholder:text-gray-500 focus:border-[#444]"
            />
          </div>
        </div>
      </div>

      <p className="mb-4 text-[13px] font-medium text-gray-500">Repositories</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((name) => (
          <div
            key={name}
            className="flex flex-col rounded-xl border border-[#2a2a2a] bg-[#141414] p-4 transition-colors hover:border-[#333]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">
                  {name}
                </p>
                <p className="mt-0.5 text-[12px] text-gray-500">rshdhere</p>
              </div>
              <GithubIcon className="size-4 shrink-0 text-gray-500" />
            </div>
            <MotionButton
              type="button"
              pressStyle="primary"
              className="mt-4 w-fit cursor-pointer rounded-md bg-[#4a90e2] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3d7ec8]"
            >
              Generate
            </MotionButton>
          </div>
        ))}
      </div>
    </div>
  );
}
