import path from "node:path";
import fs from "node:fs/promises";
import express from "express";
import mime from "mime-types";
import { config } from "../config.js";
import { buildUploadPaths } from "../lib/storage.js";

const uploadPaths = buildUploadPaths(config.uploadDir);

function isSafeFileName(name: string) {
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

async function findFile(fileName: string) {
  const candidates = [
    path.join(uploadPaths.converted, fileName),
    path.join(uploadPaths.originals, fileName)
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // ignore
    }
  }

  return null;
}

export const modelsRouter = express.Router();

modelsRouter.get("/models/:id", async (req, res) => {
  const fileName = req.params.id;

  if (!isSafeFileName(fileName)) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }

  const filePath = await findFile(fileName);

  if (!filePath) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  const contentType = mime.lookup(filePath) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.sendFile(filePath);
});
