import express from "express";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { fixture } from "./fixture.js";
import { explainability, investigate } from "../shared/domain.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  app.use(express.json({ limit: "4kb" }));
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", version: fixture.version }),
  );
  app.get("/api/graph", (_req, res) =>
    res.json({ ...fixture, summary: explainability(fixture) }),
  );
  app.get("/api/traces/:id", (req, res) => {
    const trace = fixture.traces.find((t) => t.id === req.params.id);
    if (!trace) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }
    res.json(trace);
  });
  app.get("/api/evidence/:id", (req, res) => {
    const evidence = fixture.evidence.find((e) => e.id === req.params.id);
    if (!evidence) {
      res.status(404).json({ error: "Evidence not found" });
      return;
    }
    res.json(evidence);
  });
  app.post("/api/investigate", (req, res) => {
    const input = z
      .object({
        prompt: z.string().trim().min(1).max(500),
        selectedNodeId: z.string().max(100).default("velocity"),
      })
      .safeParse(req.body);
    if (!input.success) {
      res
        .status(400)
        .json({
          error:
            "Provide a prompt of 1–500 characters and a valid selectedNodeId.",
        });
      return;
    }
    if (!fixture.nodes.some((n) => n.id === input.data.selectedNodeId)) {
      res.status(400).json({ error: "Unknown selected node." });
      return;
    }
    res.json(
      investigate(fixture, input.data.prompt, input.data.selectedNodeId),
    );
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  const web = fileURLToPath(new URL("../client", import.meta.url));
  app.use(express.static(web, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || /\.[a-z0-9]+$/i.test(req.path)) {
      res.status(404).send("Not found");
      return;
    }
    res.sendFile(join(web, "index.html"), (error) => {
      if (error) next(error);
    });
  });
  app.use(
    (
      error: Error & { status?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = error.status ?? 500;
      if (status >= 500) console.error("Request failed:", error.message);
      res
        .status(status)
        .json({
          error: status < 500 ? "Invalid request" : "Service unavailable",
        });
    },
  );
  return app;
}
