import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const card = readFileSync(
  resolve("client/src/components/FilamentSpoolCard.tsx"),
  "utf8"
);
const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
const stylesheet = readFileSync(resolve("client/src/index.css"), "utf8");

describe("filament spool cards", () => {
  it("renders each spool as an accessible trigger for its details dialog", () => {
    expect(card).toContain('aria-haspopup="dialog"');
    expect(card).toContain("aria-label={`Detalhes do filamento ${item.name}");
    expect(card).toContain("<Dialog open={open} onOpenChange={setOpen}>");
    expect(card).toContain("<DialogTitle>Detalhes da bobina</DialogTitle>");
    expect(home).toContain("<FilamentSpoolCard");
  });

  it("exposes editable internal fields and validates them before saving", () => {
    for (const label of [
      "Nome do filamento",
      "Material",
      "Cor da bobina",
      "Estoque (g)",
      "Avisar abaixo de (g)",
    ]) {
      expect(card).toContain(label);
    }
    expect(card).toContain(
      'draft.grams.trim() === ""'
    );
    expect(card).toContain("onSave(item.id, {");
    expect(card).toContain('toast.success("Dados da bobina atualizados")');
  });

  it("shows stock, consumption and related internal movements", () => {
    for (const label of [
      "Estoque disponível",
      "Limite de alerta",
      "Consumo aprovado",
      "Débitos pendentes",
      "Movimentações vinculadas",
    ]) {
      expect(card).toContain(label);
    }
    expect(home).toContain("relatedDebits={debits.filter");
    expect(home).toContain("relatedHistory={history.filter");
  });

  it("preserves fractional grams and stable spool IDs when writing consumption history", () => {
    expect(card).toContain("maximumFractionDigits: 2");
    expect(home).toContain("filamentId: linked?.id ?? debit.filamentId");
    expect(home).toContain("color: linked?.color ?? debit.color");
    expect(card).toContain('aria-label="Material"');
  });

  it("uses a compact responsive grid, color swatches and a color-matched weight band", () => {
    expect(card).toContain('className="filament-card-swatch"');
    expect(card).toContain('className={`filament-card-weight ${low ? "is-low" : ""}`}');
    expect(stylesheet).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(112px, 1fr))"
    );
    expect(stylesheet).toContain("background: var(--filament-color, #8f77f4)");
    expect(stylesheet).toContain(".filament-spool-card:focus-visible");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("integrates the readable low-stock status into the rounded weight band", () => {
    expect(card).toContain("{low && <small>Estoque baixo</small>}");
    expect(card).toContain('${low ? ", estoque baixo" : ""}');
    expect(stylesheet).toContain(".filament-card-weight.is-low");
    expect(stylesheet).toContain(".app-shell .filament-card-weight small");
    expect(stylesheet).toContain("font-size: 11px !important;");
    expect(stylesheet).toContain("border-radius: 0 0 14px 14px");
    expect(stylesheet).not.toContain(".filament-card-low-tag");
  });

  it("keeps the debit header concise and removes per-debit remaining-stock calculations", () => {
    expect(home).toContain("<h3>Débitos de filamentos</h3>");
    expect(home).not.toContain("Confirme ou rejeite o material usado por cada impressão.");
    expect(home).not.toContain("debit-stock-remaining");
    expect(home).not.toContain("remainingAfterDebit");
    expect(stylesheet).not.toContain("debit-stock-remaining");
    expect(stylesheet).toContain(".debit-card .filament-card-heading h3");
    expect(stylesheet).toContain("font-size: 18px;");
  });
});
