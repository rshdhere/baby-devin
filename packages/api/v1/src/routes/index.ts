import { Router } from "express";
import { dashboardSettingsRouter } from "../handlers/dashboard-settings.js";
import { githubRouter } from "../handlers/github.js";
import { healthRouter } from "../handlers/health.js";
import { tasksRouter } from "../handlers/tasks.js";

export const router = Router();

router.use(healthRouter);
router.use("/settings", dashboardSettingsRouter);
router.use("/github", githubRouter);
router.use("/tasks", tasksRouter);
