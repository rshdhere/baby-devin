import { Router } from "express";
import {
  createTask,
  getTask,
  listTasks,
  streamTaskEvents,
} from "../lib/scheduler.js";
import { requireAuth } from "../middleware/require-auth.js";

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

tasksRouter.get("/", async (_req, res) => {
  const response = await listTasks();
  res.status(response.status).json(await response.json());
});

tasksRouter.post("/", async (req, res) => {
  const response = await createTask(req.body);
  res.status(response.status).json(await response.json());
});

tasksRouter.get("/:id", async (req, res) => {
  const response = await getTask(req.params.id);
  res.status(response.status).json(await response.json());
});

tasksRouter.get("/:id/events", async (req, res) => {
  const response = await streamTaskEvents(req.params.id);

  if (!response.ok || !response.body) {
    res.status(response.status).json(await response.json());
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  req.on("close", () => {
    void reader.cancel();
  });

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    res.write(decoder.decode(value, { stream: true }));
  }

  res.end();
});
