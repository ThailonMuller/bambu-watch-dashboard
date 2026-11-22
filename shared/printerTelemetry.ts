export type PrinterModel = "A1" | "P1S";
export type PrinterState = "printing" | "idle" | "offline" | "error";

export type PrinterTelemetry = {
  printerId: string;
  model: PrinterModel;
  serial?: string | null;
  state: PrinterState;
  progress?: number | null;
  jobName?: string | null;
  remainingSeconds?: number | null;
  nozzleTemperature?: number | null;
  bedTemperature?: number | null;
  fanSpeed?: number | null;
  wifiSignal?: number | null;
  firmware?: string | null;
  layerNumber?: number | null;
  totalLayers?: number | null;
  observedAt: number;
};

export type NormalizedPrinterTelemetry = Omit<PrinterTelemetry, "progress" | "jobName" | "remainingSeconds" | "nozzleTemperature" | "bedTemperature" | "fanSpeed" | "wifiSignal" | "firmware" | "serial" | "layerNumber" | "totalLayers"> & {
  serial: string | null;
  progress: number;
  jobName: string;
  remainingSeconds: number | null;
  nozzleTemperature: number | null;
  bedTemperature: number | null;
  fanSpeed: number | null;
  wifiSignal: number | null;
  firmware: string | null;
  layerNumber: number | null;
  totalLayers: number | null;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export function normalizePrinterTelemetry(input: PrinterTelemetry): NormalizedPrinterTelemetry {
  return {
    ...input,
    serial: input.serial?.trim() || null,
    progress: typeof input.progress === "number" && Number.isFinite(input.progress) ? clampPercent(input.progress) : 0,
    jobName: input.jobName?.trim() || "Nenhum trabalho informado",
    remainingSeconds: typeof input.remainingSeconds === "number" && Number.isFinite(input.remainingSeconds) && input.remainingSeconds >= 0 ? Math.round(input.remainingSeconds) : null,
    nozzleTemperature: typeof input.nozzleTemperature === "number" && Number.isFinite(input.nozzleTemperature) ? Math.round(input.nozzleTemperature * 10) / 10 : null,
    bedTemperature: typeof input.bedTemperature === "number" && Number.isFinite(input.bedTemperature) ? Math.round(input.bedTemperature * 10) / 10 : null,
    fanSpeed: typeof input.fanSpeed === "number" && Number.isFinite(input.fanSpeed) ? clampPercent(input.fanSpeed) : null,
    wifiSignal: typeof input.wifiSignal === "number" && Number.isFinite(input.wifiSignal) ? Math.round(input.wifiSignal) : null,
    firmware: input.firmware?.trim() || null,
    layerNumber: typeof input.layerNumber === "number" && Number.isFinite(input.layerNumber) && input.layerNumber >= 0 ? Math.round(input.layerNumber) : null,
    totalLayers: typeof input.totalLayers === "number" && Number.isFinite(input.totalLayers) && input.totalLayers >= 0 ? Math.round(input.totalLayers) : null,
  };
}

export function isFreshTelemetry(observedAt: number, now = Date.now(), maxAgeMs = 45_000) {
  return Number.isFinite(observedAt) && observedAt > 0 && now - observedAt <= maxAgeMs;
}

export function estimatedCompletionAt(remainingSeconds: number | null | undefined, now = Date.now()) {
  if (typeof remainingSeconds !== "number" || !Number.isFinite(remainingSeconds) || remainingSeconds < 0 || !Number.isFinite(now)) return null;
  return now + Math.round(remainingSeconds) * 1000;
}

export function displayPrinterState(state: PrinterState) {
  if (state === "printing") return "Imprimindo";
  if (state === "idle") return "Disponível";
  if (state === "error") return "Atenção";
  return "Offline";
}
