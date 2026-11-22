import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = {
  req: { protocol: "https", headers: {} },
  res: {},
  user: null,
} as TrpcContext;

describe("telemetry.a1", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a fresh Worker payload for the dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      printerId: "a1",
      model: "A1",
      serial: " 03919D4C0704536 ",
      state: "running",
      progress: 76.4,
      jobName: "  Enfermeira - Dinara_plate_5  ",
      remainingSeconds: 2880.4,
      nozzleTemperature: 213.86,
      bedTemperature: 63.14,
      fanSpeed: 14,
      wifiSignal: -58.4,
      firmware: "  01.04.00.00 ",
      layer_num: 128,
      total_layer_num: 176,
      observedAt: new Date().toISOString(),
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    const result = await appRouter.createCaller(context).telemetry.a1();

    expect(result.online).toBe(true);
    expect(result.error).toBeNull();
    expect(result.telemetry).toMatchObject({
      printerId: "a1",
      serial: "03919D4C0704536",
      state: "printing",
      progress: 76,
      jobName: "Enfermeira - Dinara_plate_5",
      remainingSeconds: 2880,
      nozzleTemperature: 213.9,
      bedTemperature: 63.1,
      fanSpeed: 93,
      wifiSignal: -58,
      firmware: "01.04.00.00",
      layerNumber: 128,
      totalLayers: 176,
      fresh: true,
    });
  });

  it("returns offline data when the Worker is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await appRouter.createCaller(context).telemetry.a1();

    expect(result).toEqual({ telemetry: null, online: false, error: "worker_unreachable" });
  });

  it("does not accept malformed or stale Worker payloads as online", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      printerId: "a1",
      state: "printing",
      observedAt: "2020-01-01T00:00:00.000Z",
    }), { status: 200 })));

    const result = await appRouter.createCaller(context).telemetry.a1();

    expect(result.online).toBe(false);
    expect(result.error).toBeNull();
    expect(result.telemetry).toMatchObject({ printerId: "a1", fresh: false, state: "printing" });
  });
});
