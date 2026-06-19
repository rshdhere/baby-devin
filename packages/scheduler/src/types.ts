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

export interface GitHubPermissions {
  canCommit: boolean;
  canCreatePr: boolean;
  canPush: boolean;
}

export interface Task {
  id: string;
  prompt: string;
  agent: AgentProvider;
  status: TaskStatus;
  userId?: string;
  repository?: string;
  branch?: string;
  prUrl?: string;
  sandboxName?: string;
  message?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  prompt: string;
  agent?: AgentProvider;
  userId?: string;
  repository?: string;
  cloneUrl?: string;
  githubToken?: string;
  permissions?: GitHubPermissions;
}

export interface ScheduleJob {
  taskId: string;
  prompt: string;
  agent: AgentProvider;
  userId?: string;
  repository?: string;
  cloneUrl?: string;
  githubToken?: string;
  permissions?: GitHubPermissions;
  enqueuedAt: string;
}
