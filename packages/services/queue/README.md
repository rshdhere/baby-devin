# Queue (`@devin/queue`)

Task scheduling queue for devin.baby. Lives under `packages/services/queue` alongside other integration services (email, etc.).

## Drivers

| Driver | Env | Use case |
| --- | --- | --- |
| `memory` | `QUEUE_DRIVER=memory` (default) | Local dev, single-process scheduler |
| `sqs` | `QUEUE_DRIVER=sqs` | Production on AWS — durable, retries, horizontal workers |

## Why SQS for production?

- **Durable** — tasks survive scheduler restarts
- **Decoupled** — API/scheduler can scale independently from workers
- **Built-in retries** — visibility timeout + DLQ (configure on the AWS queue)
- **Concurrency control** — multiple scheduler replicas poll the same queue safely

Keep `memory` for local development so you don't need AWS credentials on every laptop.

## Configuration

### In-memory (default)

```env
QUEUE_DRIVER=memory
```

### Amazon SQS

```env
QUEUE_DRIVER=sqs
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/devin-baby-tasks
AWS_REGION=us-east-1
# optional tuning
SQS_WAIT_TIME_SECONDS=20
SQS_VISIBILITY_TIMEOUT_SECONDS=300
```

Create the queue in AWS with a dead-letter queue for tasks that exceed `maxAttempts`.

## Usage

```typescript
import { createQueue } from "@devin/queue";

const queue = createQueue<ScheduleJob>();

queue.startWorker(async (job) => {
  await processTask(job.payload);
});

await queue.enqueue({ taskId: "...", prompt: "...", enqueuedAt: new Date().toISOString() });
```
