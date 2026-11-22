import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getA1TelemetryHistory, recordA1Telemetry } from "./db";
import { isFreshTelemetry, normalizePrinterTelemetry, type PrinterTelemetry } from "../shared/printerTelemetry";

const TELEMETRY_URL = process.env.FR3D_TELEMETRY_WORKER_URL ?? "https://fr3d-a1-telemetry.thailonfalcon.workers.dev";
let telemetryConsecutiveFailures = 0;

async function fetchTelemetrySnapshot() {
  let lastError: unknown = null;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${TELEMETRY_URL}/v1/telemetry/a1`, {
        headers: { "Accept": "application/json", "User-Agent": "fr3d-dashboard/1.1" },
        cache: "no-store",
        signal: AbortSignal.timeout(attempt === 0 ? 5000 : 2500),
      });
      return { response, responseMs: Date.now() - startedAt };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("telemetry_fetch_failed");
}

function normalizeFanSpeed(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 15) return Math.min(100, Math.max(0, Math.round(value / 15 * 100)));
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseTelemetry(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const observedAtValue = value.observedAt;
  const observedAt = typeof observedAtValue === "number"
    ? observedAtValue
    : typeof observedAtValue === "string"
      ? Date.parse(observedAtValue)
      : NaN;
  if (value.printerId !== "a1" || !Number.isFinite(observedAt) || observedAt <= 0) return null;
  const rawState = typeof value.state === "string" ? value.state.toLowerCase() : "offline";
  const normalizedState = rawState === "running" || rawState === "printing"
    ? "printing"
    : rawState === "idle" || rawState === "finish" || rawState === "finished"
      ? "idle"
      : rawState === "failed" || rawState === "error" || rawState === "pause" || rawState === "paused"
        ? "error"
        : "offline";
  const telemetry: PrinterTelemetry = {
    printerId: "a1",
    model: "A1",
    serial: typeof value.serial === "string" ? value.serial : null,
    state: normalizedState,
    progress: typeof value.progress === "number" ? value.progress : null,
    jobName: typeof value.jobName === "string" ? value.jobName : null,
    remainingSeconds: typeof value.remainingSeconds === "number" ? value.remainingSeconds : null,
    nozzleTemperature: typeof value.nozzleTemperature === "number" ? value.nozzleTemperature : null,
    bedTemperature: typeof value.bedTemperature === "number" ? value.bedTemperature : null,
    fanSpeed: normalizeFanSpeed(value.fanSpeed),
    wifiSignal: typeof value.wifiSignal === "number" ? value.wifiSignal : null,
    firmware: typeof value.firmware === "string" ? value.firmware : null,
    layerNumber: typeof value.layerNumber === "number" ? value.layerNumber : typeof value.layer_num === "number" ? value.layer_num : null,
    totalLayers: typeof value.totalLayers === "number" ? value.totalLayers : typeof value.total_layer_num === "number" ? value.total_layer_num : null,
    observedAt,
  };
  const normalized = normalizePrinterTelemetry(telemetry);
  return { ...normalized, fresh: isFreshTelemetry(observedAt) };
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  telemetry: router({
    a1: publicProcedure.query(async () => {
      try {
        const { response, responseMs } = await fetchTelemetrySnapshot();
        if (!response.ok) {
          telemetryConsecutiveFailures += 1;
          return { telemetry: null, online: false, ageMs: null, error: `worker_http_${response.status}`, diagnostics: { responseMs, consecutiveFailures: telemetryConsecutiveFailures, fetchedAt: Date.now(), receivedAt: null } };
        }
        const payload = await response.json() as Record<string, unknown>;
        const telemetry = parseTelemetry(payload);
        if (!telemetry) telemetryConsecutiveFailures += 1;
        else telemetryConsecutiveFailures = 0;
        if (telemetry && telemetry.fresh && process.env.NODE_ENV !== "test") {
          void recordA1Telemetry(telemetry).catch((error) => console.warn("[Telemetry] history write failed", error instanceof Error ? error.message : "unknown_error"));
        }
        return { telemetry, online: Boolean(telemetry?.fresh), ageMs: telemetry ? Math.max(0, Date.now() - telemetry.observedAt) : null, error: telemetry ? null : "invalid_telemetry", diagnostics: { responseMs, consecutiveFailures: telemetryConsecutiveFailures, fetchedAt: Date.now(), receivedAt: typeof payload.receivedAt === "string" ? payload.receivedAt : null } };
      } catch {
        telemetryConsecutiveFailures += 1;
        return { telemetry: null, online: false, ageMs: null, error: "worker_unreachable", diagnostics: { responseMs: null, consecutiveFailures: telemetryConsecutiveFailures, fetchedAt: Date.now(), receivedAt: null } };
      }
    }),
    a1History: publicProcedure.query(async () => {
      try {
        const rows = await getA1TelemetryHistory();
        return rows.map((row) => ({ ...row, nozzleTemperature: row.nozzleTemperature == null ? null : row.nozzleTemperature / 10, bedTemperature: row.bedTemperature == null ? null : row.bedTemperature / 10 }));
      } catch {
        return [];
      }
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
