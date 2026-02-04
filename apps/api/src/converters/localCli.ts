import { spawn } from "node:child_process";
import { ConverterAdapter, ConverterUnavailableError } from "./adapter.js";
import { config } from "../config.js";

function parseArgs(args: string): string[] {
  if (!args.trim()) return [];
  return args.split(" ").filter(Boolean);
}

export class LocalCliConverter implements ConverterAdapter {
  name = "local-cli";

  async available() {
    return Boolean(config.converterCli);
  }

  async convertStepToGlb(inputPath: string, outputPath: string) {
    if (!config.converterCli) {
      throw new ConverterUnavailableError("CONVERTER_CLI is not configured");
    }

    let args = parseArgs(config.converterCliArgs);
    const hasInput = args.includes("{input}");
    const hasOutput = args.includes("{output}");

    if (hasInput || hasOutput) {
      args = args.map((arg) =>
        arg.replace("{input}", inputPath).replace("{output}", outputPath)
      );
    } else {
      args = [...args, inputPath, outputPath];
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.converterCli, args, { stdio: "inherit" });

      child.on("error", (err) => reject(err));
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Converter CLI exited with code ${code}`));
      });
    });
  }
}
