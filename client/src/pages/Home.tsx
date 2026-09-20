import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  Cable,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  CircleHelp,
  Clock3,
  Cloud,
  ExternalLink,
  Fan,
  Layers3,
  LockKeyhole,
  Menu,
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
  Thermometer,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type PrinterState = "printing" | "idle" | "offline";
type View = "overview" | "printers" | "settings";

type PrinterData = {
  id: string;
  name: string;
  model: string;
  accent: "violet" | "blue";
  state: PrinterState;
  progress: number;
  job: string;
  remaining: string;
  nozzle: number;
  bed: number;
  layer: string;
  wifi: string;
  lastSeen: string;
};

const initialPrinters: PrinterData[] = [
  {
    id: "a1",
    name: "A1",
    model: "Bambu Lab A1",
    accent: "violet",
    state: "printing",
    progress: 72,
    job: "vaso-organico-v3.3mf",
    remaining: "00h 38m",
    nozzle: 218,
    bed: 60,
    layer: "128 / 176",
    wifi: "-48 dBm",
    lastSeen: "há 12 s",
  },
  {
    id: "p1s",
    name: "P1S",
    model: "Bambu Lab P1S",
    accent: "blue",
    state: "idle",
    progress: 100,
    job: "Pronta para o próximo trabalho",
    remaining: "—",
    nozzle: 28,
    bed: 25,
    layer: "—",
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
  { id: "settings", label: "Configuração", icon: Settings2 },
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

function ProgressRing({ value, tone }: { value: number; tone: "violet" | "blue" }) {
  return (
    <div
      className={`progress-ring progress-ring-${tone}`}
      style={{ "--progress": `${value * 3.6}deg` } as React.CSSProperties}
      aria-label={`${value}% concluído`}
    >
      <div className="progress-ring-inner">
        <span>{value}%</span>
        <small>concluído</small>
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
  return (
    <article className={`printer-card printer-card-${printer.accent}`}>
      <div className="printer-card-topline">
        <div className="printer-identity">
          <div className={`printer-mark printer-mark-${printer.accent}`}><Printer size={19} /></div>
          <div>
            <div className="printer-name-row"><h3>{printer.name}</h3><span className="model-tag">{printer.model.replace("Bambu Lab ", "")}</span></div>
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
          <p>{isPrinting ? `Camada ${printer.layer}` : "Nenhuma impressão em andamento"}</p>
          <button className="text-action" onClick={onDetails}>Ver detalhes <ArrowUpRight size={14} /></button>
        </div>
      </div>

      <div className="printer-stats">
        <div><span><Thermometer size={14} /> Bico</span><strong>{printer.nozzle}°C</strong></div>
        <div><span><Layers3 size={14} /> Mesa</span><strong>{printer.bed}°C</strong></div>
        <div><span><Fan size={14} /> Ventilação</span><strong>{isPrinting ? "42%" : "0%"}</strong></div>
      </div>
    </article>
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

function SettingsView({ simulationMode, setSimulationMode, polling, setPolling }: { simulationMode: boolean; setSimulationMode: (value: boolean) => void; polling: string; setPolling: (value: string) => void }) {
  return (
    <div className="settings-view">
      <div className="section-heading"><div><p className="eyebrow">CONTROLE LOCAL</p><h2>Configuração do monitoramento</h2><p>Defina como o painel deve receber e apresentar a telemetria das suas máquinas.</p></div><div className="secure-badge"><ShieldCheck size={16} /> Dados locais</div></div>
      <div className="settings-grid">
        <section className="settings-card featured-settings">
          <div className="settings-card-heading"><div className="settings-symbol purple"><Cable size={19} /></div><div><h3>Bridge local</h3><p>Conector seguro entre sua rede e o dashboard.</p></div><span className="status-pill status-idle"><span className="status-dot" /> Aguardando</span></div>
          <div className="bridge-steps"><div className="bridge-step done"><span>1</span><div><strong>Instale o bridge na mesma rede</strong><p>O processo local fala com as impressoras via MQTT TLS.</p></div><CheckCircle2 size={18} /></div><div className="bridge-step"><span>2</span><div><strong>Cadastre IP e código de acesso</strong><p>As credenciais ficam somente no dispositivo local.</p></div><CircleHelp size={18} /></div><div className="bridge-step"><span>3</span><div><strong>Envie telemetria resumida</strong><p>O painel recebe apenas status, progresso e temperaturas.</p></div><CircleHelp size={18} /></div></div>
          <button className="secondary-button" onClick={() => toast.info("O pacote do bridge será disponibilizado na próxima etapa do projeto.")}><ExternalLink size={15} /> Ver guia de instalação</button>
        </section>
        <section className="settings-card">
          <div className="settings-card-heading"><div className="settings-symbol blue"><SlidersHorizontal size={19} /></div><div><h3>Preferências</h3><p>Comportamento desta interface.</p></div></div>
          <label className="setting-row"><div><strong>Modo demonstração</strong><p>Usa telemetria simulada enquanto o bridge não está conectado.</p></div><button className={`toggle ${simulationMode ? "on" : ""}`} onClick={() => setSimulationMode(!simulationMode)} aria-pressed={simulationMode}><span /></button></label>
          <label className="setting-row"><div><strong>Frequência de atualização</strong><p>Intervalo de atualização visual do painel.</p></div><select value={polling} onChange={(event) => setPolling(event.target.value)}><option value="5">5s</option><option value="10">10s</option><option value="30">30s</option></select></label>
          <div className="privacy-note"><LockKeyhole size={15} /><span>Nenhuma credencial ou imagem é enviada para o Bambu Handy por esta aplicação.</span></div>
        </section>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [printers, setPrinters] = useState(initialPrinters);
  const [simulationMode, setSimulationMode] = useState(true);
  const [polling, setPolling] = useState("10");
  const [lastSync, setLastSync] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("bambu-watch-preferences");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { simulationMode?: boolean; polling?: string };
        if (typeof parsed.simulationMode === "boolean") setSimulationMode(parsed.simulationMode);
        if (parsed.polling) setPolling(parsed.polling);
      } catch { /* ignore invalid local preferences */ }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("bambu-watch-preferences", JSON.stringify({ simulationMode, polling }));
  }, [simulationMode, polling]);

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
      setLastSync(new Date());
      setPrinters((current) => current.map((printer) => ({ ...printer, lastSeen: "agora" })));
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

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${menuOpen ? "mobile-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} fill="currentColor" /></div><div><strong>Bambu<span>Watch</span></strong><small>monitoramento pessoal</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={18} /></button></div>
        <div className="workspace-switcher"><div className="workspace-avatar">L</div><div><span>Meu workspace</span><small>conta pessoal</small></div><ChevronRight size={15} /></div>
        <nav className="side-nav" aria-label="Navegação principal"><p className="nav-label">PAINEL</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => { setView(id); setMenuOpen(false); }}><Icon size={17} /><span>{label}</span>{id === "printers" && <span className="nav-count">2</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="agent-card"><div className="agent-icon"><Radio size={16} /></div><div><strong>Bridge local</strong><span><i /> Aguardando conexão</span></div><button onClick={() => setView("settings")} aria-label="Abrir configuração"><Settings2 size={15} /></button></div><div className="sidebar-footer"><span className="help-icon"><CircleHelp size={15} /></span><span>Central de ajuda</span><span className="version">v0.1</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button><div className="breadcrumb"><span>Painel</span><ChevronRight size={14} /><strong>{activeTitle}</strong></div><div className="topbar-actions"><div className="sync-status"><span className="live-dot" /> <span>Última leitura {formatSync(lastSync)}</span></div><button className={`refresh-button ${refreshing ? "spinning" : ""}`} onClick={refresh} aria-label="Atualizar telemetria"><RefreshCw size={17} /></button><div className="profile-avatar">LM</div></div></header>

        <div className="page-content">
          {view === "settings" ? <SettingsView simulationMode={simulationMode} setSimulationMode={setSimulationMode} polling={polling} setPolling={setPolling} /> : <>
            <section className="hero-banner"><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /><div className="hero-copy"><div className="hero-eyebrow"><span className="mini-live" /> MONITORAMENTO EM TEMPO REAL</div><h1>Olá, Lucas <span>—</span><br /><em>tudo sob controle.</em></h1><p>Uma visão clara do que está acontecendo na sua bancada, sem ruído e sem complicação.</p><div className="hero-note"><ShieldCheck size={14} /> Modo seguro · telemetria privada</div></div><div className="hero-visual"><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="hero-printer"><div className="hero-printer-top"><span /><span /><span /></div><div className="hero-printer-bed" /><div className="hero-nozzle" /></div><div className="hero-float-card float-card-one"><Activity size={14} /><span>uso agora</span><strong>72%</strong></div><div className="hero-float-card float-card-two"><Zap size={14} /><span>status</span><strong>estável</strong></div></div></section>

            <div className="overview-heading"><div><p className="eyebrow">RESUMO DA OPERAÇÃO</p><h2>Hoje na sua bancada</h2></div><button className="outline-button" onClick={() => setView("settings")}><Settings2 size={15} /> Ajustar painel</button></div>
            <section className="metrics-grid"><Metric icon={Printer} label="Impressoras ativas" value={`${activePrinters} / 2`} hint="todas respondendo" tone="purple" /><Metric icon={PlayCircle} label="Em impressão" value={`${busyPrinters}`} hint="A1 em andamento" tone="blue" /><Metric icon={Clock3} label="Tempo estimado" value="00h 38m" hint="para o próximo fim" tone="pink" /><Metric icon={Activity} label="Disponibilidade" value="98,4%" hint="nas últimas 24h" tone="green" /></section>

            <div className="section-heading printers-heading"><div><p className="eyebrow">SEU PARQUE</p><h2>{view === "printers" ? "Todas as impressoras" : "Impressoras"}</h2></div><button className="outline-button" onClick={() => toast.info("O cadastro de novas impressoras será liberado com o bridge local.")}><Plus size={15} /> Adicionar</button></div>
            <section className="printers-grid">{printers.map((printer) => <PrinterCard key={printer.id} printer={printer} onDetails={showDetails} />)}</section>

            {view === "overview" && <section className="lower-grid"><div className="panel usage-panel"><div className="panel-heading"><div><p className="eyebrow">UTILIZAÇÃO</p><h3>Ritmo de impressão</h3></div><div className="chart-legend"><span><i className="legend-dot violet" /> A1</span><span><i className="legend-dot blue" /> P1S</span><select defaultValue="24h"><option value="24h">Últimas 24h</option><option value="7d">Últimos 7 dias</option></select></div></div><MiniChart /></div><div className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">EVENTOS</p><h3>Atividade recente</h3></div><button className="panel-link" onClick={() => toast.info("O histórico completo estará disponível após conectar o bridge.")}>Ver tudo <ArrowUpRight size={13} /></button></div><div className="activity-list">{activity.map((item) => <div className="activity-item" key={`${item.time}-${item.label}`}><div className={`activity-icon ${item.tone}`}><Check size={14} /></div><div className="activity-copy"><strong>{item.label}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>)}</div></div></section>}

            <div className="local-note"><div className="local-note-icon"><LockKeyhole size={16} /></div><div><strong>Construído para permanecer privado.</strong><span>O painel foi desenhado para conversar com um bridge local via MQTT TLS. Ele não acessa a conta Bambu Handy, não tenta contornar proteções do fabricante e não envia comandos às impressoras.</span></div><button onClick={() => setView("settings")}><span>Entender a arquitetura</span><ArrowUpRight size={14} /></button></div>
          </>}
        </div>
      </main>
    </div>
  );
}

