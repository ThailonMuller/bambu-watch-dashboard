import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  ArrowUpRight,
  Bot,
  Cable,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  CircleHelp,
  Copy,
  DollarSign,
  Package,
  Pencil,
  Percent,
  ReceiptText,
  RotateCcw,
  Clock3,
  Cloud,
  ExternalLink,
  Fan,
  History,
  PencilLine,
  Layers3,
  LockKeyhole,
  Moon,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { calculateBudget, CUSTOM_BUDGET_INPUT, DEFAULT_BUDGET_INPUT, hasDuplicateProductId, hasInvalidBudgetPercentages, isValidProductId, migrateSpreadsheetSales, type BudgetInput, type BudgetResult } from "../../../shared/budget";
import { debitStock, isLowStock, remainingAfterDebit } from "../../../shared/filament";
import { displayJobName, estimatedCompletionAt } from "../../../shared/printerTelemetry";
import { useTheme } from "../contexts/ThemeContext";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import PrintSchedule from "./PrintSchedule";

type PrinterState = "printing" | "idle" | "offline";
type View = "overview" | "printers" | "settings" | "budget" | "filaments" | "schedule";
type PlateAnimation = { type: "add" | "remove"; index: number } | null;

type PrinterData = {
  id: string;
  name: string;
  model: string;
  serial: string | null;
  accent: "violet" | "blue";
  state: PrinterState;
  progress: number;
  job: string;
  remaining: string;
  nozzle: number | null;
  bed: number | null;
  fanSpeed: number | null;
  layer: string | null;
  layerNumber: number | null;
  totalLayers: number | null;
  firmware: string | null;
  remainingSeconds: number | null;
  wifi: string;
  lastSeen: string;
};

const initialPrinters: PrinterData[] = [
  {
    id: "a1",
    name: "A1",
    model: "Bambu Lab A1",
    serial: null,
    accent: "violet",
    state: "offline",
    progress: 0,
    job: "Aguardando telemetria",
    remaining: "—",
    nozzle: null,
    bed: null,
    fanSpeed: null,
    layer: null,
    layerNumber: null,
    totalLayers: null,
    firmware: null,
    remainingSeconds: null,
    wifi: "—",
    lastSeen: "aguardando",
  },
  {
    id: "p1s",
    name: "P1S",
    model: "Bambu Lab P1S",
    serial: null,
    accent: "blue",
    state: "idle",
    progress: 100,
    job: "Pronta para o próximo trabalho",
    remaining: "—",
    nozzle: 28,
    bed: 25,
    fanSpeed: 0,
    layer: "—",
    layerNumber: null,
    totalLayers: null,
    firmware: null,
    remainingSeconds: null,
    wifi: "-55 dBm",
    lastSeen: "há 18 s",
  },
];

const activity = [
  { time: "10:42", label: "A1 retomou a impressão", detail: "vaso-organico-v3.3mf", tone: "violet" },
  { time: "10:16", label: "P1S concluiu o trabalho", detail: "suporte-fone-final.3mf", tone: "green" },
  { time: "09:58", label: "Telemetria recebida", detail: "Bridge local conectado", tone: "blue" },
  { time: "09:41", label: "A1 atingiu 60°C", detail: "Mesa aquecida", tone: "pink" },
];

const navItems: { id: View; label: string; icon: typeof CircleGauge }[] = [
  { id: "overview", label: "Visão geral", icon: CircleGauge },
  { id: "printers", label: "Impressoras", icon: Printer },
  { id: "schedule", label: "Cronograma", icon: Clock3 },
  { id: "settings", label: "Configuração", icon: Settings2 },
  { id: "budget", label: "Orçamentos", icon: Calculator },
  { id: "filaments", label: "Filamentos", icon: Layers3 },
];

function statusLabel(state: PrinterState) {
  if (state === "printing") return "Imprimindo";
  if (state === "idle") return "Disponível";
  return "Offline";
}

function statusClass(state: PrinterState) {
  if (state === "printing") return "status-pill status-printing";
  if (state === "idle") return "status-pill status-idle";
  return "status-pill status-offline";
}

function formatSync(date: Date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(observedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - observedAt) / 1000));
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds} s`;
  return `há ${Math.floor(seconds / 60)} min`;
}

function formatCompletionTime(remainingSeconds: number | null, state: PrinterState) {
  if (state !== "printing") return null;
  const completionAt = estimatedCompletionAt(remainingSeconds);
  return completionAt == null ? null : new Date(completionAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ProgressRing({ value, tone }: { value: number; tone: "violet" | "blue" }) {
  return (
    <div
      className={`progress-ring progress-ring-${tone}`}
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${value}% concluído`}
    >
      <div className="progress-ring-inner">
        <span>{value}%</span>
        <small>feito</small>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, tone }: { icon: typeof Thermometer; label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={2.2} /></div>
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-hint">{hint}</p>
      </div>
    </div>
  );
}

function PrinterCard({ printer, onDetails }: { printer: PrinterData; onDetails: () => void }) {
  const isPrinting = printer.state === "printing";
  const completionTime = formatCompletionTime(printer.remainingSeconds, printer.state);
  return (
    <article className={`printer-card printer-card-${printer.accent}`}>
      <div className="printer-card-topline">
        <div className="printer-identity">
          <div className={`printer-mark printer-mark-${printer.accent}`}><Printer size={19} /></div>
          <div>
            <div className="printer-name-row"><h3>{printer.name}</h3></div>
            <p className="printer-meta"><Wifi size={13} /> {printer.wifi} <span className="dot-separator">•</span> vista {printer.lastSeen}</p>
          </div>
        </div>
        <button className="icon-button" aria-label={`Mais opções da ${printer.name}`} onClick={() => toast.info("Ações rápidas estarão disponíveis quando o bridge local estiver conectado.")}><MoreHorizontal size={19} /></button>
      </div>

      <div className="printer-card-main">
        <ProgressRing value={printer.progress} tone={printer.accent} />
        <div className="job-summary">
          <div className="job-status-row"><span className={statusClass(printer.state)}><span className="status-dot" /> {statusLabel(printer.state)}</span>{isPrinting && <span className="job-time"><Clock3 size={13} /> {printer.remaining}</span>}</div>
          <h4>{printer.job}</h4>
          <p>{isPrinting ? (completionTime ? `Conclusão estimada às ${completionTime}` : "Conclusão estimada indisponível") : printer.firmware ? `Firmware ${printer.firmware}` : "Firmware não informado"}</p>
          {isPrinting && <p className="printer-layer">{printer.layerNumber != null && printer.totalLayers != null ? `Camada ${printer.layerNumber} / ${printer.totalLayers}` : "Camada não informada"}</p>}
          {isPrinting && <p className="printer-firmware">Firmware {printer.firmware ?? "não informado"}</p>}
          <button className="text-action" onClick={onDetails}>Ver detalhes <ArrowUpRight size={14} /></button>
        </div>
      </div>

      <div className="printer-stats">
        <div><span><Thermometer size={14} /> Bico</span><strong>{printer.nozzle == null ? "—" : `${printer.nozzle}°C`}</strong></div>
        <div><span><Layers3 size={14} /> Mesa</span><strong>{printer.bed == null ? "—" : `${printer.bed}°C`}</strong></div>
        <div><span><Fan size={14} /> Ventilação</span><strong>{printer.fanSpeed == null ? "—" : `${printer.fanSpeed}%`}</strong></div>
      </div>
    </article>
  );
}

function PrinterDetailsPanel({ printer }: { printer: PrinterData }) {
  const layer = printer.layerNumber != null && printer.totalLayers != null ? `${printer.layerNumber} / ${printer.totalLayers}` : "Não informado pelo bridge";
  return (
    <section className="printer-details-panel">
      <div className="panel-heading"><div><p className="eyebrow">IDENTIDADE E TELEMETRIA</p><h3>Detalhes da {printer.name}</h3></div><span className="details-live-badge"><span className="mini-live" /> leitura protegida</span></div>
      <div className="printer-details-grid">
        <div><span>Serial</span><strong>{printer.serial ?? "Não informado"}</strong></div>
        <div><span>Firmware</span><strong>{printer.firmware ?? "Não informado"}</strong></div>
        <div><span>Camada</span><strong>{layer}</strong></div>
        <div><span>Última leitura</span><strong>{printer.lastSeen}</strong></div>
      </div>
    </section>
  );
}

function TelemetryStatusPanel({ printer, historyCount }: { printer: PrinterData; historyCount: number }) {
  return (
    <div className="panel telemetry-status-panel"><div className="panel-heading"><div><p className="eyebrow">FONTE REAL</p><h3>Telemetria da A1</h3></div><Radio size={16} className="panel-live-icon" /></div><p>Os dados abaixo vêm do bridge local por HTTPS autenticado. Nenhum comando é enviado à impressora.</p><div className="telemetry-status-list"><div><span>Estado</span><strong>{statusLabel(printer.state)}</strong></div><div><span>Wi-Fi</span><strong>{printer.wifi}</strong></div><div><span>Ventilação</span><strong>{printer.fanSpeed == null ? "—" : `${printer.fanSpeed}%`}</strong></div><div><span>Snapshots salvos</span><strong>{historyCount}</strong></div></div></div>
  );
}

