import { RuntimeClient } from "@devin/agent-sdk";
import { EventBus } from "@devin/events";
import { createQueue, type TaskQueue } from "@devin/queue";
import type {
  CreateTaskInput,
  ScheduleJob,
  Task,
  TaskStatus,
} from "./types.js";

export interface TaskServiceOptions {
  orchestratorUrl: string;
  runtimeUrl: string;
  eventBus?: EventBus;
  queue?: TaskQueue<ScheduleJob>;
}

export class TaskService {
  private readonly tasks = new Map<string, Task>();
  private readonly eventBus: EventBus;
  private readonly queue: TaskQueue<ScheduleJob>;
  private readonly orchestratorUrl: string;
  private readonly runtimeUrl: string;
  private workerStarted = false;

  constructor(options: TaskServiceOptions) {
    this.orchestratorUrl = options.orchestratorUrl.replace(/\/$/, "");
    this.runtimeUrl = options.runtimeUrl.replace(/\/$/, "");
    this.eventBus = options.eventBus ?? new EventBus();
    this.queue = options.queue ?? createQueue<ScheduleJob>();
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  createTask(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      prompt: input.prompt.trim(),
      status: "queued",
      createdAt: now,
      updatedAt: now,
    };

    if (!task.prompt) {
      throw new Error("prompt is required");
    }

    this.tasks.set(task.id, task);
    this.emit("task.created", task.id, "Task accepted");

    void this.queue
      .enqueue({
        taskId: task.id,
        prompt: task.prompt,
        enqueuedAt: now,
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to enqueue task";
        this.updateTask(task.id, "failed", message);
        this.emit("task.failed", task.id, message);
      });

    return task;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): Task[] {
    return [...this.tasks.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  startWorker(): void {
    if (this.workerStarted) {
      return;
    }
    this.workerStarted = true;

    this.queue.startWorker(async (job) => {
      await this.processJob(job.payload);
    });
  }

  stopWorker(): void {
    this.queue.stopWorker?.();
    this.workerStarted = false;
  }

  private async processJob(job: ScheduleJob): Promise<void> {
    const task = this.tasks.get(job.taskId);
    if (!task) {
      return;
    }

    try {
      this.updateTask(task.id, "scheduling", "Scheduler picked up task");
      this.emit("task.scheduled", task.id, "Task scheduled");

      const sandboxName = `sbx-${task.id.slice(0, 8)}`;
      task.sandboxName = sandboxName;
      this.updateTask(task.id, "sandbox_starting", "Creating sandbox");

      const createResponse = await fetch(
        `${this.orchestratorUrl}/internal/v1/sandboxes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: sandboxName,
            spec: {
              taskId: task.id,
              cpu: 1,
              memory: "1Gi",
              image: "devin-runtime:latest",
            },
          }),
        },
      );

      if (!createResponse.ok) {
        throw new Error(
          `orchestrator rejected sandbox: ${createResponse.status}`,
        );
      }

      await this.waitForSandbox(sandboxName, task.id);
      this.emit("sandbox.started", task.id, "Sandbox pod is running", {
        sandboxName,
      });

      const runtime = new RuntimeClient({ baseUrl: this.runtimeUrl });
      await this.waitForRuntime(runtime, task.id);
      this.emit("runtime.ready", task.id, "Runtime supervisor is ready");

      this.updateTask(task.id, "running", "Agent executing task");
      this.emit("agent.running", task.id, "Agent started", {
        prompt: task.prompt,
      });

      const runResult = await runtime.run({
        taskId: task.id,
        prompt: task.prompt,
      });

      if (runResult.status === "failed") {
        throw new Error(runResult.message);
      }

      this.updateTask(
        task.id,
        "completed",
        runResult.message || "Task completed",
      );
      this.emit("task.completed", task.id, "Task completed", {
        output: runResult.output,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Task failed";
      this.updateTask(task.id, "failed", message);
      this.emit("task.failed", task.id, message);
      throw error;
    }
  }

  private async waitForSandbox(
    sandboxName: string,
    taskId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(
        `${this.orchestratorUrl}/internal/v1/sandboxes/${encodeURIComponent(sandboxName)}`,
      );
      if (response.ok) {
        const sandbox = (await response.json()) as {
          status?: { phase?: string };
        };
        if (sandbox.status?.phase === "Running") {
          return;
        }
      }
      await sleep(500);
    }
    throw new Error(
      `sandbox ${sandboxName} did not become ready for task ${taskId}`,
    );
  }

  private async waitForRuntime(
    runtime: RuntimeClient,
    taskId: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const health = await runtime.health();
        if (health.status === "ok") {
          return;
        }
      } catch {
        // runtime still booting
      }
      await sleep(500);
    }
    throw new Error(`runtime not ready for task ${taskId}`);
  }

  private updateTask(
    taskId: string,
    status: TaskStatus,
    message: string,
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    task.status = status;
    task.message = message;
    task.updatedAt = new Date().toISOString();
  }

  private emit(
    type:
      | "task.created"
      | "task.scheduled"
      | "sandbox.started"
      | "runtime.ready"
      | "agent.running"
      | "task.completed"
      | "task.failed",
    taskId: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.eventBus.publish({
      id: crypto.randomUUID(),
      taskId,
      type,
      message,
      timestamp: new Date().toISOString(),
      data,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
