import { useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function normalizeHexColor(value: string) {
  const digits = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(digits) ? `#${digits.toLowerCase()}` : null;
}

export default function RequiredFilamentColor({
  value,
  onChange,
  invalid = false,
  errorMessage = "Selecione uma cor.",
  label = "Selecionar cor da bobina",
  title = "Escolher cor da bobina",
  compact = false,
}: {
  value: string;
  onChange: (color: string) => void;
  invalid?: boolean;
  errorMessage?: string;
  label?: string;
  title?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(value || "#000000");
  const [draftHex, setDraftHex] = useState((value || "#000000").toUpperCase());
  const titleId = useId();
  const errorId = useId();
  const hexErrorId = useId();
  const confirmedHex = normalizeHexColor(draftHex);

  const changeOpen = (next: boolean) => {
    if (next) {
      const initialColor = value || "#000000";
      setDraftColor(initialColor);
      setDraftHex(initialColor.toUpperCase());
    }
    setOpen(next);
  };

  return (
    <div className={`required-filament-color ${compact ? "is-compact" : ""}`}>
      <div className="color-input-wrap">
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`filament-color-trigger ${value ? "" : "is-empty"}`}
              style={value ? { backgroundColor: value } : undefined}
              aria-label={label}
              aria-required="true"
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? errorId : undefined}
            >
              {!value && <span aria-hidden="true">—</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="filament-color-popover"
            align="start"
            aria-labelledby={titleId}
          >
            <h4 id={titleId}>{title}</h4>
            <label className="filament-color-draft">
              <span>Cor</span>
              <input
                type="color"
                className="filament-color-input"
                value={draftColor}
                style={{ backgroundColor: draftColor }}
                onChange={event => {
                  const nextColor = normalizeHexColor(event.target.value);
                  if (!nextColor) return;
                  setDraftColor(nextColor);
                  setDraftHex(nextColor.toUpperCase());
                }}
                aria-label="Escolher cor"
              />
              <code>{draftColor.toUpperCase()}</code>
            </label>
            <label className="filament-hex-field">
              <span>Código HEX</span>
              <input
                type="text"
                value={draftHex}
                onChange={event => {
                  const nextHex = event.target.value.toUpperCase();
                  setDraftHex(nextHex);
                  const nextColor = normalizeHexColor(nextHex);
                  if (nextColor) setDraftColor(nextColor);
                }}
                placeholder="#RRGGBB"
                maxLength={7}
                autoComplete="off"
                spellCheck={false}
                aria-label="Código HEX da cor"
                aria-invalid={!confirmedHex || undefined}
                aria-describedby={!confirmedHex ? hexErrorId : undefined}
              />
              {!confirmedHex && <small id={hexErrorId} role="alert">Digite um HEX válido, por exemplo #32C8A0.</small>}
            </label>
            <div className="filament-color-popover-actions">
              <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
              <button
                type="button"
                className="filament-primary-button"
                disabled={!confirmedHex}
                onClick={() => {
                  if (!confirmedHex) return;
                  onChange(confirmedHex);
                  setOpen(false);
                }}
              >
                Confirmar cor
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <code>{value ? value.toUpperCase() : "Selecionar"}</code>
      </div>
      {invalid && <small id={errorId} className="filament-color-error" role="alert">{errorMessage}</small>}
    </div>
  );
}