function SimulationStatusPanel() {
  return (
    <div className="panel simulation-status-panel"><div className="panel-heading"><div><p className="eyebrow">P1S</p><h3>Dados de demonstração</h3></div><Sparkles size={16} className="panel-simulation-icon" /></div><p>A P1S permanece simulada nesta etapa. Gráfico histórico, disponibilidade e atividade real serão conectados quando o bridge da P1S for implementado.</p><span className="simulation-note">Sem telemetria real da P1S</span></div>
  );
}

type TelemetryDiagnostics = {
  responseMs: number | null;
  consecutiveFailures: number;
  fetchedAt: number;
  receivedAt: string | null;
};

function formatDiagnosticAge(ageMs: number | null | undefined) {
  if (ageMs == null || !Number.isFinite(ageMs)) return "Não disponível";
  if (ageMs < 1000) return "menos de 1 s";
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function TelemetryDiagnosticsPanel({ data }: { data: { ageMs?: number | null; diagnostics?: TelemetryDiagnostics; error?: string | null } | undefined }) {
  const diagnostics = data?.diagnostics;
  const age = formatDiagnosticAge(data?.ageMs);
  const received = diagnostics?.receivedAt ? new Date(diagnostics.receivedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }) : "Não recebido";
  return (
    <section className="panel telemetry-diagnostics-panel">
      <div className="panel-heading"><div><p className="eyebrow">DIAGNÓSTICO TÉCNICO</p><h3>Fluxo da telemetria</h3></div><Activity size={16} className="panel-live-icon" /></div>
      <p>Indicadores de passagem entre Worker, backend e interface. Nenhum Access Code ou payload MQTT é exibido.</p>
      <div className="telemetry-status-list"><div><span>Idade do snapshot</span><strong>{age}</strong></div><div><span>Recebido pelo Worker</span><strong>{received}</strong></div><div><span>Resposta do Worker</span><strong>{diagnostics?.responseMs == null ? "Não disponível" : `${diagnostics.responseMs} ms`}</strong></div><div><span>Falhas consecutivas</span><strong>{diagnostics?.consecutiveFailures ?? "Não disponível"}</strong></div></div>
      <span className={`telemetry-diagnostics-note ${data?.error ? "is-warning" : ""}`}>{data?.error ? `Último diagnóstico: ${data.error}` : "Worker acessível; a disponibilidade depende do frescor do snapshot."}</span>
    </section>
  );
}

function MiniChart() {
  return (
    <div className="chart-wrap" aria-label="Gráfico de uso das impressoras nas últimas 24 horas">
      <div className="chart-y-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
      <svg className="usage-chart" viewBox="0 0 640 180" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="violetFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8f77f4" stopOpacity="0.26" /><stop offset="100%" stopColor="#8f77f4" stopOpacity="0" /></linearGradient>
          <linearGradient id="blueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ca9ef" stopOpacity="0.22" /><stop offset="100%" stopColor="#4ca9ef" stopOpacity="0" /></linearGradient>
        </defs>
        {[30, 66, 102, 138].map((y) => <line key={y} x1="0" x2="640" y1={y} y2={y} className="chart-grid" />)}
        <path d="M0 144 C48 141, 58 100, 105 114 S155 145, 198 95 S252 86, 294 112 S347 74, 384 88 S436 110, 478 70 S531 46, 566 77 S606 56, 640 38 L640 180 L0 180Z" fill="url(#violetFill)" />
        <path d="M0 160 C46 155, 72 128, 112 144 S160 106, 208 131 S258 120, 300 141 S347 108, 386 122 S428 136, 476 105 S528 120, 566 99 S604 116, 640 88 L640 180 L0 180Z" fill="url(#blueFill)" />
        <path d="M0 144 C48 141, 58 100, 105 114 S155 145, 198 95 S252 86, 294 112 S347 74, 384 88 S436 110, 478 70 S531 46, 566 77 S606 56, 640 38" fill="none" stroke="#8f77f4" strokeWidth="3" strokeLinecap="round" />
        <path d="M0 160 C46 155, 72 128, 112 144 S160 106, 208 131 S258 120, 300 141 S347 108, 386 122 S428 136, 476 105 S528 120, 566 99 S604 116, 640 88" fill="none" stroke="#4ca9ef" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 0" />
        <circle cx="478" cy="70" r="5" fill="#fff" stroke="#8f77f4" strokeWidth="3" />
      </svg>
      <div className="chart-x-labels"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>Agora</span></div>
    </div>
  );
}

function SettingsView({ simulationMode, setSimulationMode, polling, setPolling, a1Telemetry, historyCount }: { simulationMode: boolean; setSimulationMode: (value: boolean) => void; polling: string; setPolling: (value: string) => void; a1Telemetry: PrinterData | null; historyCount: number }) {
  const [bridgeStatus, setBridgeStatus] = useState<"waiting" | "offline">("waiting");
  const [lastCheck, setLastCheck] = useState("Ainda não verificado");
  const [telemetryErrors, setTelemetryErrors] = useState([
    { id: 1, title: "Bridge local não conectado", detail: "Nenhuma mensagem MQTT/TLS foi recebida nesta sessão.", time: "Agora", tone: "warning" },
    { id: 2, title: "Telemetria em modo demonstração", detail: "Os dados exibidos no painel são simulados até o bridge ser configurado.", time: "Sessão atual", tone: "info" },
  ]);

  const checkBridge = () => {
    setBridgeStatus("offline");
    setLastCheck(formatSync(new Date()));
    setTelemetryErrors((current) => current.some((error) => error.id === 1) ? current : [{ id: 1, title: "Bridge local não conectado", detail: "A verificação terminou sem receber resposta MQTT/TLS.", time: "Agora", tone: "warning" }, ...current]);
    toast.info("Verificação concluída", { description: "O bridge ainda não respondeu. O painel permanece em modo demonstração." });
  };

  const bridgeHasTelemetry = Boolean(a1Telemetry && a1Telemetry.state !== "offline");
  const bridgeIsOnline = bridgeStatus !== "offline" && bridgeHasTelemetry;

  return (
    <div className="settings-view">
      <div className="section-heading"><div><p className="eyebrow">CONTROLE LOCAL</p><h2>Configuração do monitoramento</h2><p>Defina como o painel deve receber e apresentar a telemetria das suas máquinas.</p></div><div className="secure-badge"><ShieldCheck size={16} /> Dados locais</div></div>
      <div className="settings-grid">
        <section className="settings-card featured-settings">
          <div className="settings-card-heading"><div className="settings-symbol purple"><Cable size={19} /></div><div><h3>Bridge local</h3><p>Conector seguro entre sua rede e o dashboard.</p></div><span className={`status-pill ${bridgeStatus === "offline" ? "status-offline" : "status-idle"}`}><span className="status-dot" /> {bridgeStatus === "offline" ? "Sem resposta" : bridgeIsOnline ? "Telemetria ativa" : "Aguardando"}</span></div>
          <div className="bridge-health-grid"><div><span>Status da conexão</span><strong className={bridgeStatus === "offline" ? "health-danger" : bridgeIsOnline ? "health-online" : "health-waiting"}>{bridgeStatus === "offline" ? "Bridge offline" : bridgeIsOnline ? "Telemetria recebida" : "Aguardando bridge"}</strong></div><div><span>Última verificação</span><strong>{lastCheck}</strong></div><div><span>Última telemetria</span><strong>{a1Telemetry ? a1Telemetry.lastSeen : "Nenhuma recebida"}</strong></div><div><span>Latência MQTT</span><strong>Local no bridge</strong></div></div>
          <div className="bridge-steps"><div className="bridge-step done"><span>1</span><div><strong>Instale o bridge na mesma rede</strong><p>O processo local fala com as impressoras via MQTT TLS.</p></div><CheckCircle2 size={18} /></div><div className="bridge-step"><span>2</span><div><strong>Cadastre IP e código de acesso</strong><p>As credenciais ficam somente no dispositivo local.</p></div><CircleHelp size={18} /></div><div className="bridge-step"><span>3</span><div><strong>Envie telemetria resumida</strong><p>O painel recebe apenas status, progresso e temperaturas.</p></div><CircleHelp size={18} /></div></div>
          <div className="bridge-actions"><button className="secondary-button" onClick={checkBridge}><RefreshCw size={15} /> Testar conexão</button><button className="secondary-button" onClick={() => toast.info("O pacote do bridge será disponibilizado na próxima etapa do projeto.")}><ExternalLink size={15} /> Ver guia de instalação</button></div>
        </section>
        <section className="settings-card">
          <div className="settings-card-heading"><div className="settings-symbol blue"><SlidersHorizontal size={19} /></div><div><h3>Preferências</h3><p>Comportamento desta interface.</p></div></div>
          <label className="setting-row"><div><strong>Modo demonstração</strong><p>Usa telemetria simulada enquanto o bridge não está conectado.</p></div><button className={`toggle ${simulationMode ? "on" : ""}`} onClick={() => setSimulationMode(!simulationMode)} aria-pressed={simulationMode}><span /></button></label>
          <label className="setting-row"><div><strong>Frequência de atualização</strong><p>Intervalo de atualização visual do painel.</p></div><select value={polling} onChange={(event) => setPolling(event.target.value)}><option value="5">5s</option><option value="10">10s</option><option value="30">30s</option></select></label>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Nenhuma credencial ou imagem é enviada para o Bambu Handy por esta aplicação.</span></div>
        </section>
        <section className="settings-card printer-identity-settings">
          <div className="settings-card-heading"><div className="settings-symbol purple"><Printer size={19} /></div><div><h3>Identidade da A1</h3><p>Dados reais recebidos pelo Worker.</p></div><History size={17} className="settings-history-icon" /></div>
          <div className="identity-settings-grid"><div><span>Serial</span><strong>{a1Telemetry?.serial ?? "Não informado"}</strong></div><div><span>Firmware</span><strong>{a1Telemetry?.firmware ?? "Não informado"}</strong></div><div><span>Camada</span><strong>{a1Telemetry?.layerNumber != null && a1Telemetry.totalLayers != null ? `${a1Telemetry.layerNumber} / ${a1Telemetry.totalLayers}` : "Não informado"}</strong></div><div><span>Snapshots persistentes</span><strong>{historyCount}</strong></div></div>
          <div className="privacy-note"><ShieldCheck size={15} /><span>O serial e a versão permanecem no fluxo privado do dashboard; o Access Code não é transportado.</span></div>
        </section>
      </div>
      <section className="telemetry-errors-card"><div className="telemetry-errors-heading"><div><p className="eyebrow">DIAGNÓSTICO</p><h3>Erros de telemetria</h3><p>Alertas recebidos durante a comunicação com o bridge e as impressoras.</p></div><div className="error-count-badge"><AlertCircle size={15} /> {telemetryErrors.length} {telemetryErrors.length === 1 ? "alerta" : "alertas"}</div></div>{telemetryErrors.length === 0 ? <div className="telemetry-empty"><CheckCircle2 size={18} /><span>Nenhum erro registrado nesta sessão.</span></div> : <div className="telemetry-error-list">{telemetryErrors.map((error) => <div className={`telemetry-error-row ${error.tone}`} key={error.id}><div className="telemetry-error-icon"><AlertCircle size={17} /></div><div className="telemetry-error-copy"><strong>{error.title}</strong><span>{error.detail}</span></div><time>{error.time}</time><button className="telemetry-dismiss" onClick={() => setTelemetryErrors((current) => current.filter((item) => item.id !== error.id))} aria-label={`Dispensar alerta: ${error.title}`}><X size={15} /></button></div>)}</div>}<div className="telemetry-errors-footer"><span>Os alertas são locais e não contêm credenciais.</span><button className="text-action" onClick={() => setTelemetryErrors([])} disabled={telemetryErrors.length === 0}>Limpar alertas</button></div></section>
    </div>
  );
}


