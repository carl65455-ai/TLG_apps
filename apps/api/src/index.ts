import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { config } from "./config.js";
import { ensureDir, buildUploadPaths } from "./lib/storage.js";
import { uploadRouter } from "./routes/upload.js";
import { modelsRouter } from "./routes/models.js";

async function bootstrap() {
  const app = express();

  const uploadPaths = buildUploadPaths(config.uploadDir);
  await ensureDir(uploadPaths.originals);
  await ensureDir(uploadPaths.converted);

  app.use(
    cors({
      origin:
        config.corsOrigin === "*"
          ? true
          : config.corsOrigin
    })
  );
  app.use(express.json());

  app.use(
    "/api",
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use("/api", uploadRouter);
  app.use(modelsRouter);

  if (config.serveWebDist) {
    const indexPath = path.join(config.webDistDir, "index.html");

    // If the dist isn't present, it's better to be explicit than silently 404.
    try {
      await fs.stat(indexPath);
    } catch {
      console.warn(
        `SERVE_WEB_DIST=1 but index.html not found at ${indexPath}. Did you run web build?`
      );
    }

    app.use(express.static(config.webDistDir));
    app.get("*", async (_req, res) => {
      res.sendFile(indexPath);
    });
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (err instanceof Error && err.message.startsWith("Unsupported file extension")) {
      res.status(400).json({ error: err.message });
      return;
    }

    const message = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: message });
  });

  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
