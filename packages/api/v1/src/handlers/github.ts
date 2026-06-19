import { db } from "@devin/drizzle";
import { userDashboardSettings } from "@devin/drizzle/schema";
import { githubPermissionsSchema } from "@devin/validators";
import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import {
  getGitHubAccessToken,
  getGitHubConnectionStatus,
  listUserRepos,
} from "../lib/github.js";
import { requireAuth } from "../middleware/require-auth.js";

export const githubRouter = Router();

githubRouter.use(requireAuth);

githubRouter.get("/status", async (req, res) => {
  const userId = req.auth?.user.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const status = await getGitHubConnectionStatus(userId);

  const [settings] = await db
    .select()
    .from(userDashboardSettings)
    .where(eq(userDashboardSettings.userId, userId))
    .limit(1);

  res.status(200).json({
    ...status,
    permissions: {
      canCommit: settings?.githubCanCommit ?? true,
      canCreatePr: settings?.githubCanCreatePr ?? true,
      canPush: settings?.githubCanPush ?? true,
    },
    selectedRepository: settings?.selectedRepository ?? null,
  });
});

githubRouter.get("/repos", async (req, res) => {
  const userId = req.auth?.user.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = await getGitHubAccessToken(userId);
  if (!token) {
    res.status(400).json({ error: "GitHub account not connected" });
    return;
  }

  try {
    const repos = await listUserRepos(token);
    res.status(200).json({
      repos: repos.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        name: repo.name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        description: repo.description,
      })),
    });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error ? error.message : "Failed to fetch repositories",
    });
  }
});

githubRouter.patch("/permissions", async (req, res) => {
  const userId = req.auth?.user.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = githubPermissionsSchema.update.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid permissions",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { canCommit, canCreatePr, canPush } = parsed.data;

  await db
    .insert(userDashboardSettings)
    .values({
      userId,
      githubCanCommit: canCommit,
      githubCanCreatePr: canCreatePr,
      githubCanPush: canPush,
    })
    .onConflictDoUpdate({
      target: userDashboardSettings.userId,
      set: {
        githubCanCommit: canCommit,
        githubCanCreatePr: canCreatePr,
        githubCanPush: canPush,
      },
    });

  res.status(200).json({
    permissions: {
      canCommit,
      canCreatePr,
      canPush,
    },
  });
});

export async function selectRepositoryHandler(req: Request, res: Response) {
  const userId = req.auth?.user.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { fullName } = req.body as { fullName?: string | null };

  if (fullName !== null && fullName !== undefined) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) {
      res.status(400).json({ error: "Invalid repository format" });
      return;
    }
  }

  const label = fullName ?? "No repository selected";

  await db
    .insert(userDashboardSettings)
    .values({
      userId,
      selectedRepository: fullName,
      repositoryLabel: label,
    })
    .onConflictDoUpdate({
      target: userDashboardSettings.userId,
      set: {
        selectedRepository: fullName,
        repositoryLabel: label,
      },
    });

  res.status(200).json({
    selectedRepository: fullName,
    repositoryLabel: label,
  });
}

githubRouter.post("/repos/select", selectRepositoryHandler);
