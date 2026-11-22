import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { isFreshTelemetry, normalizePrinterTelemetry, type PrinterTelemetry } from "../shared/printerTelemetry";

const TELEMETRY_URL = process.env.FR3D_TELEMETRY_WORKER_URL ?? "https://fr3d-a1-telemetry.thailonfalcon.workers.dev";

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
    state: normalizedState,
    progress: typeof value.progress === "number" ? value.progress : null,
    jobName: typeof value.jobName === "string" ? value.jobName : null,
    remainingSeconds: typeof value.remainingSeconds === "number" ? value.remainingSeconds : null,
    nozzleTemperature: typeof value.nozzleTemperature === "number" ? value.nozzleTemperature : null,
    bedTemperature: typeof value.bedTemperature === "number" ? value.bedTemperature : null,
    fanSpeed: normalizeFanSpeed(value.fanSpeed),
    wifiSignal: typeof value.wifiSignal === "number" ? value.wifiSignal : null,
    firmware: typeof value.firmware === "string" ? value.firmware : null,
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
        const response = await fetch(`${TELEMETRY_URL}/v1/telemetry/a1`, {
          headers: { "Accept": "application/json", "User-Agent": "fr3d-dashboard/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return { telemetry: null, online: false, error: `worker_http_${response.status}` };
        const telemetry = parseTelemetry(await response.json());
        return { telemetry, online: Boolean(telemetry?.fresh), error: telemetry ? null : "invalid_telemetry" };
      } catch {
        return { telemetry: null, online: false, error: "worker_unreachable" };
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
