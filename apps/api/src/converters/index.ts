import { ConverterAdapter, ConverterUnavailableError } from "./adapter.js";
import { HttpConverterService } from "./httpService.js";
import { LocalCliConverter } from "./localCli.js";

export async function resolveConverter(): Promise<ConverterAdapter> {
  const candidates: ConverterAdapter[] = [
    new HttpConverterService(),
    new LocalCliConverter()
  ];

  for (const candidate of candidates) {
    if (await candidate.available()) {
      return candidate;
    }
  }

  throw new ConverterUnavailableError(
    "No converter configured. Set CONVERTER_URL or CONVERTER_CLI."
  );
}
