function readErrorBody(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return "Runtime request failed";
}

export async function parseRuntimeResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    status?: string;
  };

  if (!response.ok) {
    throw new Error(readErrorBody(body));
  }

  if (body && typeof body === "object") {
    const status = (body as { status?: string }).status;
    if (status === "failed" || status === "error") {
      throw new Error(readErrorBody(body));
    }
    if (
      "exitCode" in body &&
      typeof (body as { exitCode?: number }).exitCode === "number" &&
      (body as { exitCode: number }).exitCode !== 0
    ) {
      const stdout = (body as { stdout?: string }).stdout ?? "";
      const stderr = (body as { stderr?: string }).stderr ?? "";
      throw new Error(stderr || stdout || "Command failed");
    }
  }

  return body;
}
