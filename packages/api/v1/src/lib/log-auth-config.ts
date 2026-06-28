import {
  getAuthPublicBaseUrl,
  getEffectiveGitHubOAuthCallbackUrl,
  getGitHubOAuthCallbackUrl,
  resolveOAuthProductionUrl,
  shouldUseOAuthProxy,
} from "./auth-url.js";

export function logAuthConfig() {
  const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();

  if (!githubClientId) {
    return;
  }

  console.log(`auth base URL: ${getAuthPublicBaseUrl()}`);

  if (shouldUseOAuthProxy()) {
    console.log(
      `GitHub OAuth proxy enabled via ${resolveOAuthProductionUrl()} (staging uses production callback URL).`,
    );
    console.log(
      `Ensure production API (${resolveOAuthProductionUrl()}) has the same GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and BETTER_AUTH_SECRET.`,
    );
  }

  console.log(
    `GitHub OAuth callback URL (register in GitHub App settings): ${getEffectiveGitHubOAuthCallbackUrl()}`,
  );

  if (shouldUseOAuthProxy()) {
    console.log(
      `Local callback URL (not sent to GitHub): ${getGitHubOAuthCallbackUrl()}`,
    );
  }
}
