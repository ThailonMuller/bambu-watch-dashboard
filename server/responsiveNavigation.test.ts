import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const stylesheet = postcss.parse(readFileSync(resolve("client/src/index.css"), "utf8"));
const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");

function stylesFor(selector: string, viewportWidth: number) {
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

describe("responsive FR3D navigation", () => {
  it("keeps the header and five navigation items on one horizontal row from tablet through desktop", () => {
    for (const width of [768, 1024, 1346, 1799, 1920]) {
      expect(stylesFor(".app-topnav", width)).toMatchObject({
        "grid-template-columns": "max-content minmax(0,1fr) max-content",
        "grid-template-rows": "auto",
      });
      expect(stylesFor(".topnav-menu", width)).toMatchObject({
        "grid-column": "2",
        "grid-row": "1",
        "flex-wrap": "nowrap",
        overflow: "visible",
      });
      expect(stylesFor(".topnav-menu .nav-item", width)["white-space"]).toBe("nowrap");
    }
  });

  it("removes Overview and starts directly on the printer list", () => {
    expect(home).not.toContain('id: "overview"');
    expect(home).not.toContain("Visão geral");
    expect(home).not.toContain('view === "overview"');
    expect(home).not.toContain('className="hero-banner"');
    expect(home).not.toContain('className="metrics-grid"');
    expect(home).toContain('useState<View>("printers")');
    expect(home).toContain('label: "Impressoras"');
  });

  it("shows the navigation disclosure on mobile only when expanded and exposes a touch-sized link grid", () => {
    expect(stylesFor(".topnav-menu[data-mobile-open=\"false\"]", 390).display).toBe("none");
    expect(stylesFor(".topnav-menu[data-mobile-open=\"true\"]", 390).display).toBe("grid");
    expect(stylesFor(".topnav-menu[data-mobile-open=\"false\"]", 1346).display).toBe("flex");
    expect(stylesFor(".topnav-menu", 390)).toMatchObject({
      "grid-template-columns": "repeat(2,minmax(0,1fr))",
      overflow: "visible",
    });
    expect(stylesFor(".topnav-menu .nav-item", 390)).toMatchObject({
      width: "100%",
      "min-height": "44px",
      "min-width": "0",
    });
  });

  it("keeps the menu trigger hidden on tablet/desktop and visible on phone sizes", () => {
    expect(stylesFor(".mobile-menu-toggle", 1346).display).toBe("none");
    expect(stylesFor(".mobile-menu-toggle", 390).display).toBe("grid");
  });

  it("connects the disclosure button to a named navigation landmark and closes it with keyboard or selection", () => {
    expect(home).toContain('id="fr3d-primary-navigation"');
    expect(home).toContain('aria-label="Navegação principal"');
    expect(home).toContain('aria-controls="fr3d-primary-navigation"');
    expect(home).toContain("aria-expanded={mobileMenuOpen}");
    expect(home).toContain("data-mobile-open={mobileMenuOpen}");
    expect(home).toContain('event.key === "Escape"');
    expect(home).toContain("setMobileMenuOpen(false)");
    expect(home).toContain("setView(id);");
    expect(home).not.toContain('role="menu"');
  });
});
