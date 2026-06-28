import { authConfig } from "@/lib/auth-config";

export type AgentProvider = "cursor" | "claude" | "mock";

export type TaskStatus =
  | "queued"
  | "scheduling"
  | "sandbox_starting"
  | "runtime_ready"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  id: string;
  prompt: string;
  agent: AgentProvider;
  status: TaskStatus;
  userId?: string;
  repository?: string;
  branch?: string;
  prUrl?: string;
  title?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskEventType =
  | "task.created"
  | "task.scheduled"
  | "sandbox.started"
  | "runtime.ready"
  | "agent.running"
  | "agent.log"
  | "agent.tool"
  | "git.clone"
  | "git.commit"
  | "git.push"
  | "git.pr"
  | "task.completed"
  | "task.failed";

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const tasksUrl = `${authConfig.baseURL}/api/v1/tasks`;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Request failed",
    );
  }
  return response.json() as Promise<T>;
}

export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch(tasksUrl, { credentials: "include" });
  return parseResponse<Task[]>(response);
}

export async function createTask(input: {
  prompt: string;
  agent?: AgentProvider;
  repository?: string;
}): Promise<Task> {
  const response = await fetch(tasksUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<Task>(response);
}

export async function fetchTask(id: string): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  return parseResponse<Task>(response);
}

export function subscribeToTaskEvents(
  taskId: string,
  onEvent: (event: TaskEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(
        `${tasksUrl}/${encodeURIComponent(taskId)}/events`,
        {
          credentials: "include",
          signal: controller.signal,
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to event stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let splitIndex = buffer.indexOf("\n\n");

        while (splitIndex >= 0) {
          const chunk = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);

          const dataLine = chunk
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (dataLine) {
            try {
              const event = JSON.parse(dataLine.slice(6)) as TaskEvent;
              onEvent(event);
            } catch {
              // ignore malformed events
            }
          }

          splitIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      onError?.(
        error instanceof Error ? error : new Error("Event stream error"),
      );
    }
  })();

  return () => controller.abort();
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "scheduling":
      return "Scheduling";
    case "sandbox_starting":
      return "Starting sandbox";
    case "runtime_ready":
      return "Runtime ready";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}