function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function BudgetField({ label, value, onChange, prefix, suffix, step = "1", min = "0" }: { label: string; value: string | number; onChange: (value: string) => void; prefix?: string; suffix?: string; step?: string; min?: string }) {
  const adjustValue = (direction: 1 | -1) => {
    const numericValue = Number(value);
    const numericStep = Number(step) || 1;
    const minimum = Number(min) || 0;
    const nextValue = Math.max(minimum, (Number.isFinite(numericValue) ? numericValue : minimum) + direction * numericStep);
    const decimals = Math.max(0, (step.split(".")[1] || "").length);
    onChange(decimals ? nextValue.toFixed(decimals) : String(nextValue));
  };

  return (
    <label className="budget-field">
      <span>{label}</span>
      <div className={`budget-input-wrap ${suffix ? "has-suffix" : ""}`}>{prefix && <b className="budget-input-prefix">{prefix}</b>}<div className="budget-number-control"><input type="number" inputMode="decimal" value={value} min={min} step={step} onChange={(event) => onChange(event.target.value)} />{suffix && <b className="budget-input-suffix">{suffix}</b>}<span className="budget-stepper" aria-label={`Ajustar ${label}`}><button type="button" className="budget-step-button budget-step-up" onClick={() => adjustValue(1)} aria-label={`Aumentar ${label}`}>+</button><button type="button" className="budget-step-button budget-step-down" onClick={() => adjustValue(-1)} aria-label={`Diminuir ${label}`}>−</button></span></div></div>
    </label>
  );
}

type SpreadsheetItem = {
  productId: string;
  productName: string;
  cost: number;
  salePrice: number;
  salePriceBasis?: "direct";
  shopeePrice?: number;
  shopeePercentage?: number;
  shopeeFixedFee?: number;
  addedAt: string;
  budgetMode?: BudgetMode;
};

type FilamentItem = {
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
  color: string;
  filamentId?: number;
  status: "pending" | "approved" | "rejected";
};

type FilamentHistoryEntry = {
  id: number;
  piece: string;
  grams: number;
  color: string;
  filamentName?: string;
  filamentId?: number;
  status: "approved" | "rejected";
  createdAt: string;
};

const initialFilaments: FilamentItem[] = [
  { id: 1, name: "PLA Silk Violeta", material: "PLA", color: "#9b4dff", grams: 820, lowThreshold: 200 },
  { id: 2, name: "PLA Ciano", material: "PLA", color: "#00d8f5", grams: 145, lowThreshold: 200 },
];

const initialDebits: FilamentDebit[] = [
  { id: 1, piece: "suporte-fone-final.3mf", grams: 38, color: "#9b4dff", filamentId: 1, status: "pending" },
  { id: 2, piece: "vaso-organico-v3.3mf", grams: 76, color: "#00d8f5", filamentId: 2, status: "pending" },
];

