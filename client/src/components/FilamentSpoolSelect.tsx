import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

type SpoolOption = { id: number; name: string; grams: number; color: string };

export default function FilamentSpoolSelect({
  items,
  value,
  onChange,
}: {
  items: SpoolOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = items.find(item => String(item.id) === value);

  return (
    <Select value={selected ? value : "__none__"} onValueChange={next => onChange(next === "__none__" ? "" : next)}>
      <SelectTrigger
        className="debit-spool-select"
        aria-label="Selecionar bobina"
        style={{ borderLeftColor: selected?.color }}
      >
        <SelectValue>
          <span className="debit-spool-label">{selected ? `${selected.name} · ${selected.grams} g` : "Selecionar bobina"}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="debit-spool-menu" align="start" collisionPadding={12}>
        <SelectItem value="__none__" className="debit-spool-option">Selecionar bobina</SelectItem>
        {items.map(item => (
          <SelectItem
            key={item.id}
            value={String(item.id)}
            textValue={`${item.name} · ${item.grams} g`}
            className="debit-spool-option"
            style={{ borderLeftColor: item.color }}
          >
            <span className="debit-spool-label">{item.name} · {item.grams} g</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
