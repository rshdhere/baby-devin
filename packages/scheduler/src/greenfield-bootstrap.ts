import type { RuntimeClient } from "@devin/agent-sdk";

export type BootstrapEmitter = (
  type: string,
  message: string,
  data?: Record<string, unknown>,
) => void;

function looksLikeNodeProject(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("node") ||
    lower.includes("express") ||
    lower.includes("todo") ||
    lower.includes("api") ||
    lower.includes("javascript") ||
    lower.includes("typescript") ||
    lower.includes("app")
  );
}

function buildCommitMessage(
  subject: string,
  botName: string,
  botEmail: string,
) {
  return `${subject}\n\nCo-authored-by: ${botName} <${botEmail}>`;
}

async function repositoryHasCommits(
  runtime: RuntimeClient,
  taskId: string,
  repoCwd: string,
  env?: Record<string, string>,
): Promise<boolean> {
  const result = await runtime.terminal({
    taskId,
    cwd: repoCwd,
    env,
    command:
      "git rev-parse --verify HEAD >/dev/null 2>&1 && echo yes || echo no",
  });
  return result.stdout.trim() === "yes";
}

export async function bootstrapGreenfieldProject(opts: {
  runtime: RuntimeClient;
  taskId: string;
  repoCwd: string;
  prompt: string;
  title: string;
  botName: string;
  botEmail: string;
  canPush: boolean;
  githubToken?: string;
  cloneUrl?: string;
  emit: BootstrapEmitter;
}): Promise<void> {
  const gitEnv = opts.githubToken
    ? { GITHUB_TOKEN: opts.githubToken }
    : undefined;

  if (
    await repositoryHasCommits(opts.runtime, opts.taskId, opts.repoCwd, gitEnv)
  ) {
    opts.emit(
      "agent.log",
      "Repository already has commits, skipping bootstrap",
      {
        skipped: true,
      },
    );
    return;
  }

  opts.emit("agent.log", "Bootstrapping project scaffold", {
    stack: looksLikeNodeProject(opts.prompt) ? "nodejs" : "minimal",
  });

  const readme = `# ${opts.title}

${opts.prompt}

## Getting started

Scaffold created by Devin. The agent will implement the requested functionality next.
`;

  await opts.runtime.writeFile({
    path: `${opts.repoCwd}/README.md`,
    content: readme,
  });
  await opts.runtime.writeFile({
    path: `${opts.repoCwd}/.gitignore`,
    content: "node_modules/\n.env\n.DS_Store\n",
  });

  const commitPaths = ["README.md", ".gitignore"];

  if (looksLikeNodeProject(opts.prompt)) {
    const serverJs = `const express = require("express");

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(\`Server listening on port \${port}\`);
});
`;

    await opts.runtime.writeFile({
      path: `${opts.repoCwd}/server.js`,
      content: serverJs,
    });

    await opts.runtime.terminal({
      taskId: opts.taskId,
      cwd: opts.repoCwd,
      env: gitEnv,
      command: "npm init -y && npm install express",
    });

    await opts.runtime.terminal({
      taskId: opts.taskId,
      cwd: opts.repoCwd,
      env: gitEnv,
      command:
        "node -e \"const pkg=require('./package.json'); pkg.main='server.js'; pkg.scripts={start:'node server.js'}; require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));\"",
    });

    commitPaths.push("server.js", "package.json", "package-lock.json");
  }

  const commitMessage = buildCommitMessage(
    `devin: bootstrap ${opts.title}`,
    opts.botName,
    opts.botEmail,
  );

  await opts.runtime.gitCommit({
    taskId: opts.taskId,
    cwd: opts.repoCwd,
    env: gitEnv,
    message: commitMessage,
    paths: commitPaths,
  });

  opts.emit("git.commit", "Bootstrapped initial project scaffold", {
    auto: true,
    bootstrap: true,
  });

  if (!opts.canPush) {
    return;
  }

  if (opts.cloneUrl && opts.githubToken) {
    await opts.runtime.terminal({
      taskId: opts.taskId,
      cwd: opts.repoCwd,
      env: gitEnv,
      command: [
        `git remote set-url origin '${opts.cloneUrl.replace(/'/g, `'\"'\"'`)}'`,
        `printf '%s' "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true`,
        "gh auth setup-git 2>/dev/null || true",
      ].join(" && "),
    });
  }

  await opts.runtime.gitPush({
    taskId: opts.taskId,
    cwd: opts.repoCwd,
    env: gitEnv,
    branch: "main",
  });

  opts.emit("git.push", "Pushed bootstrap scaffold to main", {
    branch: "main",
    bootstrap: true,
  });
}