function FilamentsView() {
  const [filaments, setFilaments] = useState<FilamentItem[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("falcaorosa3d-filaments") || "null") || initialFilaments; } catch { return initialFilaments; }
  });
  const [debits, setDebits] = useState<FilamentDebit[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("falcaorosa3d-filament-debits") || "null") || initialDebits; } catch { return initialDebits; }
  });
  const [history, setHistory] = useState<FilamentHistoryEntry[]>(() => {
    try { return JSON.parse(window.localStorage.getItem("falcaorosa3d-filament-history") || "[]"); } catch { return []; }
  });
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | FilamentHistoryEntry["status"]>("all");
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<"all" | "7" | "30">("all");
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;
  const [editingHistoryId, setEditingHistoryId] = useState<number | null>(null);
  const [editingHistory, setEditingHistory] = useState({ piece: "", grams: "", filamentId: "", status: "approved" as FilamentHistoryEntry["status"] });
  const [newFilament, setNewFilament] = useState({ name: "", material: "PLA", color: "#9b4dff", grams: "", lowThreshold: "200" });
  const [newDebit, setNewDebit] = useState({ piece: "", grams: "", color: "#9b4dff", filamentId: "" });

  useEffect(() => { window.localStorage.setItem("falcaorosa3d-filaments", JSON.stringify(filaments)); }, [filaments]);
  useEffect(() => { window.localStorage.setItem("falcaorosa3d-filament-debits", JSON.stringify(debits)); }, [debits]);
  useEffect(() => { window.localStorage.setItem("falcaorosa3d-filament-history", JSON.stringify(history)); }, [history]);
  useEffect(() => { setHistory((current) => current.map((entry) => { const linked = entry.filamentId ? filaments.find((item) => item.id === entry.filamentId) : filaments.find((item) => item.color.toLowerCase() === entry.color.toLowerCase()); return linked ? { ...entry, filamentId: linked.id, filamentName: linked.name, color: linked.color } : { ...entry, filamentName: entry.filamentName || "Filamento não identificado" }; })); }, [filaments]);

  const addFilament = () => {
    const grams = Number(newFilament.grams);
    const lowThreshold = Number(newFilament.lowThreshold);
    if (!newFilament.name.trim() || !Number.isFinite(grams) || grams < 0) { toast.error("Informe o nome e uma quantidade válida em gramas"); return; }
    setFilaments((current) => [...current, { id: Date.now(), name: newFilament.name.trim(), material: newFilament.material, color: newFilament.color, grams, lowThreshold: Number.isFinite(lowThreshold) && lowThreshold >= 0 ? lowThreshold : 0 }]);
    setNewFilament({ name: "", material: "PLA", color: "#9b4dff", grams: "", lowThreshold: "200" });
    toast.success("Filamento adicionado ao estoque");
  };

  const selectedDebitFilament = filaments.find((item) => String(item.id) === newDebit.filamentId);
  const debitExceedsStock = Boolean(selectedDebitFilament && Number(newDebit.grams) > selectedDebitFilament.grams);
  const addDebit = () => {
    const grams = Number(newDebit.grams);
    if (!newDebit.piece.trim() || !Number.isFinite(grams) || grams <= 0 || !selectedDebitFilament) { toast.error("Informe a peça, selecione uma bobina e uma quantidade maior que zero"); return; }
    setDebits((current) => [...current, { id: Date.now(), piece: newDebit.piece.trim(), grams, color: selectedDebitFilament.color, filamentId: selectedDebitFilament.id, status: "pending" }]);
    setNewDebit({ piece: "", grams: "", color: selectedDebitFilament.color, filamentId: newDebit.filamentId });
    toast.info("Débito aguardando confirmação");
  };

  const updateFilament = (id: number, patch: Partial<FilamentItem>) => setFilaments((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const startNameEdit = (item: FilamentItem) => { setEditingNameId(item.id); setEditingName(item.name); };
  const saveNameEdit = (id: number) => {
    const name = editingName.trim();
    if (!name) { toast.error("O nome do filamento não pode ficar vazio"); return; }
    updateFilament(id, { name });
    setEditingNameId(null);
    toast.success("Nome do filamento atualizado");
  };
  const addHistory = (debit: FilamentDebit, status: FilamentHistoryEntry["status"]) => { const filamentName = filaments.find((item) => item.id === debit.filamentId)?.name || filaments.find((item) => item.color.toLowerCase() === debit.color.toLowerCase())?.name || "Filamento não identificado"; setHistory((current) => [{ id: Date.now(), piece: debit.piece, grams: debit.grams, color: debit.color, filamentName, status, createdAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) }, ...current]); };
  const approveDebit = (debit: FilamentDebit) => {
    setFilaments((current) => {
      const matchingIndex = current.findIndex((item) => debit.filamentId ? item.id === debit.filamentId : item.color.toLowerCase() === debit.color.toLowerCase());
      if (matchingIndex < 0) return current;
      return current.map((item, index) => index === matchingIndex ? { ...item, grams: debitStock(item.grams, debit.grams) } : item);
    });
    setDebits((current) => current.map((item) => item.id === debit.id ? { ...item, status: "approved" } : item));
    addHistory(debit, "approved");
    toast.success("Débito aprovado", { description: `${debit.grams} g descontados do estoque compatível para ${debit.piece}.` });
  };
  const rejectDebit = (id: number) => { const debit = debits.find((item) => item.id === id); if (debit) addHistory(debit, "rejected"); setDebits((current) => current.map((item) => item.id === id ? { ...item, status: "rejected" } : item)); toast.info("Débito rejeitado"); };
  const pendingDebits = debits.filter((item) => item.status === "pending");
  const parseHistoryDate = (value: string) => { const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])); const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; };
  const filteredHistory = history.filter((entry) => { if (historyStatusFilter !== "all" && entry.status !== historyStatusFilter) return false; if (historyPeriodFilter === "all") return true; const date = parseHistoryDate(entry.createdAt); if (!date) return true; return Date.now() - date.getTime() <= Number(historyPeriodFilter) * 24 * 60 * 60 * 1000; });
  const approvedGrams = filteredHistory.filter((entry) => entry.status === "approved").reduce((sum, entry) => sum + entry.grams, 0);
  const rejectedGrams = filteredHistory.filter((entry) => entry.status === "rejected").reduce((sum, entry) => sum + entry.grams, 0);
  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const visibleHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  const chartData = Object.values(filteredHistory.reduce<Record<string, { name: string; color: string; grams: number }>>((acc, entry) => { const key = entry.filamentName || "Filamento não identificado"; acc[key] = acc[key] || { name: key, color: entry.color, grams: 0 }; acc[key].grams += entry.grams; return acc; }, {}));
  const chartMax = Math.max(...chartData.map((item) => item.grams), 1);
  useEffect(() => { setHistoryPage(1); }, [historyStatusFilter, historyPeriodFilter]);
  useEffect(() => { if (historyPage > historyPageCount) setHistoryPage(historyPageCount); }, [historyPage, historyPageCount]);
  const startHistoryEdit = (entry: FilamentHistoryEntry) => { const linked = entry.filamentId ? filaments.find((item) => item.id === entry.filamentId) : filaments.find((item) => item.color.toLowerCase() === entry.color.toLowerCase()); setEditingHistoryId(entry.id); setEditingHistory({ piece: entry.piece, grams: String(entry.grams), filamentId: linked ? String(linked.id) : "", status: entry.status }); };
  const saveHistoryEdit = (id: number) => { const piece = editingHistory.piece.trim(); const grams = Number(editingHistory.grams); const linked = filaments.find((item) => String(item.id) === editingHistory.filamentId); if (!piece || !Number.isFinite(grams) || grams <= 0 || !linked) { toast.error("Informe uma peça, quantidade e bobina válida"); return; } setHistory((current) => current.map((entry) => entry.id === id ? { ...entry, piece, grams, filamentId: linked.id, filamentName: linked.name, color: linked.color, status: editingHistory.status } : entry)); setEditingHistoryId(null); toast.success("Registro atualizado", { description: `Bobina vinculada: ${linked.name}.` }); };
  const removeHistoryEntry = (id: number) => { if (!window.confirm("Remover este registro do histórico?")) return; setHistory((current) => current.filter((entry) => entry.id !== id)); toast.info("Registro removido do histórico"); };
  const clearHistory = () => { if (!history.length) { toast.info("O histórico já está vazio"); return; } if (!window.confirm(`Excluir definitivamente os ${history.length} registros do histórico? Essa ação não pode ser desfeita.`)) return; setHistory([]); setHistoryPage(1); toast.success("Histórico limpo"); };

  return <div className="filaments-view">
    <div className="section-heading"><div><p className="eyebrow">MATERIAIS</p><h2>Consumo de filamentos</h2><p>Controle seu estoque em gramas e confirme os débitos gerados pelas impressões.</p></div><div className="budget-safe-note"><LockKeyhole size={16} /> controle local</div></div>
    <section className="filament-add-card"><div className="filament-card-heading"><div className="settings-symbol purple"><Plus size={19} /></div><div><h3>Adicionar filamento</h3><p>Cadastre uma bobina, a quantidade disponível e o limite para aviso.</p></div></div><div className="filament-form-grid"><label className="budget-field"><span>Nome do filamento</span><input className="budget-text-input" value={newFilament.name} onChange={(event) => setNewFilament((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: PLA Silk Violeta" /></label><label className="budget-field"><span>Material</span><select value={newFilament.material} onChange={(event) => setNewFilament((current) => ({ ...current, material: event.target.value }))}><option>PLA</option><option>PETG</option><option>ABS</option><option>TPU</option></select></label><label className="budget-field"><span>Quantidade (g)</span><input className="budget-text-input" type="number" min="0" step="1" value={newFilament.grams} onChange={(event) => setNewFilament((current) => ({ ...current, grams: event.target.value }))} placeholder="1000" /></label><label className="budget-field"><span>Avisar abaixo de (g)</span><input className="budget-text-input" type="number" min="0" step="1" value={newFilament.lowThreshold} onChange={(event) => setNewFilament((current) => ({ ...current, lowThreshold: event.target.value }))} /></label><label className="budget-field color-field"><span>Cor da bobina</span><div className="color-input-wrap"><input type="color" value={newFilament.color} onChange={(event) => setNewFilament((current) => ({ ...current, color: event.target.value }))} /><code>{newFilament.color.toUpperCase()}</code></div></label><button className="filament-primary-button" onClick={addFilament}><Plus size={16} /> Adicionar ao estoque</button></div></section>
    <div className="filament-stock-grid">{filaments.map((item) => { const low = isLowStock(item.grams, item.lowThreshold); const isEditing = editingNameId === item.id; return <article className={`filament-spool-card ${low ? "is-low" : ""}`} key={item.id}><div className="spool-top"><div className="spool-disc" style={{ background: `linear-gradient(135deg, ${item.color}, #241035)` }}><span /></div><div className="spool-copy"><div><span className="filament-material">{item.material}</span>{low && <span className="low-badge"><AlertCircle size={11} /> Filamento baixo</span>}</div>{isEditing ? <div className="name-edit-row"><input value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveNameEdit(item.id); if (event.key === "Escape") setEditingNameId(null); }} autoFocus /><button onClick={() => saveNameEdit(item.id)} aria-label="Salvar nome"><Check size={13} /></button></div> : <div className="spool-name-row"><h3>{item.name}</h3><button className="edit-name-button" onClick={() => startNameEdit(item)} aria-label={`Editar nome de ${item.name}`}><Pencil size={12} /></button></div>}<p>Limite de aviso: {item.lowThreshold} g</p></div><input className="inline-color-input" type="color" value={item.color} onChange={(event) => updateFilament(item.id, { color: event.target.value })} aria-label={`Editar cor de ${item.name}`} /></div><div className="spool-amount"><strong>{item.grams} g</strong><span>disponíveis</span></div><div className="stock-progress"><span style={{ width: `${Math.min(100, Math.max(4, item.grams / Math.max(item.lowThreshold * 5, 1) * 100))}%`, background: item.color }} /></div><div className="spool-edit-row"><label>Estoque (g)<input type="number" min="0" value={item.grams} onChange={(event) => updateFilament(item.id, { grams: Math.max(0, Number(event.target.value) || 0) })} /></label><label>Aviso (g)<input type="number" min="0" value={item.lowThreshold} onChange={(event) => updateFilament(item.id, { lowThreshold: Math.max(0, Number(event.target.value) || 0) })} /></label></div></article>; })}</div>
    <section className="debit-card"><div className="filament-card-heading"><div className="settings-symbol pink"><ReceiptText size={19} /></div><div><h3>Débitos de filamentos</h3><p>Confirme ou rejeite o material usado por cada impressão.</p></div><span className="pending-count">{pendingDebits.length} aguardando</span></div><div className="debit-add-form"><input className="budget-text-input debit-piece-input" value={newDebit.piece} onChange={(event) => setNewDebit((current) => ({ ...current, piece: event.target.value }))} placeholder="Nome da peça / arquivo" /><div className="debit-add-controls"><select className="debit-spool-select" value={newDebit.filamentId} onChange={(event) => { const filament = filaments.find((item) => String(item.id) === event.target.value); setNewDebit((current) => ({ ...current, filamentId: event.target.value, color: filament?.color || current.color })); }} aria-label="Selecionar bobina"><option value="">Selecionar bobina</option>{filaments.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.grams} g</option>)}</select><input className="debit-color" type="color" value={newDebit.color} onChange={(event) => setNewDebit((current) => ({ ...current, color: event.target.value }))} aria-label="Cor do débito" /><input className="budget-text-input grams-input" type="number" min="0" step="1" value={newDebit.grams} onChange={(event) => setNewDebit((current) => ({ ...current, grams: event.target.value }))} placeholder="Gramas consumidas" /><button className="filament-primary-button" onClick={addDebit}><Plus size={15} /> Adicionar débito</button></div>{debitExceedsStock && <div className="stock-warning" role="alert"><AlertCircle size={15} /><span>O débito de {newDebit.grams || 0} g é maior que o estoque disponível de {selectedDebitFilament?.grams ?? 0} g em {selectedDebitFilament?.name}.</span></div>}</div><div className="debit-list">{debits.map((debit) => { const linked = debit.filamentId ? filaments.find((item) => item.id === debit.filamentId) : filaments.find((item) => item.color.toLowerCase() === debit.color.toLowerCase()); const currentStock = linked?.grams ?? 0; const afterDebit = linked ? remainingAfterDebit(currentStock, debit.grams) : null; return <div className={`debit-row debit-${debit.status}`} key={debit.id}><span className="debit-color-dot" style={{ background: debit.color }} /><div className="debit-copy"><strong>{debit.piece}</strong><span>{linked?.name || "Bobina não identificada"} · {debit.grams} g · {debit.status === "pending" ? "aguardando confirmação" : debit.status === "approved" ? "aprovado" : "rejeitado"}</span><small className="debit-stock-remaining">Estoque restante: <b>{currentStock} g</b>{debit.status === "pending" && <> · após este débito: <b>{afterDebit} g</b></>}</small></div>{debit.status === "pending" ? <div className="debit-actions"><button className="approve-button" onClick={() => approveDebit(debit)}><Check size={14} /> Aprovar</button><button className="reject-button" onClick={() => rejectDebit(debit.id)}><X size={14} /> Rejeitar</button></div> : <span className="debit-status-label">{debit.status === "approved" ? "Confirmado" : "Rejeitado"}</span>}</div>; })}</div></section>
    <section className="history-card"><div className="filament-card-heading"><div className="settings-symbol blue"><History size={19} /></div><div><h3>Histórico de consumo</h3><p>Registro organizado dos débitos confirmados ou rejeitados.</p></div><div className="history-heading-actions"><span className="history-total">{filteredHistory.length} registros</span><button className="clear-history-button" onClick={clearHistory} disabled={!history.length}><Trash2 size={13} /> Limpar histórico</button></div></div><div className="history-filters"><label>Período<select value={historyPeriodFilter} onChange={(event) => setHistoryPeriodFilter(event.target.value as typeof historyPeriodFilter)}><option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select></label><label>Status<select value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value as typeof historyStatusFilter)}><option value="all">Todos</option><option value="approved">Aprovados</option><option value="rejected">Rejeitados</option></select></label></div><div className="history-summary"><div><span>Total filtrado</span><strong>{approvedGrams + rejectedGrams} g</strong></div><div><span>Aprovado</span><strong className="summary-approved">{approvedGrams} g</strong></div><div><span>Rejeitado</span><strong className="summary-rejected">{rejectedGrams} g</strong></div></div><div className="consumption-chart"><div className="chart-heading"><div><strong>Consumo por bobina</strong><span>Somatório do período e status selecionados</span></div><BarChart3 size={17} /></div>{chartData.length === 0 ? <div className="chart-empty">Sem dados para desenhar neste filtro.</div> : <div className="chart-bars">{chartData.map((item) => <div className="chart-bar-row" key={item.name}><div className="chart-label"><span>{item.name}</span><strong>{item.grams} g</strong></div><div className="chart-track"><span style={{ width: `${Math.max(5, item.grams / chartMax * 100)}%`, background: item.color }} /></div></div>)}</div>}</div>{visibleHistory.length === 0 ? <div className="history-empty"><History size={21} /><span>{history.length ? "Nenhum registro corresponde aos filtros." : "Nenhum consumo registrado ainda."}</span></div> : <div className="history-list">{visibleHistory.map((entry) => editingHistoryId === entry.id ? <div className="history-row history-edit-row" key={entry.id}><span className="debit-color-dot" style={{ background: entry.color }} /><input className="history-edit-input" value={editingHistory.piece} onChange={(event) => setEditingHistory((current) => ({ ...current, piece: event.target.value }))} /><input className="history-edit-grams" type="number" min="1" value={editingHistory.grams} onChange={(event) => setEditingHistory((current) => ({ ...current, grams: event.target.value }))} /><select className="history-edit-spool" value={editingHistory.filamentId} onChange={(event) => setEditingHistory((current) => ({ ...current, filamentId: event.target.value }))} aria-label="Editar bobina do registro"><option value="">Selecionar bobina</option>{filaments.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.grams} g</option>)}</select><select className="history-edit-status" value={editingHistory.status} onChange={(event) => setEditingHistory((current) => ({ ...current, status: event.target.value as FilamentHistoryEntry["status"] }))}><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option></select><button className="history-save-button" onClick={() => saveHistoryEdit(entry.id)} aria-label="Salvar registro"><Check size={14} /></button><button className="history-cancel-button" onClick={() => setEditingHistoryId(null)} aria-label="Cancelar edição"><X size={14} /></button></div> : <div className="history-row" key={entry.id}><span className="debit-color-dot" style={{ background: entry.color }} /><div className="history-copy"><strong>{entry.piece}</strong><span className="history-filament-name">{entry.filamentName || "Filamento não identificado"}</span><span>{entry.createdAt} · {entry.grams} g</span></div><span className={`history-status ${entry.status}`}>{entry.status === "approved" ? "Aprovado" : "Rejeitado"}</span><div className="history-actions"><button onClick={() => startHistoryEdit(entry)} aria-label={`Editar ${entry.piece}`}><PencilLine size={13} /></button><button onClick={() => removeHistoryEntry(entry.id)} aria-label={`Excluir ${entry.piece}`}><Trash2 size={13} /></button></div></div>)}</div>}{historyPageCount > 1 && <div className="history-pagination"><button disabled={historyPage === 1} onClick={() => setHistoryPage((page) => page - 1)}>Anterior</button><span>Página {historyPage} de {historyPageCount}</span><button disabled={historyPage === historyPageCount} onClick={() => setHistoryPage((page) => page + 1)}>Próxima</button></div>}</section>
  </div>;
}

