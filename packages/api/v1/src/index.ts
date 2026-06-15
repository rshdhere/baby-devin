import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { router } from "./routes/index.js";

export const app = express();

const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === webAppUrl) {
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

app.all("/api/v1/auth/{*any}", toNodeHandler(auth));

app.use(express.json());
app.use("/api/v1/", router);
