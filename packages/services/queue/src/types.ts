export interface QueueJob<T> {
  id: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: string;
}

export type QueueHandler<T> = (job: QueueJob<T>) => Promise<void>;

export interface TaskQueue<T> {
  enqueue(payload: T, maxAttempts?: number): Promise<QueueJob<T>>;
  startWorker(handler: QueueHandler<T>): void;
  stopWorker?(): void;
}
