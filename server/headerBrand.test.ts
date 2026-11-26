import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));

// Inspect the final identity rules, including their responsive overrides.
function identityStyles(selector: string, viewportWidth: number) {
  const values: Record<string, string> = {};
  stylesheet.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    let applies = true;
    let parent = rule.parent;
    while (parent && parent.type !== "root") {
      if (parent.type === "atrule" && parent.name === "media") {
        const limits = [...parent.params.matchAll(/(min|max)-width:\s*(\d+)px/g)];
        for (const [, kind, number] of limits) {
          if (kind === "min" && viewportWidth < Number(number)) applies = false;
          if (kind === "max" && viewportWidth > Number(number)) applies = false;
        }
      }
      parent = parent.parent;
    }
    if (applies) rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
  });
  return values;
}

describe("header brand styling", () => {
  it("preserves the full centered logo without cropping or a circular mask", () => {
    for (const viewport of [1440, 1024, 390]) {
      expect(identityStyles(".topnav-brand .brand-mark img", viewport)).toMatchObject({
        width: "100%", height: "100%", "object-fit": "contain",
        "object-position": "center", "border-radius": "0", "box-shadow": "none",
      });
      expect(identityStyles(".topnav-brand .brand-mark", viewport)).toMatchObject({
        overflow: "visible", "border-radius": "0", "box-shadow": "none",
      });
    }
  });

  it("keeps the logo square at desktop, tablet and mobile sizes", () => {
    expect(identityStyles(".topnav-brand .brand-mark", 1440)).toMatchObject({ width: "64px", height: "64px" });
    expect(identityStyles(".topnav-brand .brand-mark", 1024)).toMatchObject({ width: "64px", height: "64px" });
    expect(identityStyles(".topnav-brand .brand-mark", 390)).toMatchObject({ width: "56px", height: "56px" });
  });

  it("increases the subtitle by four pixels in every responsive layout", () => {
    expect(identityStyles(".topnav-brand .brand-copy small", 1440)["font-size"]).toBe("15px");
    expect(identityStyles(".topnav-brand .brand-copy small", 1024)["font-size"]).toBe("14px");
    expect(identityStyles(".topnav-brand .brand-copy small", 390)["font-size"]).toBe("14px");
  });

  it("keeps only one base logo style, one mobile size override and one image style", () => {
    const logoRules: string[] = [];
    stylesheet.walkRules((rule) => {
      if (rule.selector.includes("brand-mark")) logoRules.push(rule.selector);
    });
    expect(logoRules).toEqual([
      ".topnav-brand .brand-mark",
      ".topnav-brand .brand-mark img",
      ".topnav-brand .brand-mark",
    ]);
    for (const viewport of [1440, 1024, 390]) {
      expect(identityStyles(".topnav-brand .brand-mark", viewport).background).toBe("transparent");
    }
  });

  it("uses the transparent neon logo in project storage, not the previous centered image", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    expect(home).toContain("/manus-storage/fr3d-circular-logo-bright-final_1a824900.png");
    expect(home).not.toContain("fr3d-neon-logo-web_a188498a.png");
    expect(home).not.toContain("fr3d-menu-logo-centered_2cbcc8eb.png");
    expect(home).toMatch(/width=\{64\}\s+height=\{64\}\s+alt="Logo Falcão Rosa3D"/);
  });
});
