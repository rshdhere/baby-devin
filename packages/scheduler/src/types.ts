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
  status: TaskStatus;
  sandboxName?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  prompt: string;
}

export interface ScheduleJob {
  taskId: string;
  prompt: string;
  enqueuedAt: string;
}
