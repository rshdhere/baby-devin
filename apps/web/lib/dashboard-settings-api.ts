import { authConfig } from "@/lib/auth-config";

export interface DashboardSettings {
  repositoryLabel: string;
  environment: string;
}

const settingsUrl = `${authConfig.baseURL}/api/v1/settings/dashboard`;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Request failed",
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchDashboardSettings() {
  const response = await fetch(settingsUrl, {
    credentials: "include",
  });

  return parseResponse<DashboardSettings>(response);
}

export async function updateDashboardSettings(data: DashboardSettings) {
  const response = await fetch(settingsUrl, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return parseResponse<DashboardSettings>(response);
}

export const repositoryOptions = [
  "No repositories",
  "1 repository",
  "5 repositories",
  "10 repositories",
  "25 repositories",
  "99+ repositories",
] as const;

export const environmentOptions = [
  "Ubuntu",
  "Debian",
  "Amazon Linux",
  "macOS",
] as const;
