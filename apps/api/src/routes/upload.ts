import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import { allowedExtensions, config } from "../config.js";
import { buildUploadPaths } from "../lib/storage.js";
import { resolveConverter } from "../converters/index.js";
import { ConverterUnavailableError } from "../converters/adapter.js";

const uploadPaths = buildUploadPaths(config.uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPaths.originals),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = randomUUID();
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      cb(new Error(`Unsupported file extension: ${ext}`));
      return;
    }
    cb(null, true);
  }
});

export const uploadRouter = express.Router();

uploadRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const id = path.parse(req.file.filename).name;
    const baseResponse = {
      id,
      originalName: req.file.originalname,
      size: req.file.size,
      format: ext.replace(".", "")
    };

    if (ext === ".glb" || ext === ".gltf") {
      res.json({
        ...baseResponse,
        converted: false,
        url: `/models/${req.file.filename}`
      });
      return;
    }

    const converter = await resolveConverter();
    const outputPath = path.join(uploadPaths.converted, `${id}.glb`);

    await converter.convertStepToGlb(req.file.path, outputPath);

    res.json({
      ...baseResponse,
      converted: true,
      converter: converter.name,
      url: `/models/${id}.glb`
    });
  } catch (error) {
    if (error instanceof ConverterUnavailableError) {
      res.status(503).json({
        error: error.message,
        hint: "Start the converter service or set CONVERTER_CLI",
        docs: "See README for converter setup"
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Upload failed";
    res.status(500).json({ error: message });
  }
});

export const uploadMiddleware = upload;
