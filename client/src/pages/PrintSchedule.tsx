import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowRight, CalendarClock, CheckCircle2, Clock3, Download, GripVertical, Link2, LockKeyhole, Pencil, Plus, Printer, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateQueue, createSchedule, formatDuration, isPrintSchedule, moveJob, parseDuration, SCHEDULE_STORAGE_KEY, toLocalDateTime, type PrintJob, type PrintSchedule as Schedule, type PrinterQueue } from "../../../shared/printSchedule";

function readSchedule(): { schedule: Schedule; error: string | null } {
  try {
    const saved = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!saved) return { schedule: createSchedule(), error: null };
    const parsed: unknown = JSON.parse(saved);
    if (isPrintSchedule(parsed)) return { schedule: parsed, error: null };
    return { schedule: createSchedule(), error: "O cronograma salvo não pôde ser validado. Os dados antigos foram preservados; importe um backup válido para continuar." };
  } catch {
    return { schedule: createSchedule(), error: "Não foi possível ler o armazenamento local. Os dados anteriores não serão sobrescritos." };
  }
}

function DateCell({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  return <time className="schedule-date" dateTime={date.toISOString()}><strong>{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span></time>;
}

function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type JobForm = { id: string | null; printerId: string; productName: string; duration: string; notes: string; position: number };

export default function PrintSchedule() {
  const [initial] = useState(readSchedule);
  const [schedule, setSchedule] = useState(initial.schedule);
  const [storageError, setStorageError] = useState(initial.error);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState<JobForm | null>(null);
  const [formError, setFormError] = useState("");
  const [dragged, setDragged] = useState<{ jobId: string; printerId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [backupToImport, setBackupToImport] = useState<Schedule | null>(null);
  const [startDrafts, setStartDrafts] = useState<Record<string, string>>({});
  const importRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (initial.error && storageError) return;
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
      setLastSaved(Date.now());
      setStorageError(null);
    } catch {
      setStorageError("Não foi possível salvar neste navegador. Exporte um backup para não perder suas alterações.");
    }
  }, [schedule, initial.error]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== SCHEDULE_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed: unknown = JSON.parse(event.newValue);
        if (isPrintSchedule(parsed)) { setSchedule(parsed); setStartDrafts({}); }
      } catch { /* An invalid external write must not replace the current queue. */ }
    };
    window.addEventListener("storage", handler);
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.removeEventListener("storage", handler); clearInterval(timer); };
  }, []);

  const computed = useMemo(() => schedule.queues.map(queue => ({ ...queue, scheduled: calculateQueue(queue) })), [schedule]);
  const count = computed.reduce((sum, queue) => sum + queue.jobs.length, 0);
  const totalMinutes = computed.reduce((sum, queue) => sum + queue.jobs.reduce((acc, job) => acc + job.durationMinutes, 0), 0);
  const lastEnd = count ? Math.max(...computed.filter(queue => queue.scheduled.length).map(queue => queue.scheduled[queue.scheduled.length - 1].endAt)) : null;
  const formQueue = schedule.queues.find(queue => queue.printerId === form?.printerId);
  const positionCount = formQueue ? formQueue.jobs.filter(job => job.id !== form?.id).length + 1 : 1;
  const parsedDuration = form ? parseDuration(form.duration) : null;
  const formPreview = useMemo(() => {
    if (!form || !formQueue || parsedDuration == null) return null;
    const jobs = formQueue.jobs.filter(job => job.id !== form.id);
    const position = Math.max(0, Math.min(jobs.length, form.position));
    const startAt = formQueue.startAt + jobs.slice(0, position).reduce((sum, job) => sum + job.durationMinutes * 60_000, 0);
    return { startAt, endAt: startAt + parsedDuration * 60_000 };
  }, [form, formQueue, parsedDuration]);

  const openAdd = (printerId = filter === "all" ? "a1" : filter) => {
    const queue = schedule.queues.find(item => item.printerId === printerId)!;
    setForm({ id: null, printerId, productName: "", duration: "", notes: "", position: queue.jobs.length });
    setFormError("");
  };
  const openEdit = (queue: PrinterQueue, job: PrintJob, position: number) => {
    setForm({ id: job.id, printerId: queue.printerId, productName: job.productName, duration: String(job.durationMinutes / 60), notes: job.notes, position });
    setFormError("");
  };
  const saveJob = () => {
    if (!form || parsedDuration == null || !form.productName.trim()) {
      setFormError("Informe o produto e uma duração válida maior que zero. Exemplos: 28, 2,5h ou 1d 4h.");
      return;
    }
    const job: PrintJob = { id: form.id ?? crypto.randomUUID(), productName: form.productName.trim(), durationMinutes: parsedDuration, notes: form.notes.trim() };
    setSchedule(current => {
      const queues = current.queues.map(queue => {
        const jobs = queue.jobs.filter(item => item.id !== form.id);
        if (queue.printerId === form.printerId) jobs.splice(Math.max(0, Math.min(jobs.length, form.position)), 0, job);
        return { ...queue, jobs };
      });
      return { ...current, queues };
    });
    toast.success(form.id ? "Impressão atualizada" : "Impressão adicionada", { description: "Ordem, início e término recalculados automaticamente." });
    setForm(null);
  };
  const reorder = (jobId: string, printerId: string, position: number) => {
    setSchedule(current => moveJob(current, jobId, printerId, position));
    toast.success("Ordem atualizada", { description: "Os horários de toda a fila foram ajustados." });
  };
  const deleteJob = (queue: PrinterQueue, job: PrintJob, index: number) => {
    setSchedule(current => ({ ...current, queues: current.queues.map(item => item.printerId === queue.printerId ? { ...item, jobs: item.jobs.filter(entry => entry.id !== job.id) } : item) }));
    toast.success("Impressão removida. Fila recalculada.", { action: { label: "Desfazer", onClick: () => setSchedule(current => ({ ...current, queues: current.queues.map(item => {
      if (item.printerId !== queue.printerId || item.jobs.some(entry => entry.id === job.id)) return item;
      const jobs = [...item.jobs]; jobs.splice(Math.min(index, jobs.length), 0, job); return { ...item, jobs };
    }) })) } });
  };
  const setStart = (printerId: string, value: string) => {
    const startAt = new Date(value).getTime();
    if (!value || !Number.isFinite(startAt) || startAt < 0) { toast.error("Informe uma data e um horário de início válidos."); return; }
    setSchedule(current => ({ ...current, queues: current.queues.map(queue => queue.printerId === printerId ? { ...queue, startAt } : queue) }));
    setStartDrafts(current => { const next = { ...current }; delete next[printerId]; return next; });
    toast.success("Início da fila atualizado", { description: "Todas as impressões desta máquina foram reajustadas." });
  };
  const onDrop = (printerId: string, position: number, key: string) => {
    if (!dragged) return;
    const source = schedule.queues.find(queue => queue.printerId === dragged.printerId);
    const sourceIndex = source?.jobs.findIndex(job => job.id === dragged.jobId) ?? -1;
    const adjustedPosition = dragged.printerId === printerId && sourceIndex < position ? position - 1 : position;
    if (dragged.jobId !== key) reorder(dragged.jobId, printerId, adjustedPosition);
    setDragged(null); setDropTarget(null);
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("Arquivo muito grande.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!isPrintSchedule(parsed)) throw new Error("Backup inválido.");
      setBackupToImport(parsed);
    } catch { toast.error("O arquivo não é um backup válido do cronograma FR3D."); }
    if (importRef.current) importRef.current.value = "";
  };
  const exportCsv = () => {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [["Impressora", "Ordem", "Produto", "Horas corridas", "Duração", "Início", "Término", "Observação"], ...computed.flatMap(queue => queue.scheduled.map(job => [queue.name, String(job.order), job.productName, String(job.durationMinutes / 60).replace(".", ","), formatDuration(job.durationMinutes), new Date(job.startAt).toLocaleString("pt-BR"), new Date(job.endAt).toLocaleString("pt-BR"), job.notes]))];
    downloadFile("\uFEFF" + rows.map(row => row.map(escape).join(";")).join("\r\n"), "cronograma-fr3d.csv", "text/csv;charset=utf-8");
  };

  return <div className="schedule-view">
    <div className="section-heading schedule-heading"><div><p className="eyebrow">PLANEJAMENTO DA PRODUÇÃO</p><h2>Cronograma de impressão</h2><p>Uma fila por impressora. Cada término dá início à próxima impressão.</p></div><Button onClick={() => openAdd()} disabled={!!initial.error && !!storageError}><Plus size={16} /> Nova impressão</Button></div>
    {storageError && <div className="schedule-alert" role="alert">{storageError}</div>}
    <section className="schedule-summary" aria-label="Resumo do cronograma">
      <div><span className="schedule-summary-icon"><Printer size={18} /></span><span><small>Filas independentes</small><strong>{schedule.queues.length} impressoras</strong></span></div>
      <div><span className="schedule-summary-icon"><CalendarClock size={18} /></span><span><small>Impressões planejadas</small><strong>{count} {count === 1 ? "impressão" : "impressões"}</strong></span></div>
      <div><span className="schedule-summary-icon"><Clock3 size={18} /></span><span><small>Tempo de máquina somado</small><strong>{formatDuration(totalMinutes, true)}</strong></span></div>
      <div><span className="schedule-summary-icon"><CheckCircle2 size={18} /></span><span><small>Última entrega prevista</small><strong className="schedule-summary-end">{lastEnd ? new Date(lastEnd).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nenhuma impressão"}</strong></span></div>
    </section>
    <div className="schedule-toolbar"><div className="schedule-filters" role="group" aria-label="Filtrar por impressora">{[{ id: "all", name: "Todas" }, ...schedule.queues.map(queue => ({ id: queue.printerId, name: queue.name }))].map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? "selected" : ""} onClick={() => setFilter(item.id)}>{item.name}<span>{item.id === "all" ? count : schedule.queues.find(queue => queue.printerId === item.id)?.jobs.length}</span></button>)}</div><div className="schedule-tools"><button className="secondary-button" disabled={!count} onClick={exportCsv}><Download size={14} /> CSV</button><button className="secondary-button" onClick={() => downloadFile(JSON.stringify(schedule, null, 2), "cronograma-fr3d-backup.json", "application/json")}><Download size={14} /> Backup</button><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload size={14} /> Importar</button><input ref={importRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Importar backup do cronograma" onChange={event => void importBackup(event.target.files?.[0])} /></div></div>
    <div className="schedule-explanation"><Link2 size={15} /><span>Horários encadeados automaticamente · 24 horas por dia, 7 dias por semana · Arraste pelo ícone ou use as setas para reordenar.</span></div>
    {computed.filter(queue => filter === "all" || queue.printerId === filter).map(queue => {
      const total = queue.jobs.reduce((sum, job) => sum + job.durationMinutes, 0);
      const disabled = !!initial.error && !!storageError;
      return <section className={`schedule-queue schedule-queue-${queue.printerId}`} key={queue.printerId} aria-label={`Fila de impressão ${queue.name}`}>
        <div className="schedule-queue-heading"><div className="schedule-machine"><div className={`printer-mark printer-mark-${queue.printerId === "a1" ? "violet" : "blue"}`}><Printer size={20} /></div><div><h3>{queue.name} <span>{queue.jobs.length} na fila</span></h3><p>Bambu Lab {queue.name} <span>·</span> {formatDuration(total, true)} de produção</p></div></div><button className="secondary-button" disabled={disabled} onClick={() => openAdd(queue.printerId)}><Plus size={14} /> Adicionar impressão</button></div>
        <div className="schedule-start-panel"><div><CalendarClock size={17} /><div><strong>Início da fila</strong><small>Este horário é a referência para todas as impressões.</small></div></div><div className="schedule-start-controls"><input type="datetime-local" aria-label={`Início da fila ${queue.name}`} value={startDrafts[queue.printerId] ?? toLocalDateTime(queue.startAt)} disabled={disabled} onChange={event => setStartDrafts(current => ({ ...current, [queue.printerId]: event.target.value }))} /><Button variant="outline" size="sm" disabled={disabled || startDrafts[queue.printerId] === undefined} onClick={() => setStart(queue.printerId, startDrafts[queue.printerId])}>Aplicar início</Button><button className="schedule-now" title="Definir início da fila para agora" disabled={disabled} onClick={() => setStart(queue.printerId, toLocalDateTime(Date.now()))}><RotateCcw size={13} /> Agora</button></div></div>
        <div className="schedule-table-scroll"><table className="schedule-table"><thead><tr><th scope="col">Ordem</th><th scope="col">Nome do produto</th><th scope="col">Duração corrida</th><th scope="col">Início · data e hora</th><th scope="col">Término · data e hora</th><th scope="col">Observação</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{queue.scheduled.map((job, index) => <tr key={job.id} className={`${dragged?.jobId === job.id ? "is-dragging" : ""} ${dropTarget === job.id ? "is-drop-target" : ""}`} onDragOver={event => { if (!dragged || disabled) return; event.preventDefault(); setDropTarget(job.id); }} onDrop={event => { event.preventDefault(); onDrop(queue.printerId, index, job.id); }}>
          <td><div className="schedule-order"><button className="schedule-grip" draggable={!disabled} aria-label={`Arrastar ${job.productName}`} title="Arraste para mudar a ordem ou transferir de impressora" onDragStart={event => { event.dataTransfer.setData("text/plain", job.id); event.dataTransfer.effectAllowed = "move"; setDragged({ jobId: job.id, printerId: queue.printerId }); }} onDragEnd={() => { setDragged(null); setDropTarget(null); }}><GripVertical size={18} /></button><b>{String(job.order).padStart(2, "0")}</b><span className="schedule-order-arrows"><button disabled={disabled || index === 0} onClick={() => reorder(job.id, queue.printerId, index - 1)} aria-label={`Mover ${job.productName} para cima`}><ArrowUp size={12} /></button><button disabled={disabled || index === queue.jobs.length - 1} onClick={() => reorder(job.id, queue.printerId, index + 1)} aria-label={`Mover ${job.productName} para baixo`}><ArrowDown size={12} /></button></span></div></td>
          <td><div className="schedule-product"><strong>{job.productName}</strong><small>{job.endAt <= now ? "Previsão encerrada" : job.startAt <= now ? "Na janela prevista" : "Planejada"}</small></div></td>
          <td><div className="schedule-duration"><strong>{formatDuration(job.durationMinutes, true)}</strong><small>{(job.durationMinutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} h corridas</small></div></td>
          <td><DateCell timestamp={job.startAt} />{index > 0 && <span className="schedule-linked"><Link2 size={10} /> após #{String(index).padStart(2, "0")}</span>}</td><td><DateCell timestamp={job.endAt} /></td>
          <td><p className="schedule-notes">{job.notes || <span>Sem observação</span>}</p></td>
          <td><div className="schedule-row-actions"><button disabled={disabled} className="icon-button" onClick={() => openEdit(queue, job, index)} aria-label={`Editar ${job.productName}`} title="Editar impressão"><Pencil size={15} /></button><button disabled={disabled} className="icon-button schedule-delete" onClick={() => deleteJob(queue, job, index)} aria-label={`Remover ${job.productName}`} title="Remover impressão"><Trash2 size={15} /></button></div></td>
        </tr>)}</tbody></table></div>
        <div className={`schedule-drop-end ${dropTarget === queue.printerId ? "is-drop-target" : ""}`} onDragOver={event => { if (!dragged || disabled) return; event.preventDefault(); setDropTarget(queue.printerId); }} onDrop={event => { event.preventDefault(); onDrop(queue.printerId, queue.jobs.length, queue.printerId); }}>{queue.jobs.length === 0 ? <div className="schedule-empty"><CalendarClock size={28} /><strong>Esta fila está livre</strong><p>Adicione a primeira impressão e defina o horário de início.</p><button className="text-action" disabled={disabled} onClick={() => openAdd(queue.printerId)}><Plus size={14} /> Planejar uma impressão</button></div> : <div className="schedule-queue-footer"><span><Link2 size={13} /> {dragged ? "Solte aqui para mover ao final desta fila" : "Fila contínua, sem sobreposição"}</span><span>Fim previsto <strong>{new Date(queue.scheduled[queue.scheduled.length - 1].endAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</strong></span></div>}</div>
      </section>;
    })}
    <div className="schedule-local-note"><LockKeyhole size={16} /><div><strong>{storageError ? "Armazenamento requer atenção" : lastSaved ? "Alterações salvas neste navegador" : "Controle local"}</strong><p>O cronograma é um planejamento manual; não inicia impressões nem altera a telemetria. Os dados ficam neste navegador, sem sincronização entre dispositivos. Exporte um backup para preservar suas filas.</p></div>{!storageError && <CheckCircle2 size={16} />}</div>
    <Dialog open={!!form} onOpenChange={open => { if (!open) setForm(null); }}><DialogContent className="schedule-dialog"><DialogHeader><DialogTitle>{form?.id ? "Editar impressão" : "Nova impressão"}</DialogTitle><DialogDescription>Defina o produto e a duração. As datas serão calculadas pela posição na fila.</DialogDescription></DialogHeader>{form && <form onSubmit={event => { event.preventDefault(); saveJob(); }} className="schedule-form"><div className="schedule-form-grid"><div><Label htmlFor="schedule-printer">Impressora</Label><select id="schedule-printer" value={form.printerId} onChange={event => { const printerId = event.target.value; setForm({ ...form, printerId, position: schedule.queues.find(queue => queue.printerId === printerId)!.jobs.filter(job => job.id !== form.id).length }); }}>{schedule.queues.map(queue => <option value={queue.printerId} key={queue.printerId}>{queue.name}</option>)}</select></div><div><Label htmlFor="schedule-position">Posição na fila</Label><select id="schedule-position" value={form.position} onChange={event => setForm({ ...form, position: Number(event.target.value) })}>{Array.from({ length: positionCount }, (_, index) => <option key={index} value={index}>#{index + 1}{index === positionCount - 1 ? " · final da fila" : ""}</option>)}</select></div></div><div><Label htmlFor="schedule-product">Nome do produto</Label><Input id="schedule-product" placeholder="Ex.: Vaso orgânico — lote 01" value={form.productName} maxLength={200} onChange={event => setForm({ ...form, productName: event.target.value })} autoFocus required /></div><div><Label htmlFor="schedule-duration">Duração em horas corridas</Label><Input id="schedule-duration" placeholder="Ex.: 28, 2,5h ou 1d 4h" value={form.duration} maxLength={100} onChange={event => setForm({ ...form, duration: event.target.value })} required aria-describedby="schedule-duration-hint" /><p id="schedule-duration-hint" className="schedule-form-hint">{parsedDuration == null ? "Use horas (28), horas e minutos (2h 30min) ou dias (1d 4h). Precisão de 1 minuto." : `${(parsedDuration / 60).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} horas corridas = ${formatDuration(parsedDuration)}`}</p></div><div><Label htmlFor="schedule-notes">Observação <span className="schedule-optional">(opcional)</span></Label><Textarea id="schedule-notes" placeholder="Cor, material, detalhes do lote ou orientações…" value={form.notes} maxLength={2000} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} /></div>{formPreview && <div className="schedule-preview"><div><span>Início calculado</span><DateCell timestamp={formPreview.startAt} /></div><ArrowRight size={18} /><div><span>Término calculado</span><DateCell timestamp={formPreview.endAt} /></div></div>}{formError && <p className="schedule-form-error" role="alert">{formError}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit"><CheckCircle2 size={15} /> {form.id ? "Salvar e recalcular" : "Adicionar à fila"}</Button></DialogFooter></form>}</DialogContent></Dialog>
    <Dialog open={!!backupToImport} onOpenChange={open => { if (!open) setBackupToImport(null); }}><DialogContent><DialogHeader><DialogTitle>Restaurar backup do cronograma?</DialogTitle><DialogDescription>As filas atuais serão substituídas pelas {backupToImport?.queues.reduce((sum, queue) => sum + queue.jobs.length, 0)} impressões do arquivo. Antes da restauração, um backup das filas atuais será baixado automaticamente.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setBackupToImport(null)}>Cancelar</Button><Button onClick={() => { if (!backupToImport) return; downloadFile(JSON.stringify(schedule, null, 2), "cronograma-fr3d-antes-da-restauracao.json", "application/json"); try { localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(backupToImport)); setStorageError(null); } catch { toast.error("Não foi possível salvar o backup neste navegador."); return; } setSchedule(backupToImport); setStartDrafts({}); setBackupToImport(null); toast.success("Backup restaurado e filas recalculadas."); }}>Restaurar backup</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
