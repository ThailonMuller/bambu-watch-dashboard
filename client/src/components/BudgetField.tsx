import React from "react";

type BudgetFieldProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
};

export default function BudgetField({ label, value, onChange, prefix, suffix, step = "1", min = "0" }: BudgetFieldProps) {
  const adjustValue = (direction: 1 | -1) => {
    const numericValue = Number(String(value).replace(",", "."));
    const numericStep = Number(step) || 1;
    const minimum = Number(min) || 0;
    const nextValue = Math.max(minimum, (Number.isFinite(numericValue) ? numericValue : minimum) + direction * numericStep);
    const decimals = Math.max(0, (step.split(".")[1] || "").length);
    onChange(decimals ? nextValue.toFixed(decimals) : String(nextValue));
  };

  return (
    <label className="budget-field">
      <span>{label}</span>
      <div className={`budget-input-wrap ${suffix ? "has-suffix" : ""}`}>
        {prefix && <b className="budget-input-prefix">{prefix}</b>}
        <div className="budget-number-control">
          <input type="text" inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
          {suffix && <b className="budget-input-suffix">{suffix}</b>}
          <span className="budget-stepper" role="group" aria-label={`Ajustar ${label}`}>
            <button type="button" className="budget-step-button budget-step-up" onClick={() => adjustValue(1)} aria-label={`Aumentar ${label}`}>+</button>
            <button type="button" className="budget-step-button budget-step-down" onClick={() => adjustValue(-1)} aria-label={`Diminuir ${label}`}>−</button>
          </span>
        </div>
      </div>
    </label>
  );
}
