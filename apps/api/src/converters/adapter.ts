export interface ConverterAdapter {
  name: string;
  available(): Promise<boolean>;
  convertStepToGlb(inputPath: string, outputPath: string): Promise<void>;
}

export class ConverterUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConverterUnavailableError";
  }
}
