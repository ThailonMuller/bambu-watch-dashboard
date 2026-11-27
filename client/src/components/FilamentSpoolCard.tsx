import { useState, type FormEvent } from "react";
import { Check, History, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import DecimalInput from "./DecimalInput";
import { filamentTextColor, isLowStock } from "../../../shared/filament";

type Filament = {
  id: number;
  name: string;
  material: string;
  color: string;
  grams: number;
  lowThreshold: number;
};

type FilamentDebit = {
  id: number;
  piece: string;
  grams: number;
  status: "pending" | "approved" | "rejected";
};

type FilamentHistoryEntry = {
  id: number;
  piece: string;
  grams: number;
  status: "approved" | "rejected";
  createdAt: string;
};

type FilamentDraft = {
  name: string;
  material: string;
  color: string;
  grams: string;
  lowThreshold: string;
};

type FilamentSpoolCardProps = {
  item: Filament;
  relatedDebits: FilamentDebit[];
  relatedHistory: FilamentHistoryEntry[];
  onSave: (id: number, patch: Partial<Filament>) => void;
};

const materials = ["PLA", "PETG", "ABS", "TPU"];
const formatGrams = (grams: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(grams)} g`;

function draftFrom(item: Filament): FilamentDraft {
  return {
    name: item.name,
    material: item.material,
    color: item.color,
    grams: String(item.grams),
    lowThreshold: String(item.lowThreshold),
  };
}

function debitStatusLabel(status: FilamentDebit["status"]) {
  if (status === "pending") return "Aguardando";
  return status === "approved" ? "Aprovado" : "Rejeitado";
}

export default function FilamentSpoolCard({
  item,
  relatedDebits,
  relatedHistory,
  onSave,
}: FilamentSpoolCardProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilamentDraft>(() => draftFrom(item));
  const low = isLowStock(item.grams, item.lowThreshold);
  const approvedGrams = relatedHistory
    .filter(entry => entry.status === "approved")
    .reduce((total, entry) => total + entry.grams, 0);
  const pendingGrams = relatedDebits
    .filter(entry => entry.status === "pending")
    .reduce((total, entry) => total + entry.grams, 0);
  const cardStyle = {
    "--filament-color": item.color,
    "--filament-ink": filamentTextColor(item.color),
  } as React.CSSProperties;

  const showDetails = () => {
    setDraft(draftFrom(item));
    setOpen(true);
  };

  const saveFilament = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const grams = Number(draft.grams);
    const lowThreshold =
      draft.lowThreshold.trim() === "" ? 0 : Number(draft.lowThreshold);
    if (
      !draft.name.trim() ||
      draft.grams.trim() === "" ||
      !Number.isFinite(grams) ||
      grams < 0 ||
      !Number.isFinite(lowThreshold) ||
      lowThreshold < 0
    ) {
      toast.error("Informe um nome e valores válidos para estoque e alerta");
      return;
    }
    onSave(item.id, {
      name: draft.name.trim(),
      material: draft.material,
      color: draft.color,
      grams,
      lowThreshold,
    });
    setOpen(false);
    toast.success("Dados da bobina atualizados");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={`filament-spool-card ${low ? "is-low" : ""}`}
          type="button"
          style={cardStyle}
          onClick={showDetails}
          aria-haspopup="dialog"
          aria-label={`Detalhes do filamento ${item.name}, ${formatGrams(item.grams)} disponíveis${low ? ", estoque baixo" : ""}`}
        >
          {low && (
            <>
              <span className="filament-card-alert-ring is-yellow" aria-hidden="true" />
              <span className="filament-card-alert-ring is-red" aria-hidden="true" />
            </>
          )}
          {low && <span className="filament-card-low-ribbon">Estoque baixo</span>}
          <span className="filament-card-surface">
            <span
              className="filament-card-swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="filament-card-name">{item.name}</span>
            <span className="filament-card-material">{item.material}</span>
            <span className="filament-card-weight">{formatGrams(item.grams)}</span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="filament-detail-dialog">
        <DialogHeader className="filament-detail-header">
          <DialogTitle>Detalhes da bobina</DialogTitle>
          <DialogDescription>
            Consulte as informações internas e edite os dados deste filamento.
          </DialogDescription>
        </DialogHeader>

        <div className="filament-detail-identity">
          <span
            className="filament-detail-swatch"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <div>
            <span>
              {item.material} · {item.color.toUpperCase()}
            </span>
            <strong>{item.name}</strong>
            <small>Identificação #{item.id}</small>
          </div>
          <span className={`filament-detail-status ${low ? "is-low" : ""}`}>
            {low ? "Abaixo do limite" : "Estoque normal"}
          </span>
        </div>

        <div
          className="filament-detail-metrics"
          aria-label="Resumo do estoque e consumo"
        >
          <div>
            <span>Estoque disponível</span>
            <strong>{formatGrams(item.grams)}</strong>
          </div>
          <div>
            <span>Limite de alerta</span>
            <strong>{formatGrams(item.lowThreshold)}</strong>
          </div>
          <div>
            <span>Consumo aprovado</span>
            <strong>{formatGrams(approvedGrams)}</strong>
          </div>
          <div>
            <span>Débitos pendentes</span>
            <strong>{formatGrams(pendingGrams)}</strong>
          </div>
        </div>

        <form className="filament-detail-form" onSubmit={saveFilament}>
          <div className="filament-detail-fields">
            <label className="filament-detail-field filament-detail-field-wide">
              <span>Nome do filamento</span>
              <input
                value={draft.name}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                autoComplete="off"
              />
            </label>
            <label className="filament-detail-field">
              <span>Material</span>
              <select
                aria-label="Material"
                value={draft.material}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    material: event.target.value,
                  }))
                }
              >
                {!materials.includes(draft.material) && (
                  <option>{draft.material}</option>
                )}
                {materials.map(material => (
                  <option key={material}>{material}</option>
                ))}
              </select>
            </label>
            <label className="filament-detail-field">
              <span>Cor da bobina</span>
              <div className="filament-detail-color-control">
                <input
                  className="filament-color-input"
                  type="color"
                  style={{ backgroundColor: draft.color }}
                  value={draft.color}
                  onChange={event =>
                    setDraft(current => ({
                      ...current,
                      color: event.target.value,
                    }))
                  }
                  aria-label="Cor da bobina"
                />
                <code>{draft.color.toUpperCase()}</code>
              </div>
            </label>
            <label className="filament-detail-field">
              <span>Estoque (g)</span>
              <DecimalInput
                min="0"
                step="1"
                value={draft.grams}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    grams: event.target.value,
                  }))
                }
              />
            </label>
            <label className="filament-detail-field">
              <span>Avisar abaixo de (g)</span>
              <DecimalInput
                min="0"
                step="1"
                value={draft.lowThreshold}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    lowThreshold: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <DialogFooter className="filament-detail-actions">
            <button
              className="filament-detail-cancel"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button className="filament-detail-save" type="submit">
              <Check size={15} /> Salvar alterações
            </button>
          </DialogFooter>
        </form>

        <section
          className="filament-detail-activity"
          aria-label="Movimentações vinculadas"
        >
          <div className="filament-detail-activity-heading">
            <History size={15} />
            <strong>Movimentações vinculadas</strong>
          </div>
          {relatedHistory.length === 0 && relatedDebits.length === 0 ? (
            <p className="filament-detail-empty">
              Ainda não há consumo registrado para esta bobina.
            </p>
          ) : (
            <div className="filament-detail-activity-list">
              {relatedDebits.slice(0, 3).map(entry => (
                <div
                  className="filament-detail-activity-row"
                  key={`debit-${entry.id}`}
                >
                  <span className={`filament-activity-dot ${entry.status}`} />
                  <span className="filament-activity-name">{entry.piece}</span>
                  <span>
                    {formatGrams(entry.grams)} ·{" "}
                    {debitStatusLabel(entry.status)}
                  </span>
                </div>
              ))}
              {relatedHistory.slice(0, 3).map(entry => (
                <div
                  className="filament-detail-activity-row"
                  key={`history-${entry.id}`}
                >
                  <span className={`filament-activity-dot ${entry.status}`} />
                  <span className="filament-activity-name">{entry.piece}</span>
                  <span>
                    {formatGrams(entry.grams)} · {entry.createdAt}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
