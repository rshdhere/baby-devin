import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { isAllowedOrigin } from "./lib/cors.js";
import { router } from "./routes/index.js";

export const app = express();

app.set("trust proxy", true);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cookie",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

const authHandler = toNodeHandler(auth);

app.all("/api/v1/auth/{*any}", (req, res, next) => {
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = (
    name: string,
    value: string | number | readonly string[],
  ) => {
    if (name.toLowerCase() === "set-cookie") {
      console.log(`[AUTH DEBUG] Set-Cookie header:`, value);
    }
    return originalSetHeader(name, value);
  };

  if (req.path.includes("/callback") || req.path.includes("/get-session")) {
    console.log(`[AUTH DEBUG] ${req.method} ${req.path}`);
    console.log(`[AUTH DEBUG] Origin: ${req.headers.origin}`);
    console.log(`[AUTH DEBUG] Cookie header: ${req.headers.cookie}`);
    console.log(
      `[AUTH DEBUG] X-Forwarded-Proto: ${req.headers["x-forwarded-proto"]}`,
    );
    console.log(`[AUTH DEBUG] Protocol: ${req.protocol}`);
  }

  authHandler(req, res, next);
});

app.use(express.json());
app.use("/api/v1/", router);
