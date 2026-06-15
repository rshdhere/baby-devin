import { createAuthClient } from "better-auth/react";
import {
  genericOAuthClient,
  magicLinkClient,
} from "better-auth/client/plugins";
import { authConfig } from "@/lib/auth-config";

export const authClient = createAuthClient({
  baseURL: authConfig.baseURL,
  basePath: authConfig.basePath,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient(), genericOAuthClient()],
});