type BudgetMode = "store" | "custom";

function BudgetView() {
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("store");
  const [input, setInput] = useState<BudgetInput>({ ...DEFAULT_BUDGET_INPUT, plateCosts: [...DEFAULT_BUDGET_INPUT.plateCosts] });
  const [result, setResult] = useState<BudgetResult>(() => calculateBudget(DEFAULT_BUDGET_INPUT));
  const [loadedSpreadsheet] = useState(() => {
    try {
      const saved = window.localStorage.getItem("falcaorosa3d-spreadsheet");
      if (saved) return migrateSpreadsheetSales(JSON.parse(saved) as SpreadsheetItem[]);
    } catch { /* ignore invalid local spreadsheet */ }
    return { items: [] as SpreadsheetItem[], migratedCount: 0, defaultRatesCount: 0 };
  });
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetItem[]>(loadedSpreadsheet.items);
  const [spreadsheetMigrationWarning, setSpreadsheetMigrationWarning] = useState(loadedSpreadsheet.defaultRatesCount);
  const [spreadsheetError, setSpreadsheetError] = useState("");
  const [focusedPlateIndex, setFocusedPlateIndex] = useState<number | null>(null);
  const [plateAnimation, setPlateAnimation] = useState<PlateAnimation>(null);
  const [showShopeePrice, setShowShopeePrice] = useState(false);
  const modeDefaults = budgetMode === "store" ? DEFAULT_BUDGET_INPUT : CUSTOM_BUDGET_INPUT;

  useEffect(() => {
    window.localStorage.setItem("falcaorosa3d-spreadsheet", JSON.stringify(spreadsheet));
  }, [spreadsheet]);

  const plateTotal = input.plateCosts.reduce<number>((total, cost) => {
    const numericCost = typeof cost === "string" ? Number.parseFloat(cost.trim().replace(",", ".")) : Number(cost);
    return total + (Number.isFinite(numericCost) ? numericCost : 0);
  }, 0);

  const updateNumber = (field: Exclude<keyof BudgetInput, "productId" | "productName" | "plateCosts">, value: string) => {
    const parsed = Number(value.replace(",", "."));
    setInput((current) => ({ ...current, [field]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  const updatePlate = (index: number, value: string) => {
    setInput((current) => ({ ...current, plateCosts: current.plateCosts.map((cost, plateIndex) => plateIndex === index ? value : cost) }));
  };

  const normalizePlate = (index: number) => {
    setInput((current) => ({ ...current, plateCosts: current.plateCosts.map((cost, plateIndex) => {
      if (plateIndex !== index || String(cost).trim() === "") return plateIndex === index ? "" : cost;
      const numericCost = Number(String(cost).replace(",", "."));
      return Number.isFinite(numericCost) && numericCost >= 0 ? numericCost.toFixed(2) : "";
    }) }));
  };

  const plateDisplayValue = (cost: number | string, index: number) => {
    if (focusedPlateIndex === index) return String(cost).replace(".", ",");
    if (String(cost).trim() === "") return "";
    const numericCost = Number(String(cost).replace(",", "."));
    return Number.isFinite(numericCost) ? numericCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  };

  const addPlate = () => {
    if (plateAnimation) return;
    const index = input.plateCosts.length;
    setInput((current) => ({ ...current, plateCosts: [...current.plateCosts, 0] }));
    setPlateAnimation({ type: "add", index });
    window.setTimeout(() => setPlateAnimation(null), 460);
  };
  const duplicatePlate = (index: number) => {
    if (plateAnimation) return;
    const nextIndex = index + 1;
    setInput((current) => ({ ...current, plateCosts: [...current.plateCosts.slice(0, nextIndex), current.plateCosts[index] ?? 0, ...current.plateCosts.slice(nextIndex)] }));
    setPlateAnimation({ type: "add", index: nextIndex });
    window.setTimeout(() => setPlateAnimation(null), 460);
  };
  const removePlate = (index: number) => {
    if (plateAnimation || input.plateCosts.length <= 1) return;
    setPlateAnimation({ type: "remove", index });
    window.setTimeout(() => {
      setInput((current) => ({ ...current, plateCosts: current.plateCosts.length > 1 ? current.plateCosts.filter((_, plateIndex) => plateIndex !== index) : current.plateCosts }));
      setPlateAnimation(null);
    }, 260);
  };

  const calculate = () => {
    if (hasInvalidBudgetPercentages(input)) {
      toast.error("Percentuais inválidos", { description: "Perda e taxa Shopee precisam ser menores que 100%." });
      return;
    }
    const nextResult = calculateBudget(input);
    setResult(nextResult);
    toast.success("Orçamento calculado");
  };

  const switchBudgetMode = (nextMode: BudgetMode) => {
    const defaults = nextMode === "store" ? DEFAULT_BUDGET_INPUT : CUSTOM_BUDGET_INPUT;
    setBudgetMode(nextMode);
    setInput((current) => ({ ...defaults, productId: current.productId, productName: current.productName, plateCosts: [...current.plateCosts] }));
    setResult(calculateBudget(defaults));
    setSpreadsheetError("");
    toast.info(nextMode === "store" ? "Modo Produto de Loja selecionado" : "Modo Personalizado selecionado");
  };

  const restoreDefaults = () => {
    const defaults = { ...modeDefaults, plateCosts: [...modeDefaults.plateCosts] };
    setInput(defaults);
    setResult(calculateBudget(defaults));
    setSpreadsheetError("");
    toast.info("Valores padrão restaurados");
  };

  const addToSpreadsheet = () => {
    const productId = input.productId.trim();
    const productName = input.productName.trim();
    if (!productId) {
      setSpreadsheetError("Informe o ID do produto antes de adicionar à planilha.");
      toast.error("ID do produto obrigatório");
      return;
    }
    if (!isValidProductId(productId)) {
      setSpreadsheetError("O ID do produto deve conter somente números.");
      toast.error("ID inválido");
      return;
    }
    if (!productName) {
      setSpreadsheetError("Informe o nome do produto antes de adicionar à planilha.");
      toast.error("Nome do produto obrigatório");
      return;
    }
    if (hasDuplicateProductId(spreadsheet, productId)) {
      setSpreadsheetError("Este ID já está cadastrado na planilha. Use um ID numérico diferente.");
      toast.error("ID duplicado");
      return;
    }
    setSpreadsheet((current) => [...current, { productId, productName, cost: result.operationalCost, salePrice: result.priceBeforeShopee, salePriceBasis: "direct", shopeePrice: result.suggestedPrice, shopeePercentage: input.shopeePercentage, shopeeFixedFee: input.shopeeFixedFee, addedAt: new Date().toLocaleDateString("pt-BR"), budgetMode }]);
    setSpreadsheetError("");
    toast.success("Produto adicionado à planilha", { description: `${productName} está pronto para controle interno.` });
  };

  const removeSpreadsheetItem = (index: number) => setSpreadsheet((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const newSpreadsheet = () => {
    if (spreadsheet.length > 0) window.localStorage.setItem("falcaorosa3d-last-spreadsheet", JSON.stringify(spreadsheet));
    setSpreadsheet([]);
    setSpreadsheetError("");
    toast.info("Nova planilha criada", { description: "A planilha atual foi guardada para restauração." });
  };

  const restoreLastSpreadsheet = () => {
    const saved = window.localStorage.getItem("falcaorosa3d-last-spreadsheet");
    if (!saved) { toast.info("Nenhuma planilha anterior encontrada"); return; }
    try {
      const migrated = migrateSpreadsheetSales(JSON.parse(saved) as SpreadsheetItem[]);
      setSpreadsheet(migrated.items);
      setSpreadsheetMigrationWarning(migrated.defaultRatesCount);
      setSpreadsheetError("");
      toast.success("Última planilha restaurada");
    } catch { toast.error("Não foi possível restaurar a última planilha"); }
  };

  const downloadSpreadsheet = () => {
    if (spreadsheet.length === 0) { toast.info("Adicione pelo menos um produto antes de baixar"); return; }
    const rows = [["ID do produto", "Nome do produto", "Tipo de orçamento", "Custo operacional", "Valor de venda direta", "Preço Shopee (referência)", "Adicionado em"], ...spreadsheet.map((item) => [item.productId, item.productName, item.budgetMode === "custom" ? "Personalizado" : "Produto de Loja", item.cost.toFixed(2).replace(".", ","), item.salePrice.toFixed(2).replace(".", ","), item.shopeePrice == null ? "" : item.shopeePrice.toFixed(2).replace(".", ","), item.addedAt])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";" )).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "planilha-falcao-rosa3d.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado");
  };

  return (
    <div className="budget-view">
      <div className="section-heading budget-heading"><div><p className="eyebrow">PRECIFICAÇÃO</p><h2>Simulador de orçamento</h2><p>Monte um preço de venda e adicione o produto à planilha de controle interno.</p></div><div className="budget-safe-note"><Calculator size={16} /> cálculo local</div></div><div className="budget-mode-switch" role="tablist" aria-label="Tipo de orçamento"><button className={budgetMode === "store" ? "is-active" : ""} onClick={() => switchBudgetMode("store")} role="tab" aria-selected={budgetMode === "store"}>Produto de Loja</button><button className={budgetMode === "custom" ? "is-active" : ""} onClick={() => switchBudgetMode("custom")} role="tab" aria-selected={budgetMode === "custom"}>Personalizado</button><span>{budgetMode === "store" ? "Preço padrão para produtos de loja · MKP 130% · perda 10% · taxa Shopee 14%" : "Encomenda especial · margem diferenciada · MKP 150% · perda 30% · taxa Shopee 14%"}</span></div>
      <div className="budget-layout">
        <section className="budget-form-card">
          <div className={`budget-card-title ${budgetMode === "custom" ? "custom-budget-title" : ""}`}><div className={`settings-symbol ${budgetMode === "custom" ? "custom-budget-symbol" : "purple"}`}>{budgetMode === "custom" ? <Sparkles size={19} /> : <Package size={19} />}</div><div><h3>Dados do produto {budgetMode === "custom" && <span className="custom-mode-chip">Personalizado</span>}</h3><p>{budgetMode === "custom" ? "Encomenda especial · margem diferenciada e acompanhamento sob medida." : "O ID e o nome identificam o item no controle de vendas."}</p></div></div>
          <div className="budget-fields-grid budget-identity-grid"><label className="budget-field"><span>ID do produto <i>somente números</i></span><input className="budget-text-input" type="text" inputMode="numeric" pattern="[0-9]*" value={input.productId} onChange={(event) => { setSpreadsheetError(""); setInput((current) => ({ ...current, productId: event.target.value.replace(/\D/g, "") })); }} placeholder="Ex.: 1001" /></label><label className="budget-field"><span>Nome do produto <i>obrigatório</i></span><input className="budget-text-input" type="text" value={input.productName} onChange={(event) => { setSpreadsheetError(""); setInput((current) => ({ ...current, productName: event.target.value })); }} placeholder="Ex.: suporte de fone" /></label></div>
          <div className="plates-header"><div><span className="budget-section-label">Placas do OrcaSlicer</span><small>Adicione uma linha para cada placa usada na impressão.</small></div></div>
          <div className="plates-list">{input.plateCosts.map((cost, index) => <div className={`plate-row ${focusedPlateIndex === index ? "is-focused" : ""} ${plateAnimation?.index === index ? `plate-${plateAnimation.type}-animation` : ""} ${String(cost).startsWith("-") ? "has-invalid-value" : ""}`} key={`plate-${index}`}><div className="plate-card-header"><span>Placa {index + 1}</span></div><div className="plate-card-body"><label className="budget-field plate-value-field"><span className="plate-field-label">Valor da placa {index + 1}</span><div className="budget-input-wrap"><b>R$</b><input type="text" inputMode="decimal" min="0" step="0.01" value={plateDisplayValue(cost, index)} onFocus={() => setFocusedPlateIndex(index)} onBlur={() => { normalizePlate(index); setFocusedPlateIndex(null); }} onChange={(event) => updatePlate(index, event.target.value.replace(/[^0-9,.-]/g, ""))} aria-label={`Valor da placa ${index + 1}`} /></div>{String(cost).startsWith("-") && <small className="plate-validation-message">O valor não pode ser negativo.</small>}</label><div className="plate-actions"><button className="duplicate-plate-button" onClick={() => duplicatePlate(index)} disabled={Boolean(plateAnimation)} aria-label={`Duplicar placa ${index + 1}`}><Copy size={14} /></button><button className="remove-plate-button" onClick={() => removePlate(index)} disabled={input.plateCosts.length === 1 || Boolean(plateAnimation)} aria-label={`Remover placa ${index + 1}`}><X size={15} /></button></div></div></div>)}<div className={`plate-add-tile ${plateAnimation?.type === "add" && plateAnimation.index === input.plateCosts.length - 1 ? "plate-add-animation" : ""}`}><button className="add-plate-button" onClick={addPlate} disabled={Boolean(plateAnimation)}><Plus size={16} /> Adicionar placa</button></div></div>
          <div className="plates-total"><ReceiptText size={15} /><span>Soma das placas</span><strong>{currency(plateTotal)}</strong></div>
          <div className="budget-fields-grid budget-costs-grid"><BudgetField label="Embalagem" value={input.packagingCost} prefix="R$" onChange={(value) => updateNumber("packagingCost", value)} />{budgetMode === "store" && <BudgetField label="Outros custos" value={input.otherCosts} prefix="R$" onChange={(value) => updateNumber("otherCosts", value)} />}</div>
          <div className="budget-divider" />
          <div className="budget-card-title compact"><div className="settings-symbol blue"><SlidersHorizontal size={19} /></div><div><h3>Parâmetros de preço · {budgetMode === "store" ? "Produto de Loja" : "Personalizado"}</h3><p>{budgetMode === "store" ? "Referência para itens cadastrados na loja." : "Use para encomendas especiais e projetos sob medida."}</p></div></div>
          <div className="budget-fields-grid budget-parameters-grid"><BudgetField label="MKP" value={input.mkp} suffix="%" step="1" onChange={(value) => updateNumber("mkp", value)} /><BudgetField label="Perda" value={input.lossPercentage} suffix="%" step="1" onChange={(value) => updateNumber("lossPercentage", value)} /><BudgetField label="Depreciação" value={input.depreciationPercentage} suffix="%" step="1" onChange={(value) => updateNumber("depreciationPercentage", value)} /><BudgetField label="Manutenção" value={input.maintenancePercentage} suffix="%" step="1" onChange={(value) => updateNumber("maintenancePercentage", value)} />{showShopeePrice && <><BudgetField label="Taxa da Shopee" value={input.shopeePercentage} suffix="%" onChange={(value) => updateNumber("shopeePercentage", value)} /><BudgetField label="Tarifa fixa Shopee" value={input.shopeeFixedFee} prefix="R$" onChange={(value) => updateNumber("shopeeFixedFee", value)} /></>}</div>
          <div className="budget-actions"><button className="secondary-button" onClick={restoreDefaults}><RotateCcw size={15} /> Restaurar padrão</button><button className="budget-calculate-button" onClick={calculate}><Calculator size={16} /> Calcular orçamento</button></div>
        </section>
        <aside className={`budget-result-card ${budgetMode === "custom" ? "custom-budget-result-card" : ""}`}>
          <div className="budget-result-head"><div><p className="eyebrow">RESULTADO DO SIMULADOR</p><h3>{input.productName || "Produto sem identificação"}</h3></div><div className="budget-result-icon"><DollarSign size={19} /></div></div>
          <div className="suggested-price"><span>Preço de venda direta</span><strong>{currency(result.priceBeforeShopee)}</strong><small className="suggested-cost-subtitle">Custo total: {currency(result.operationalCost)}</small></div>
          <button className={`shopee-toggle-button ${showShopeePrice ? "is-visible" : ""}`} onClick={() => setShowShopeePrice((visible) => !visible)} aria-expanded={showShopeePrice} aria-controls="shopee-price-details">{showShopeePrice ? <><X size={15} /> Ocultar preço Shopee</> : <><Plus size={15} /> Adicionar preço Shopee</>}</button>
          {showShopeePrice && <div id="shopee-price-details" className="shopee-price-details"><div className="shopee-price-highlight"><span>Preço Shopee</span><strong>{currency(result.suggestedPrice)}</strong><small className="suggested-cost-subtitle">Custo total: {currency(result.operationalCost)} · Taxa {input.shopeePercentage}% + {currency(input.shopeeFixedFee)}</small></div><div className="shopee-breakdown"><div><span>Preço Shopee</span><strong>{currency(result.suggestedPrice)}</strong></div><div><span>Taxa percentual + tarifa fixa</span><strong>{currency(result.shopeeFee)}</strong></div><div><span>Lucro Shopee</span><strong className="pink-value">{currency(result.shopeeProfit)}</strong></div></div></div>}
          <div className="budget-breakdown"><div><span>Peças ({input.plateCosts.length})</span><strong>{currency(result.materialCost)}</strong></div><div><span>Embalagem</span><strong>{currency(input.packagingCost)}</strong></div>{budgetMode === "store" && <div><span>Outros custos</span><strong>{currency(input.otherCosts)}</strong></div>}<div><span>Perda + depreciação + manutenção</span><strong>{currency(result.lossCost)}</strong></div><div><span>Custo total</span><strong>{currency(result.operationalCost)}</strong></div><div className="budget-breakdown-divider" /><div><span>Preço fora · MKP +{input.mkp.toLocaleString("pt-BR")}%</span><strong>{currency(result.priceBeforeShopee)}</strong></div><div><span>Lucro</span><strong className="direct-profit-value">{currency(result.directProfit)}</strong></div>{showShopeePrice && <><div><span>Preço Shopee · {input.shopeePercentage}% + R$ {input.shopeeFixedFee.toFixed(2).replace(".", ",")}</span><strong className="pink-value">{currency(result.suggestedPrice)}</strong></div><div><span>Lucro Shopee</span><strong className="pink-value">{currency(result.shopeeProfit)}</strong></div></>}</div>
          <div className="budget-result-actions"><button className="spreadsheet-add-button" onClick={addToSpreadsheet}><Plus size={16} /> Adicionar à planilha</button>{spreadsheetError && <p className="spreadsheet-error" role="alert">{spreadsheetError}</p>}</div>
        </aside>
      </div>
      <section className="spreadsheet-card">
        <div className="spreadsheet-heading"><div><p className="eyebrow">CONTROLE INTERNO</p><h3>Planilha de produtos</h3></div><div className="spreadsheet-actions"><button className="sheet-button" onClick={downloadSpreadsheet}><Cloud size={14} /> Download</button><button className="sheet-button" onClick={restoreLastSpreadsheet}><RotateCcw size={14} /> Restaurar última</button><button className="sheet-button sheet-button-danger" onClick={newSpreadsheet}><Plus size={14} /> Nova planilha</button></div></div>
        {spreadsheetMigrationWarning > 0 && <div className="spreadsheet-migration-notice" role="status"><AlertCircle size={16} /><span>{spreadsheetMigrationWarning} registro(s) antigo(s) convertido(s) para venda direta usando as taxas padrão da Shopee (14% + R$ 4), pois as taxas originais não estavam salvas. Revise os itens que usavam taxas personalizadas.</span><button type="button" onClick={() => setSpreadsheetMigrationWarning(0)} aria-label="Dispensar aviso de conversão"><X size={14} /></button></div>}
        {spreadsheet.length === 0 ? <div className="spreadsheet-empty"><ReceiptText size={22} /><strong>Nenhum produto adicionado ainda</strong><span>Calcule um orçamento e use “Adicionar à planilha” para registrar o produto.</span></div> : <div className="spreadsheet-table-wrap"><table className="spreadsheet-table"><thead><tr><th>ID</th><th>Produto</th><th>Tipo</th><th>Custo</th><th>Venda direta</th><th>Shopee (referência)</th><th></th></tr></thead><tbody>{spreadsheet.map((item, index) => <tr key={`${item.productId}-${index}`}><td><code>{item.productId}</code></td><td><strong>{item.productName}</strong><small>{item.addedAt}</small></td><td><span className={`budget-type-badge ${item.budgetMode === "custom" ? "is-custom" : "is-store"}`}>{item.budgetMode === "custom" ? <Sparkles size={11} /> : <Package size={11} />}{item.budgetMode === "custom" ? "Personalizado" : "Produto de Loja"}</span></td><td>{currency(item.cost)}</td><td className="sheet-sale-price">{currency(item.salePrice)}</td><td className="sheet-shopee-reference">{item.shopeePrice == null ? "—" : currency(item.shopeePrice)}</td><td><button className="remove-sheet-item" onClick={() => removeSpreadsheetItem(index)} aria-label={`Remover ${item.productName}`}><X size={15} /></button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const telemetryQuery = trpc.telemetry.a1.useQuery(undefined, { refetchInterval: 10000, retry: false });
  const historyQuery = trpc.telemetry.a1History.useQuery(undefined, { refetchInterval: 30000, retry: false });
  const [location, navigate] = useLocation();
  const [localView, setLocalView] = useState<View>("overview");
  const view: View = location === "/cronograma" ? "schedule" : localView;
  const setView = (next: View) => {
    if (next === "schedule") navigate("/cronograma");
    else { setLocalView(next); if (location === "/cronograma") navigate("/"); }
  };
  const [printers, setPrinters] = useState(initialPrinters);
  const [simulationMode, setSimulationMode] = useState(false);
  const [polling, setPolling] = useState("10");
  const [lastSync, setLastSync] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("fr3d-monitoring-preferences-v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { simulationMode?: boolean; polling?: string };
        if (typeof parsed.simulationMode === "boolean") setSimulationMode(parsed.simulationMode);
        if (parsed.polling) setPolling(parsed.polling);
      } catch { /* ignore invalid local preferences */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fr3d-monitoring-preferences-v2", JSON.stringify({ simulationMode, polling }));
  }, [simulationMode, polling]);

  useEffect(() => {
    const telemetry = telemetryQuery.data?.telemetry;
    if (!telemetry || simulationMode) return;
    setPrinters((current) => current.map((printer) => printer.id !== "a1" ? printer : {
      ...printer,
      state: telemetry.fresh && telemetry.state !== "error" ? telemetry.state : "offline",
      serial: telemetry.serial,
      progress: telemetry.progress,
      job: displayJobName(telemetry.state, telemetry.progress, telemetry.remainingSeconds, telemetry.jobName),
      remaining: telemetry.remainingSeconds == null ? "—" : `${String(Math.floor(telemetry.remainingSeconds / 3600)).padStart(2, "0")}h ${String(Math.floor((telemetry.remainingSeconds % 3600) / 60)).padStart(2, "0")}m`,
      remainingSeconds: telemetry.remainingSeconds,
      nozzle: telemetry.nozzleTemperature,
      bed: telemetry.bedTemperature,
      fanSpeed: telemetry.fanSpeed,
      firmware: telemetry.firmware,
      layerNumber: telemetry.layerNumber,
      totalLayers: telemetry.totalLayers,
      wifi: telemetry.wifiSignal == null ? "—" : `${telemetry.wifiSignal} dBm`,
      lastSeen: formatLastSeen(telemetry.observedAt),
    }));
    setLastSync(new Date());
  }, [telemetryQuery.data, simulationMode]);

  useEffect(() => {
    if (!simulationMode) return;
    const timer = window.setInterval(() => {
      setPrinters((current) => current.map((printer) => printer.id === "a1" ? { ...printer, progress: printer.progress >= 99 ? 72 : printer.progress + 1, lastSeen: "agora" } : { ...printer, lastSeen: "agora" }));
      setLastSync(new Date());
    }, Number(polling) * 1000);
    return () => window.clearInterval(timer);
  }, [polling, simulationMode]);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === view)?.label ?? "Visão geral", [view]);

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      void telemetryQuery.refetch();
      setLastSync(new Date());
      if (simulationMode) setPrinters((current) => current.map((printer) => ({ ...printer, lastSeen: "agora" })));
      setRefreshing(false);
      toast.success("Telemetria atualizada", { description: "A leitura mais recente já está refletida no painel." });
    }, 650);
  };

  const showDetails = () => {
    setView("printers");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activePrinters = printers.filter((printer) => printer.state !== "offline").length;
  const busyPrinters = printers.filter((printer) => printer.state === "printing").length;
  const a1Printer = printers.find((printer) => printer.id === "a1");
  const telemetryWarning = telemetryQuery.isFetched && !telemetryQuery.data?.online;

  return (
    <div className="app-shell">
      <header className="app-topnav">
        <div className="topnav-brand"><div className="brand"><div className="brand-mark"><img src="https://bambuwatch-wwg9stua.manus.space/manus-storage/fr3d-menu-logo-centered_2cbcc8eb.png" width={55} height={55} alt="Logo Falcão Rosa3D" /></div><div className="brand-copy"><strong>FALCÃO ROSA3D</strong><small>monitoramento pessoal</small></div></div><div className="workspace-switcher"><div className="workspace-avatar">L</div><div><span>Meu workspace</span><small>conta pessoal</small></div><ChevronRight size={15} /></div></div>
        <nav className="topnav-menu" aria-label="Navegação principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={17} /><span>{label}</span>{id === "printers" && <span className="nav-count">2</span>}</button>)}</nav>
        <div className="topnav-tools"><div className="agent-card"><div className="agent-icon"><Radio size={15} /></div><div><strong>Bridge local</strong><span><i /> Aguardando conexão</span></div><button onClick={() => setView("settings")} aria-label="Abrir configuração"><Settings2 size={15} /></button></div><div className="topbar-actions"><div className="sync-status"><span className="live-dot" /> <span>Última leitura {formatSync(lastSync)}</span></div><button className="theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${theme === "dark" ? "claro" : "escuro"}`} title={`Tema ${theme === "dark" ? "claro" : "escuro"}`}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button className={`refresh-button ${refreshing ? "spinning" : ""}`} onClick={refresh} aria-label="Atualizar telemetria"><RefreshCw size={17} /></button><div className="profile-avatar">LM</div></div></div>
      </header>
      <main className="main-content">
        <div className="context-bar"><div className="breadcrumb"><span>Painel</span><ChevronRight size={14} /><strong>{activeTitle}</strong></div><div className="context-status"><span className="mini-live" /> Área ativa</div></div>

        <div className="page-content">
          {telemetryWarning && view !== "schedule" && <div className="telemetry-live-alert" role="status"><AlertCircle size={17} /><div><strong>Telemetria da A1 indisponível ou atrasada</strong><span>O último estado recebido tem mais de 45 segundos ou o Worker não respondeu. A1 marcada como offline até a próxima leitura válida.</span></div><button onClick={() => void telemetryQuery.refetch()}><RefreshCw size={14} /> Tentar novamente</button></div>}
          {view === "schedule" ? <PrintSchedule /> : view === "settings" ? <SettingsView simulationMode={simulationMode} setSimulationMode={setSimulationMode} polling={polling} setPolling={setPolling} a1Telemetry={a1Printer ?? null} historyCount={historyQuery.data?.length ?? 0} /> : view === "budget" ? <BudgetView /> : view === "filaments" ? <FilamentsView /> : <>
            <section className="hero-banner"><div className="hero-banner-image" role="img" aria-label="Falcão e rosa da Falcão Rosa3D em cenário neon" /><div className="hero-copy"><div className="hero-eyebrow"><span className="mini-live" /> MONITORAMENTO EM TEMPO REAL</div><h1>Falcão Rosa3D <span>—</span><br /><em>tudo sob controle.</em></h1><p>Uma visão clara das impressoras, filamentos e orçamentos da sua bancada, sem ruído e sem complicação.</p><div className="hero-note"><ShieldCheck size={14} /> Modo seguro · telemetria privada</div></div><div className="hero-float-card float-card-one"><Activity size={14} /><span>uso agora</span><strong>72%</strong></div><div className="hero-float-card float-card-two"><Zap size={14} /><span>status</span><strong>estável</strong></div></section>

            <div className="overview-heading"><div><p className="eyebrow">RESUMO DA OPERAÇÃO</p><h2>Hoje na sua bancada</h2></div><button className="outline-button" onClick={() => setView("settings")}><Settings2 size={15} /> Ajustar painel</button></div>
            <section className="metrics-grid"><Metric icon={Printer} label="Impressoras ativas" value={`${activePrinters} / 2`} hint="A1 real · P1S demonstração" tone="purple" /><Metric icon={PlayCircle} label="Em impressão" value={`${busyPrinters}`} hint="estado recebido da A1" tone="blue" /><Metric icon={Clock3} label="Tempo estimado" value={a1Printer?.remaining ?? "—"} hint="tempo restante real da A1" tone="pink" /><Metric icon={Activity} label="Disponibilidade" value="98,4%" hint="indicador ainda em demonstração" tone="green" /></section>

            <div className="section-heading printers-heading"><div><p className="eyebrow">SEU PARQUE</p><h2>{view === "printers" ? "Todas as impressoras" : "Impressoras"}</h2></div><button className="outline-button" onClick={() => toast.info("O cadastro de novas impressoras será liberado com o bridge local.")}><Plus size={15} /> Adicionar</button></div>
            <section className="printers-grid">{printers.map((printer) => <PrinterCard key={printer.id} printer={printer} onDetails={showDetails} />)}</section>
            {view === "printers" && a1Printer && <PrinterDetailsPanel printer={a1Printer} />}

            {view === "overview" && a1Printer && <section className="lower-grid"><TelemetryStatusPanel printer={a1Printer} historyCount={historyQuery.data?.length ?? 0} /><SimulationStatusPanel /><TelemetryDiagnosticsPanel data={telemetryQuery.data} /></section>}

            <div className="local-note"><div className="local-note-icon"><LockKeyhole size={16} /></div><div><strong>Construído para permanecer privado.</strong><span>O painel foi desenhado para conversar com um bridge local via MQTT TLS. Ele não acessa a conta Bambu Handy, não tenta contornar proteções do fabricante e não envia comandos às impressoras.</span></div><button onClick={() => setView("settings")}><span>Entender a arquitetura</span><ArrowUpRight size={14} /></button></div>
          </>}
        </div>
      </main>
    </div>
  );
}
