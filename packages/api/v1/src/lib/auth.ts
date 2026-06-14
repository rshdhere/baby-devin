import { db } from "@devin/drizzle";
import { schema } from "@devin/drizzle/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, magicLink } from "better-auth/plugins";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const windsurfClientId = process.env.WINDSURF_CLIENT_ID;
const windsurfClientSecret = process.env.WINDSURF_CLIENT_SECRET;
const windsurfDiscoveryUrl = process.env.WINDSURF_DISCOVERY_URL;

const socialProviders: NonNullable<
  Parameters<typeof betterAuth>[0]["socialProviders"]
> = {};

if (githubClientId && githubClientSecret) {
  socialProviders.github = {
    clientId: githubClientId,
    clientSecret: githubClientSecret,
  };
}

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
}

const oauthProviders = [];

if (windsurfClientId && windsurfClientSecret && windsurfDiscoveryUrl) {
  oauthProviders.push({
    providerId: "windsurf",
    clientId: windsurfClientId,
    clientSecret: windsurfClientSecret,
    discoveryUrl: windsurfDiscoveryUrl,
  });
}

export const auth = betterAuth({
  basePath: "/api/v1/auth",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.WEB_APP_URL ?? "http://localhost:3000",
    process.env.BETTER_AUTH_URL ?? "http://localhost:8080",
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log(`[auth] magic link for ${email}: ${url}`);
      },
    }),
    ...(oauthProviders.length > 0
      ? [genericOAuth({ config: oauthProviders })]
      : []),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
});
