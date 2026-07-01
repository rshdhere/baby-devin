export interface CreatedRepository {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
}

export interface GitHubUserIdentity {
  login: string;
  name: string;
  email: string;
}

export interface CreatedIssue {
  htmlUrl: string;
  number: number;
}

export function authenticatedCloneUrl(
  token: string,
  repository: string,
): string {
  return `https://x-access-token:${token}@github.com/${repository}.git`;
}

export async function fetchGitHubUserIdentity(
  token: string,
): Promise<GitHubUserIdentity> {
  const user = await githubApiRequest<{
    login: string;
    name?: string | null;
    id: number;
    email?: string | null;
  }>(token, "/user");

  let email = user.email?.trim();
  if (!email) {
    try {
      const emails = await githubApiRequest<
        Array<{ email: string; primary?: boolean; verified?: boolean }>
      >(token, "/user/emails");
      const primary =
        emails.find((entry) => entry.primary && entry.verified) ??
        emails.find((entry) => entry.verified) ??
        emails[0];
      email = primary?.email?.trim();
    } catch {
      // fall back to GitHub noreply address
    }
  }

  return {
    login: user.login,
    name: user.name?.trim() || user.login,
    email: email ?? `${user.id}+${user.login}@users.noreply.github.com`,
  };
}

async function githubApiRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function createGitHubRepository(
  token: string,
  name: string,
  opts?: { description?: string; private?: boolean },
): Promise<CreatedRepository> {
  const response = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      name,
      description: opts?.description,
      private: opts?.private ?? false,
      auto_init: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub repo create error ${response.status}: ${body}`);
  }

  const repo = (await response.json()) as {
    full_name: string;
    html_url: string;
    default_branch?: string;
  };

  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch ?? "main",
  };
}

export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  opts: { title: string; body?: string },
): Promise<CreatedIssue> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: opts.title,
        body: opts.body,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub issue error ${response.status}: ${body}`);
  }

  const issue = (await response.json()) as {
    html_url: string;
    number: number;
  };

  return {
    htmlUrl: issue.html_url,
    number: issue.number,
  };
}

export async function fetchDefaultBranch(
  token: string,
  owner: string,
  repo: string,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    return "main";
  }
  const data = (await response.json()) as { default_branch?: string };
  return data.default_branch ?? "main";
}

export async function createGitHubPullRequest(
  token: string,
  owner: string,
  repo: string,
  opts: { title: string; body: string; head: string; base: string },
): Promise<{ html_url: string; number: number }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(opts),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub PR error ${response.status}: ${body}`);
  }
  return response.json() as Promise<{ html_url: string; number: number }>;
}
