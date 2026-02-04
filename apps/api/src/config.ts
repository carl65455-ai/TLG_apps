import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../../..");

export const config = {
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(projectRoot, "uploads"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 200 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  serveWebDist: (process.env.SERVE_WEB_DIST ?? "") === "1",
  webDistDir: process.env.WEB_DIST_DIR ?? path.join(projectRoot, "apps/web/dist"),
  converterUrl: process.env.CONVERTER_URL ?? "",
  converterCli: process.env.CONVERTER_CLI ?? "",
  converterCliArgs: process.env.CONVERTER_CLI_ARGS ?? "",
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 5 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 20)
  }
};

export const allowedExtensions = new Set([".glb", ".gltf", ".step", ".stp"]);
