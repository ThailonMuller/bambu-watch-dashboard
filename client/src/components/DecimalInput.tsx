import React, { type InputHTMLAttributes } from "react";

type DecimalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode">;

/** Text input intentionally: native number controls cannot draw gray spinner arrows. */
export default function DecimalInput({ onChange, min, max, step, ...props }: DecimalInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      onChange={event => {
        const nextValue = event.target.value.replace(",", ".");
        if (!/^-?\d*(?:\.\d*)?$/.test(nextValue)) return;
        event.target.value = nextValue;
        onChange?.(event);
      }}
    />
  );
}
