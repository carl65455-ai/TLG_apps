import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const app = express();
const upload = multer({ dest: "/tmp" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post("/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const outputPath = path.join("/tmp", `${randomUUID()}.glb`);

  try {
    const startedAt = Date.now();

    async function run(args, options = {}) {
      return await new Promise((resolve, reject) => {
        const child = spawn("opencascade-tools", args, {
          stdio: ["ignore", "pipe", "pipe"],
          ...options
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (buf) => {
          stdout += buf.toString();
        });
        child.stderr.on("data", (buf) => {
          stderr += buf.toString();
        });

        child.on("error", (err) => reject({ err, stdout, stderr, code: null }));
        child.on("exit", (code) => {
          if (code === 0) resolve({ stdout, stderr, code });
          else reject({ err: new Error(`exit ${code}`), stdout, stderr, code });
        });
      });
    }

    // `opencascade-tools` has had different CLI signatures across versions.
    // Try the explicit input/output flags first, then fall back to positional input.
    const attempts = [];

    try {
      const args = [
        "--format",
        "glb",
        "--input",
        req.file.path,
        "--output",
        outputPath
      ];
      attempts.push({ args });
      await run(args);
    } catch (first) {
      // Fallback: run in a temp working dir and find the produced .glb.
      const workDir = path.join("/tmp", `conv-${randomUUID()}`);
      await fs.mkdir(workDir, { recursive: true });
      const ext = path.extname(req.file.originalname || req.file.path) || ".step";
      const inputInDir = path.join(workDir, `model${ext}`);
      await fs.copyFile(req.file.path, inputInDir);

      const args = ["--format", "glb", inputInDir];
      attempts.push({ args, cwd: workDir });
      await run(args, { cwd: workDir });

      const files = await fs.readdir(workDir);
      const glbs = [];
      for (const name of files) {
        if (!name.toLowerCase().endsWith(".glb")) continue;
        const full = path.join(workDir, name);
        const stat = await fs.stat(full).catch(() => null);
        if (!stat?.isFile()) continue;
        if (stat.mtimeMs >= startedAt - 2000) glbs.push(full);
      }

      if (glbs.length === 0) {
        // Surface the first failure details if we can.
        const stderr = first?.stderr ? String(first.stderr).slice(-2000) : "";
        const stdout = first?.stdout ? String(first.stdout).slice(-2000) : "";
        throw new Error(
          `No GLB produced. First attempt output:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
        );
      }

      await fs.copyFile(glbs[0], outputPath);
      await fs.rm(workDir, { recursive: true, force: true });
    }

    res.setHeader("Content-Type", "model/gltf-binary");
    res.sendFile(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed";
    res.status(500).json({
      error: message,
      hint:
        "Check converter logs. Common causes: unsupported STEP, too-large model, or opencascade-tools CLI signature mismatch."
    });
  } finally {
    await fs.unlink(req.file.path).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT ?? 7070);
app.listen(port, () => {
  console.log(`Converter listening on ${port}`);
});
