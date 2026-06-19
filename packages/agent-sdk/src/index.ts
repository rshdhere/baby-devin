export interface RunRequest {
  taskId: string;
  prompt: string;
}

export interface RunResponse {
  taskId: string;
  status: "accepted" | "running" | "completed" | "failed";
  message: string;
  output?: string;
}

export interface TerminalRequest {
  command: string;
  cwd?: string;
}

export interface GitCloneRequest {
  url: string;
  path?: string;
}

export interface GitCommitRequest {
  message: string;
  paths?: string[];
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface BrowserOpenRequest {
  url: string;
}

export interface RuntimeHealthResponse {
  status: "ok";
  taskId?: string;
}

export interface RuntimeClientOptions {
  baseUrl: string;
}

export class RuntimeClient {
  constructor(private readonly options: RuntimeClientOptions) {}

  async run(body: RunRequest): Promise<RunResponse> {
    const response = await fetch(`${this.options.baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json() as Promise<RunResponse>;
  }

  async health(): Promise<RuntimeHealthResponse> {
    const response = await fetch(`${this.options.baseUrl}/health`);
    return response.json() as Promise<RuntimeHealthResponse>;
  }
}
