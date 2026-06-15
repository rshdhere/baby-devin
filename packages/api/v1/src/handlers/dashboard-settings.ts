import { db } from "@devin/drizzle";
import { userDashboardSettings } from "@devin/drizzle/schema";
import { dashboardSettingsSchema } from "@devin/validators";
import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import { requireAuth } from "../middleware/require-auth.js";

export const dashboardSettingsRouter = Router();

const defaultSettings = {
  repositoryLabel: "99+ repositories",
  environment: "Ubuntu",
} as const;

async function getOrCreateSettings(userId: string) {
  const existing = await db
    .select()
    .from(userDashboardSettings)
    .where(eq(userDashboardSettings.userId, userId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [created] = await db
    .insert(userDashboardSettings)
    .values({
      userId,
      repositoryLabel: defaultSettings.repositoryLabel,
      environment: defaultSettings.environment,
    })
    .returning();

  return created!;
}

export async function getDashboardSettingsHandler(req: Request, res: Response) {
  const userId = req.auth?.user.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const settings = await getOrCreateSettings(userId);

  res.status(200).json({
    repositoryLabel: settings.repositoryLabel,
    environment: settings.environment,
  });
}

export async function updateDashboardSettingsHandler(
  req: Request,
  res: Response,
) {
  const userId = req.auth?.user.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = dashboardSettingsSchema.update.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid settings",
      details: parsed.error.flatten(),
    });
    return;
  }

  await getOrCreateSettings(userId);

  const [updated] = await db
    .update(userDashboardSettings)
    .set(parsed.data)
    .where(eq(userDashboardSettings.userId, userId))
    .returning();

  res.status(200).json({
    repositoryLabel: updated!.repositoryLabel,
    environment: updated!.environment,
  });
}

dashboardSettingsRouter.get(
  "/dashboard",
  requireAuth,
  getDashboardSettingsHandler,
);
dashboardSettingsRouter.patch(
  "/dashboard",
  requireAuth,
  updateDashboardSettingsHandler,
);
