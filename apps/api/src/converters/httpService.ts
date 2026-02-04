import fs from "node:fs/promises";
import path from "node:path";
import { ConverterAdapter, ConverterUnavailableError } from "./adapter.js";
import { config } from "../config.js";

export class HttpConverterService implements ConverterAdapter {
  name = "http-service";

  async available() {
    return Boolean(config.converterUrl);
  }

  async convertStepToGlb(inputPath: string, outputPath: string) {
    if (!config.converterUrl) {
      throw new ConverterUnavailableError("CONVERTER_URL is not configured");
    }

    const buffer = await fs.readFile(inputPath);
    const form = new FormData();
    const fileName = path.basename(inputPath);

    form.append("file", new Blob([buffer]), fileName);

    const response = await fetch(`${config.converterUrl.replace(/\/$/, "")}/convert`, {
      method: "POST",
      body: form
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Converter service failed: ${response.status} ${message}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  }
}
