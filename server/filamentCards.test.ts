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
    expect(card).toContain('className="filament-card-weight"');
    expect(stylesheet).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(112px, 1fr))"
    );
    expect(stylesheet).toContain("background: var(--filament-color, #8f77f4)");
    expect(stylesheet).toContain(".filament-spool-card:focus-visible");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("shows the low-stock warning as a rounded, filament-colored overlay badge", () => {
    expect(card).toContain('{low && <span className="filament-card-low-ribbon">Estoque baixo</span>}');
    expect(card).toContain('${low ? ", estoque baixo" : ""}');
    expect(stylesheet).toContain(".filament-card-low-ribbon");
    expect(stylesheet).toContain("background: var(--filament-color, #8f77f4)");
    expect(stylesheet).toContain("border-radius: 999px");
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

  it("uses a rounded left-edge stripe matching each debit's linked filament color", () => {
    expect(home).toContain('style={{ borderLeft: `5px solid ${linked?.color ?? debit.color}` }}');
    expect(home).not.toContain('style={{ background: debit.color }}');
    expect(stylesheet).toContain(".debit-row { overflow: hidden; border-radius: 10px; }");
  });

  it("removes the per-spool consumption chart while retaining the history list and summaries", () => {
    expect(home).not.toContain("Consumo por bobina");
    expect(home).not.toContain("consumption-chart");
    expect(home).not.toContain("chartData");
    expect(home).toContain('className="history-summary"');
    expect(home).toContain('className="history-list"');
  });

  it("gives add, debit and history headings the same size and aligns their icons", () => {
    for (const title of [
      "Adicionar filamento",
      "Débitos de filamentos",
      "Histórico de consumo",
    ]) {
      expect(home).toContain(`<h3>${title}</h3>`);
    }
    expect(stylesheet).toContain(
      ".filament-card-heading h3 { font-size:18px !important; line-height:1.2; }"
    );
    expect(stylesheet).toContain(
      ".debit-card .filament-card-heading,\n.history-card .filament-card-heading { align-items:center; }"
    );
    expect(stylesheet).toContain(
      ".filament-card-heading .settings-symbol { flex:0 0 38px; }"
    );
    expect(stylesheet).toContain(
      ".app-shell p.filament-card-heading-description {"
    );
    expect(stylesheet).toContain(
      ".debit-card .filament-card-heading { flex-wrap:wrap; }"
    );
  });

  it("uses an empty compact required color trigger in the debit form", () => {
    expect(home).toContain('<RequiredFilamentColor compact label="Selecionar cor do débito"');
    expect(home).toContain('invalid={Boolean(debitColorError)}');
    expect(home).toContain('color: "", filamentId: ""');
    expect(home).toContain('newDebit.color.toLowerCase() !== selectedDebitFilament.color.toLowerCase()');
    expect(stylesheet).toContain(".required-filament-color.is-compact { position:relative; width:39px; min-width:39px; }");
    expect(stylesheet).toContain(".required-filament-color.is-compact .color-input-wrap code { display:none; }");
    expect(stylesheet).toContain(".filament-color-trigger.is-empty");
  });
});
