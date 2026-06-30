function parseOriginList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function deriveWildcardOrigins(urls: string[]): string[] {
  const derived = new Set<string>();

  for (const url of urls) {
    try {
      const { protocol, hostname } = new URL(url);

      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".localhost")
      ) {
        continue;
      }

      const parts = hostname.split(".");
      if (parts.length < 2) {
        continue;
      }

      const rootDomain = parts.slice(-2).join(".");
      derived.add(`${protocol}//${rootDomain}`);
      derived.add(`${protocol}//*.${rootDomain}`);
    } catch {
      continue;
    }
  }

  return [...derived];
}

function matchesWildcardOrigin(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return origin === pattern;
  }

  try {
    const originUrl = new URL(origin);
    const [patternProtocol, patternRest] = pattern.split("://");

    if (originUrl.protocol !== `${patternProtocol}:`) {
      return false;
    }

    const patternHost = patternRest?.split("/")[0] ?? "";
    if (!patternHost.startsWith("*.")) {
      return false;
    }

    const rootDomain = patternHost.slice(2);

    return (
      originUrl.hostname === rootDomain ||
      originUrl.hostname.endsWith(`.${rootDomain}`)
    );
  } catch {
    return false;
  }
}

export function getAllowedOrigins(): string[] {
  const explicitOrigins = [
    process.env.WEB_APP_URL ?? "http://localhost:3000",
    process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
    ...parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
  ];

  const origins = new Set<string>([
    ...explicitOrigins,
    ...deriveWildcardOrigins(explicitOrigins),
  ]);

  return [...origins];
}

export function isAllowedOrigin(origin: string | undefined): origin is string {
  if (!origin) {
    return false;
  }

  return getAllowedOrigins().some((pattern) =>
    matchesWildcardOrigin(origin, pattern),
  );
}
