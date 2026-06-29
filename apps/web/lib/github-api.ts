import { authConfig } from "@/lib/auth-config";

export interface GitHubPermissions {
  canCommit: boolean;
  canCreatePr: boolean;
  canCreateRepo: boolean;
  canCreateIssue: boolean;
  canPush: boolean;
}

export interface GitHubStatus {
  connected: boolean;
  username: string | null;
  scopes: string[];
  hasRepoAccess: boolean;
  permissions: GitHubPermissions;
  selectedRepository: string | null;
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  url: string;
  description: string | null;
}

const githubUrl = `${authConfig.baseURL}/api/v1/github`;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Request failed",
    );
  }
  return response.json() as Promise<T>;
}

export async function fetchGitHubStatus(): Promise<GitHubStatus> {
  const response = await fetch(`${githubUrl}/status`, {
    credentials: "include",
  });
  return parseResponse<GitHubStatus>(response);
}

export async function fetchGitHubRepos(): Promise<GitHubRepo[]> {
  const response = await fetch(`${githubUrl}/repos`, {
    credentials: "include",
  });
  const data = await parseResponse<{ repos: GitHubRepo[] }>(response);
  return data.repos;
}

export async function updateGitHubPermissions(
  permissions: GitHubPermissions,
): Promise<{ permissions: GitHubPermissions }> {
  const response = await fetch(`${githubUrl}/permissions`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(permissions),
  });
  return parseResponse<{ permissions: GitHubPermissions }>(response);
}

export async function selectGitHubRepository(
  fullName: string | null,
): Promise<{ selectedRepository: string | null; repositoryLabel: string }> {
  const response = await fetch(`${githubUrl}/repos/select`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullName }),
  });
  return parseResponse<{
    selectedRepository: string | null;
    repositoryLabel: string;
  }>(response);
}

export const GITHUB_REPO_SCOPES = ["repo"] as const;
