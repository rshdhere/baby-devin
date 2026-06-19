"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";
import { MotionButton } from "@/components/dashboard/motion-button";
import { useSessions } from "@/components/dashboard/sessions-context";
import {
  fetchTask,
  subscribeToTaskEvents,
  taskStatusLabel,
  type Task,
  type TaskEvent,
} from "@/lib/tasks-api";
import { cn } from "@/lib/utils";

interface SessionDetailProps {
  task: Task;
  onBack: () => void;
}

function eventIcon(type: TaskEvent["type"]) {
  if (type.startsWith("git.")) {
    if (type === "git.pr") return GitPullRequest;
    if (type === "git.commit") return GitCommit;
    return GitBranch;
  }
  if (type === "task.completed") return CheckCircle2;
  if (type === "task.failed") return XCircle;
  return Terminal;
}

function eventColor(type: TaskEvent["type"]) {
  if (type === "task.completed") return "text-emerald-400";
  if (type === "task.failed") return "text-red-400";
  if (type.startsWith("git.")) return "text-[#5a9fd4]";
  return "text-gray-400";
}

export function SessionDetail({
  task: initialTask,
  onBack,
}: SessionDetailProps) {
  const { refreshTasks } = useSessions();
  const [task, setTask] = useState(initialTask);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTask(initialTask);
  }, [initialTask]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents(
      task.id,
      (event) => {
        setEvents((current) => [...current, event]);

        if (event.type === "task.completed" || event.type === "task.failed") {
          void fetchTask(task.id).then((updated) => {
            setTask(updated);
            void refreshTasks();
          });
        }
      },
      (error) => setStreamError(error.message),
    );

    return unsubscribe;
  }, [task.id, refreshTasks]);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [events.length]);

  const isActive =
    task.status !== "completed" &&
    task.status !== "failed" &&
    task.status !== "cancelled";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mb-4 flex items-center gap-3">
        <MotionButton
          type="button"
          pressStyle="icon"
          onClick={onBack}
          className="cursor-pointer rounded-lg p-2 text-gray-500 transition-colors hover:bg-[#1a1a1a] hover:text-gray-300"
          aria-label="Back to composer"
        >
          <ArrowLeft className="size-4" />
        </MotionButton>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-medium text-white">
            {task.title ?? task.prompt}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isActive ? "text-[#5a9fd4]" : "text-gray-500",
              )}
            >
              {isActive ? <Loader2 className="size-3 animate-spin" /> : null}
              {taskStatusLabel(task.status)}
            </span>
            {task.repository ? (
              <>
                <span>•</span>
                <span>{task.repository}</span>
              </>
            ) : null}
            {task.branch ? (
              <>
                <span>•</span>
                <span className="text-gray-600">{task.branch}</span>
              </>
            ) : null}
          </div>
        </div>

        {task.prUrl ? (
          <a
            href={task.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#5a9fd4] transition-colors hover:bg-[#222]"
          >
            View PR
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <div className="mb-4 rounded-xl border border-[#2a2a2a] bg-[#141414] px-4 py-3">
        <p className="text-[13px] leading-relaxed text-gray-300">
          {task.prompt}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111]">
        <div className="border-b border-[#252525] px-4 py-2.5">
          <h2 className="text-[13px] font-medium text-gray-400">Activity</h2>
        </div>

        <div
          ref={feedRef}
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3"
        >
          {events.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-4 text-[13px] text-gray-600">
              <Loader2 className="size-4 animate-spin" />
              Waiting for agent activity…
            </div>
          ) : (
            events.map((event) => {
              const Icon = eventIcon(event.type);
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[#1a1a1a]/50"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      eventColor(event.type),
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-gray-300">{event.message}</p>
                    <p className="mt-0.5 text-[11px] text-gray-600">
                      {new Date(event.timestamp).toLocaleTimeString()}
                      {event.data?.prUrl ? (
                        <>
                          {" "}
                          •{" "}
                          <a
                            href={String(event.data.prUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5a9fd4] hover:underline"
                          >
                            Open PR
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {streamError ? (
          <p className="border-t border-[#252525] px-4 py-2 text-[12px] text-red-400">
            {streamError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
