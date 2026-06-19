import { Router } from "express";
import { dashboardSettingsRouter } from "../handlers/dashboard-settings.js";
import { healthRouter } from "../handlers/health.js";
import { tasksRouter } from "../handlers/tasks.js";

export const router = Router();

router.use(healthRouter);
router.use("/settings", dashboardSettingsRouter);
router.use("/tasks", tasksRouter);
