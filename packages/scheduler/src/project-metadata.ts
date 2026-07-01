export interface ProjectMetadata {
  title: string;
  repoName: string;
  description: string;
}

function slugifyRepoName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "devin-project";
}

function fallbackMetadata(prompt: string): ProjectMetadata {
  const trimmed = prompt.trim();
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() ?? trimmed;
  const title =
    firstSentence.length > 72
      ? `${firstSentence.slice(0, 69).trim()}…`
      : firstSentence;

  return {
    title,
    repoName: slugifyRepoName(title),
    description: trimmed.slice(0, 200),
  };
}

function parseMetadataJson(
  raw: string,
  prompt: string,
): ProjectMetadata | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as {
      title?: string;
      repoName?: string;
      description?: string;
    };
    const title = parsed.title?.trim();
    const repoName = parsed.repoName?.trim();
    if (!title || !repoName) {
      return null;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(repoName)) {
      return null;
    }

    return {
      title: title.slice(0, 80),
      repoName: repoName.slice(0, 40),
      description: (parsed.description?.trim() || prompt).slice(0, 200),
    };
  } catch {
    return null;
  }
}

async function generateWithAnthropic(
  prompt: string,
  apiKey: string,
): Promise<ProjectMetadata> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            "You name greenfield software projects for GitHub.",
            "Return ONLY valid JSON with keys: title, repoName, description.",
            "title: short human-readable project name (max 72 chars).",
            "repoName: lowercase kebab-case GitHub repo slug (max 40 chars, no leading/trailing hyphen).",
            "description: one sentence repo description (max 200 chars).",
            "",
            `User request: ${prompt}`,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic response missing text");
  }

  const parsed = parseMetadataJson(text, prompt);
  if (!parsed) {
    throw new Error("Anthropic response was not valid project metadata JSON");
  }

  return parsed;
}

export async function generateProjectMetadata(
  prompt: string,
): Promise<ProjectMetadata> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return fallbackMetadata(prompt);
  }

  try {
    return await generateWithAnthropic(prompt, apiKey);
  } catch {
    return fallbackMetadata(prompt);
  }
}
