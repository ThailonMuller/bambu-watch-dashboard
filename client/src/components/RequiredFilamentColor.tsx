import { useId, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export default function RequiredFilamentColor({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (color: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(value || "#000000");
  const titleId = useId();
  const errorId = useId();

  const changeOpen = (next: boolean) => {
    if (next) setDraftColor(value || "#000000");
    setOpen(next);
  };

  return (
    <div className="required-filament-color">
      <div className="color-input-wrap">
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`filament-color-trigger ${value ? "" : "is-empty"}`}
              style={value ? { backgroundColor: value } : undefined}
              aria-label="Selecionar cor da bobina"
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
            <h4 id={titleId}>Escolher cor da bobina</h4>
            <label className="filament-color-draft">
              <span>Cor</span>
              <input
                type="color"
                className="filament-color-input"
                value={draftColor}
                style={{ backgroundColor: draftColor }}
                onChange={event => setDraftColor(event.target.value)}
                aria-label="Escolher cor"
              />
              <code>{draftColor.toUpperCase()}</code>
            </label>
            <div className="filament-color-popover-actions">
              <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
              <button
                type="button"
                className="filament-primary-button"
                onClick={() => {
                  onChange(draftColor);
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
      {invalid && <small id={errorId} className="filament-color-error" role="alert">Selecione uma cor.</small>}
    </div>
  );
}
