"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, GitBranch, Sparkles } from "lucide-react";
import {
  environmentOptions,
  fetchDashboardSettings,
  repositoryOptions,
  updateDashboardSettings,
} from "@/lib/dashboard-settings-api";
import { MotionButton } from "@/components/dashboard/motion-button";
import { cn } from "@/lib/utils";

type MenuKind = "repositories" | "environment" | null;

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

function MetadataMenu({
  open,
  position,
  children,
  onClose,
}: {
  open: boolean;
  position: MenuPosition | null;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-metadata-menu]")) {
        return;
      }
      if (target.closest("[data-metadata-trigger]")) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  if (!open || !position) {
    return null;
  }

  return createPortal(
    <div
      data-metadata-menu
      className="fixed z-[200] overflow-hidden rounded-xl border border-[#333] bg-[#1e1e1e] py-1 shadow-2xl"
      style={{
        top: position.top,
        left: position.left,
        minWidth: position.width,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function PromptMetadataBar() {
  const [repositoryLabel, setRepositoryLabel] = useState("99+ repositories");
  const [environment, setEnvironment] = useState("Ubuntu");
  const [openMenu, setOpenMenu] = useState<MenuKind>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [customRepository, setCustomRepository] = useState("");
  const [customEnvironment, setCustomEnvironment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const repositoryTriggerRef = useRef<HTMLButtonElement>(null);
  const environmentTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetchDashboardSettings()
      .then((settings) => {
        if (!cancelled) {
          setRepositoryLabel(settings.repositoryLabel);
          setEnvironment(settings.environment);
          setCustomRepository(settings.repositoryLabel);
          setCustomEnvironment(settings.environment);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load saved settings");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openMenuAt(kind: MenuKind, trigger: HTMLButtonElement | null) {
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, kind === "repositories" ? 200 : 180),
    });
    setOpenMenu(kind);
    setError(null);
  }

  function toggleMenu(
    kind: Exclude<MenuKind, null>,
    trigger: HTMLButtonElement | null,
  ) {
    if (openMenu === kind) {
      setOpenMenu(null);
      setMenuPosition(null);
      return;
    }

    openMenuAt(kind, trigger);
  }

  async function persist(next: {
    repositoryLabel: string;
    environment: string;
  }) {
    setIsSaving(true);
    setError(null);

    try {
      const saved = await updateDashboardSettings(next);
      setRepositoryLabel(saved.repositoryLabel);
      setEnvironment(saved.environment);
      setCustomRepository(saved.repositoryLabel);
      setCustomEnvironment(saved.environment);
      setOpenMenu(null);
      setMenuPosition(null);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function selectRepository(label: string) {
    void persist({ repositoryLabel: label, environment });
  }

  function selectEnvironment(value: string) {
    void persist({ repositoryLabel, environment: value });
  }

  function saveCustomRepository() {
    const value = customRepository.trim();
    if (!value) {
      return;
    }
    void persist({ repositoryLabel: value, environment });
  }

  function saveCustomEnvironment() {
    const value = customEnvironment.trim();
    if (!value) {
      return;
    }
    void persist({ repositoryLabel, environment: value });
  }

  return (
    <>
      <div className="relative mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-gray-500">
        <MotionButton
          ref={repositoryTriggerRef}
          type="button"
          data-metadata-trigger
          disabled={isSaving}
          onClick={() =>
            toggleMenu("repositories", repositoryTriggerRef.current)
          }
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-[#1a1a1a] hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GitBranch className="size-3.5" />
          {repositoryLabel}
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              openMenu === "repositories" && "rotate-180",
            )}
          />
        </MotionButton>

        <MotionButton
          ref={environmentTriggerRef}
          type="button"
          data-metadata-trigger
          disabled={isSaving}
          onClick={() =>
            toggleMenu("environment", environmentTriggerRef.current)
          }
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-[#1a1a1a] hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {environment}
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              openMenu === "environment" && "rotate-180",
            )}
          />
        </MotionButton>

        <MotionButton
          type="button"
          className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-gray-400"
        >
          <Sparkles className="size-3" />
          Upgrade plan
        </MotionButton>
        <MotionButton
          type="button"
          className="cursor-pointer transition-colors hover:text-gray-400"
        >
          Advanced capabilities →
        </MotionButton>
      </div>

      {error ? (
        <p className="mt-2 text-center text-[12px] text-red-400">{error}</p>
      ) : null}

      <MetadataMenu
        open={openMenu === "repositories"}
        position={menuPosition}
        onClose={() => {
          setOpenMenu(null);
          setMenuPosition(null);
        }}
      >
        {repositoryOptions.map((option) => (
          <MotionButton
            key={option}
            type="button"
            disabled={isSaving}
            onClick={() => selectRepository(option)}
            className={cn(
              "flex w-full cursor-pointer px-3 py-2 text-left text-[13px] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed",
              repositoryLabel === option ? "text-white" : "text-gray-400",
            )}
          >
            {option}
          </MotionButton>
        ))}
        <div className="border-t border-[#2a2a2a] p-2">
          <p className="mb-1.5 px-1 text-[11px] text-gray-500">Custom label</p>
          <div className="flex gap-2">
            <input
              value={customRepository}
              onChange={(event) => setCustomRepository(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveCustomRepository();
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-[#333] bg-[#141414] px-2 py-1.5 text-[13px] text-white outline-none focus:border-[#555]"
              placeholder="e.g. 12 repositories"
            />
            <MotionButton
              type="button"
              pressStyle="primary"
              disabled={isSaving || !customRepository.trim()}
              onClick={saveCustomRepository}
              className="cursor-pointer rounded-md bg-[#333] px-2.5 py-1.5 text-[12px] text-white transition-colors hover:bg-[#444] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </MotionButton>
          </div>
        </div>
      </MetadataMenu>

      <MetadataMenu
        open={openMenu === "environment"}
        position={menuPosition}
        onClose={() => {
          setOpenMenu(null);
          setMenuPosition(null);
        }}
      >
        {environmentOptions.map((option) => (
          <MotionButton
            key={option}
            type="button"
            disabled={isSaving}
            onClick={() => selectEnvironment(option)}
            className={cn(
              "flex w-full cursor-pointer px-3 py-2 text-left text-[13px] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed",
              environment === option ? "text-white" : "text-gray-400",
            )}
          >
            {option}
          </MotionButton>
        ))}
        <div className="border-t border-[#2a2a2a] p-2">
          <p className="mb-1.5 px-1 text-[11px] text-gray-500">
            Custom environment
          </p>
          <div className="flex gap-2">
            <input
              value={customEnvironment}
              onChange={(event) => setCustomEnvironment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  saveCustomEnvironment();
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-[#333] bg-[#141414] px-2 py-1.5 text-[13px] text-white outline-none focus:border-[#555]"
              placeholder="e.g. Ubuntu 24.04"
            />
            <MotionButton
              type="button"
              pressStyle="primary"
              disabled={isSaving || !customEnvironment.trim()}
              onClick={saveCustomEnvironment}
              className="cursor-pointer rounded-md bg-[#333] px-2.5 py-1.5 text-[12px] text-white transition-colors hover:bg-[#444] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </MotionButton>
          </div>
        </div>
      </MetadataMenu>
    </>
  );
}
