import { describe, expect, it } from "vitest";
import { displayPrinterState, isFreshTelemetry, normalizePrinterTelemetry } from "../shared/printerTelemetry";

describe("printer telemetry contract", () => {
  it("normalizes unsafe or incomplete readings without changing the printer identity", () => {
    const result = normalizePrinterTelemetry({
      printerId: "a1",
      model: "A1",
      state: "printing",
      progress: 140.4,
      jobName: "  vaso-organico-v3.3mf  ",
      remainingSeconds: 38.6,
      nozzleTemperature: 218.26,
      bedTemperature: null,
      wifiSignal: -48.4,
      observedAt: 1_700_000_000_000,
    });

    expect(result.printerId).toBe("a1");
    expect(result.progress).toBe(100);
    expect(result.jobName).toBe("vaso-organico-v3.3mf");
    expect(result.remainingSeconds).toBe(39);
    expect(result.nozzleTemperature).toBe(218.3);
    expect(result.bedTemperature).toBeNull();
    expect(result.wifiSignal).toBe(-48);
  });

  it("classifies telemetry freshness and presents human-readable states", () => {
    const now = 1_700_000_000_000;
    expect(isFreshTelemetry(now - 10_000, now)).toBe(true);
    expect(isFreshTelemetry(now - 60_000, now)).toBe(false);
    expect(displayPrinterState("printing")).toBe("Imprimindo");
    expect(displayPrinterState("offline")).toBe("Offline");
  });
});
