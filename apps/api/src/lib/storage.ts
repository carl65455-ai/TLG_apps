import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function buildUploadPaths(uploadDir: string) {
  return {
    originals: path.join(uploadDir, "original"),
    converted: path.join(uploadDir, "converted")
  };
}
