import { Router } from "express";
import { dashboardSettingsRouter } from "../handlers/dashboard-settings.js";
import { healthRouter } from "../handlers/health.js";

export const router = Router();

router.use(healthRouter);
router.use("/settings", dashboardSettingsRouter);
