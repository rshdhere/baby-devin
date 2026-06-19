import type { QueueHandler, QueueJob, TaskQueue } from "./types.js";

export class InMemoryQueue<T> implements TaskQueue<T> {
  private pending: QueueJob<T>[] = [];
  private processing = false;
  private handler: QueueHandler<T> | null = null;
  private running = false;

  async enqueue(payload: T, maxAttempts = 3): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: crypto.randomUUID(),
      payload,
      attempts: 0,
      maxAttempts,
      enqueuedAt: new Date().toISOString(),
    };
    this.pending.push(job);
    void this.process();
    return job;
  }

  startWorker(handler: QueueHandler<T>): void {
    this.handler = handler;
    this.running = true;
    void this.process();
  }

  stopWorker(): void {
    this.running = false;
    this.handler = null;
  }

  size(): number {
    return this.pending.length;
  }

  private async process(): Promise<void> {
    if (this.processing || !this.handler || !this.running) {
      return;
    }

    this.processing = true;
    while (this.pending.length > 0 && this.running && this.handler) {
      const job = this.pending.shift();
      if (!job || !this.handler) {
        continue;
      }

      job.attempts += 1;
      try {
        await this.handler(job);
      } catch {
        if (job.attempts < job.maxAttempts) {
          this.pending.push(job);
        }
      }
    }
    this.processing = false;
  }
}
