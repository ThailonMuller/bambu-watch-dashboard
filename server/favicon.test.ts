import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve("client/index.html"), "utf8");

describe("FR3D favicon assets", () => {
  it("declares dedicated square favicons rather than the old rectangular header image", () => {
    expect(html).not.toContain('/assets/fr3d-menu-logo.png');
    for (const size of [16, 32, 48, 192]) {
      expect(html).toContain(`sizes="${size}x${size}"`);
      expect(html).toMatch(new RegExp(`/manus-storage/fr3d-favicon-bright-${size}_[a-z0-9]+\\.png`));
    }
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180"');
    expect(html).toMatch(/\/manus-storage\/fr3d-apple-touch-icon-bright_[a-z0-9]+\.png/);
  });

  it("lets users zoom the responsive app instead of forcing maximum-scale=1", () => {
    expect(html).toContain('content="width=device-width, initial-scale=1.0"');
    expect(html).not.toContain('maximum-scale=1');
  });
});
