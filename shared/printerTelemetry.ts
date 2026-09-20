export type PrinterModel = "A1" | "P1S";
export type PrinterState = "printing" | "idle" | "offline" | "error";

export type PrinterTelemetry = {
  printerId: string;
  model: PrinterModel;
  state: PrinterState;
  progress?: number | null;
  jobName?: string | null;
  remainingSeconds?: number | null;
  nozzleTemperature?: number | null;
  bedTemperature?: number | null;
  wifiSignal?: number | null;
  firmware?: string | null;
  observedAt: number;
};

export type NormalizedPrinterTelemetry = Omit<PrinterTelemetry, "progress" | "jobName" | "remainingSeconds" | "nozzleTemperature" | "bedTemperature" | "wifiSignal" | "firmware"> & {
  progress: number;
  jobName: string;
  remainingSeconds: number | null;
  nozzleTemperature: number | null;
  bedTemperature: number | null;
  wifiSignal: number | null;
  firmware: string | null;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export function normalizePrinterTelemetry(input: PrinterTelemetry): NormalizedPrinterTelemetry {
  return {
    ...input,
    progress: typeof input.progress === "number" && Number.isFinite(input.progress) ? clampPercent(input.progress) : 0,
    jobName: input.jobName?.trim() || "Nenhum trabalho informado",
    remainingSeconds: typeof input.remainingSeconds === "number" && Number.isFinite(input.remainingSeconds) && input.remainingSeconds >= 0 ? Math.round(input.remainingSeconds) : null,
    nozzleTemperature: typeof input.nozzleTemperature === "number" && Number.isFinite(input.nozzleTemperature) ? Math.round(input.nozzleTemperature * 10) / 10 : null,
    bedTemperature: typeof input.bedTemperature === "number" && Number.isFinite(input.bedTemperature) ? Math.round(input.bedTemperature * 10) / 10 : null,
    wifiSignal: typeof input.wifiSignal === "number" && Number.isFinite(input.wifiSignal) ? Math.round(input.wifiSignal) : null,
    firmware: input.firmware?.trim() || null,
  };
}

export function isFreshTelemetry(observedAt: number, now = Date.now(), maxAgeMs = 45_000) {
  return Number.isFinite(observedAt) && observedAt > 0 && now - observedAt <= maxAgeMs;
}

export function displayPrinterState(state: PrinterState) {
  if (state === "printing") return "Imprimindo";
  if (state === "idle") return "Disponível";
  if (state === "error") return "Atenção";
  return "Offline";
}
