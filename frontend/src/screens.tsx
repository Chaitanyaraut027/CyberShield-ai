import { useEffect, useState } from "react";
import { api, TokenStore, getBase, setBase, Full, Scan } from "./api";
import { Btn, Card, cx, Err, Gauge, getTheme, setTheme, H, Input, ThemeMode, useCountUp, V, Go } from "./ui";
import { PasswordChecker, QrCamera, ReportBtn } from "./pages";

const ICON: Record<string, string> = { url: "🌐", sms: "💬", qr: "▣" };
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const levelOf = (s: number) => (s >= 80 ? ["SECURE", "safe"] : s >= 60 ? ["PROTECTED", "safe"] : s >= 40 ? ["LEARNING", "suspicious"] : ["AT RISK", "dangerous"]) as [string, keyof typeof V];
function notifyDanger(r: Full) {
  if (r.verdict === "dangerous" && localStorage.getItem("cs_notify") === "1" && "Notification" in window && Notification.permission === "granted")
    new Notification("CyberShield AI: dangerous result", { body: r.input.slice(0, 80) });
}

/* ================= Dashboard (Security Command Center) ================= */
function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  const n = useCountUp(value);
  return <Card className="!p-4"><p className="text-[11px] uppercase tracking-widest text-dim">{label}</p><p className={cx("font-display text-3xl font-extrabold", tone)}>{n}</p></Card>;
}
const FEATS = [
  { tab: "url", icon: "🌐", t: "URL Scanner", d: "Detect phishing & malicious websites", cta: "Analyze URL →", g: "from-brand/30 to-aqua/5" },
  { tab: "sms", icon: "💬", t: "SMS Scanner", d: "Detect scam and phishing messages", cta: "Analyze SMS →", g: "from-aqua/25 to-brand/5" },
  { tab: "qr", icon: "▣", t: "QR Scanner", d: "Scan and inspect QR destinations", cta: "Scan QR →", g: "from-ok/25 to-aqua/5" },
  { tab: "password", icon: "🔐", t: "Password Security", d: "Check password security locally", cta: "Check Password →", g: "from-warn/25 to-brand/5" },
];
export function Dashboard({ go, user }: { go: Go; user: any }) {
  const [an, setAn] = useState<any>(null); const [sc, setSc] = useState<any>(null); const [sec, setSec] = useState<any>(null);
  useEffect(() => { api("/api/analytics").then(setAn).catch(() => {}); api("/api/score").then(setSc).catch(() => {}); api("/api/security").then(setSec).catch(() => {}); }, []);
  const h = new Date().getHours(), greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const score = sc?.score ?? 0, [lvl, vk] = levelOf(score), k = an?.by_kind ?? {};
  return (<>
    <Card className="relative overflow-hidden !p-6 sm:!p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
      <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <div className="flex-1"><p className="font-display text-2xl font-extrabold sm:text-3xl">{greet}, {user?.name?.split(" ")[0]}</p>
          <p className="mt-1 text-dim">Your security is active</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1.5 text-sm text-ok"><span className="dot-live h-2.5 w-2.5 rounded-full bg-ok" />System Protected</p>
          {sec && <p className="mt-2 text-xs text-dim">Detection engine: {sec.engine === "ml+rules" ? "AI model + rules" : "rules (AI model not trained yet)"}</p>}
          <button onClick={() => go("score")} className="mt-3 block text-sm text-brand hover:underline">How is this calculated? →</button></div>
        <Gauge score={score} verdict={vk} label={lvl} size={190} />
      </div></Card>
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Threats found" value={an?.threats ?? 0} tone="text-bad" /><Stat label="URLs analyzed" value={k.url ?? 0} /><Stat label="SMS analyzed" value={k.sms ?? 0} /><Stat label="QR scanned" value={k.qr ?? 0} /></div>
    <h2 className="mb-3 mt-7 font-display text-xl font-bold">Security tools</h2>
    <div className="grid gap-3 sm:grid-cols-2">{FEATS.map(f => (
      <button key={f.tab} onClick={() => go("scan", f.tab)} className={cx("glass group relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-brand/60 active:scale-[.98]", f.g)}>
        <span className="absolute right-4 top-4 flex items-center gap-1.5 text-[11px] text-ok"><span className="h-2 w-2 rounded-full bg-ok" />Active</span>
        <span className="text-4xl">{f.icon}</span><p className="mt-3 font-display text-xl font-bold">{f.t}</p><p className="text-sm text-dim">{f.d}</p>
        <p className="mt-3 text-sm font-semibold text-brand transition group-hover:translate-x-1">{f.cta}</p></button>))}</div>
    <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">{([["assistant", "🤖", "AI Assistant"], ["report", "🚨", "Report a scam"], ["security", "🛡️", "Security Center"], ["hub", "📚", "Cyber Hub"]] as const).map(([p, i, l]) =>
      <button key={p} onClick={() => go(p)} className="glass shrink-0 rounded-full px-4 py-2 text-sm hover:border-brand/60">{i} {l}</button>)}</div>
    <h2 className="mb-3 mt-7 font-display text-xl font-bold">Recent threats</h2>
    {an && !an.recent_threats.length && <Card><p className="text-dim">No threats found yet — scan a link, message or QR code to get started.</p></Card>}
    <div className="space-y-2">{an?.recent_threats.map((s: Scan) => <TimelineRow key={s.id} s={s} onOpen={() => go("result", s.id)} />)}</div></>);
}

/* ================= Scan hub + scanners ================= */
const STEPS = ["Scanning…", "Analyzing…", "Checking reputation…", "AI evaluation…"];
function useAnalyze(go: Go, kind: string) {
  const [busy, setBusy] = useState(false); const [step, setStep] = useState(0); const [err, setErr] = useState("");
  const run = async (field: string, value: string) => {
    setErr(""); setBusy(true); setStep(0); const t = setInterval(() => setStep(s => Math.min(s + 1, 3)), 450);
    try { const [r] = await Promise.all([api<Full>(`/api/analyze/${kind}`, "POST", { [field]: value }), new Promise(r => setTimeout(r, 1800))]); notifyDanger(r); go("result", r); }
    catch (e: any) { setErr(e.message); } finally { clearInterval(t); setBusy(false); }
  };
  return { busy, step, err, run };
}
const ScanRing = ({ icon, active }: { icon: string; active: boolean }) => (
  <div className="relative mx-auto grid h-28 w-28 place-items-center">
    <div className={cx("absolute inset-0 rounded-full border-2 border-dashed border-brand/60", active ? "animate-spin [animation-duration:1.6s]" : "[animation:spin_14s_linear_infinite]")} />
    <div className={cx("absolute inset-3 rounded-full bg-brand/10 shadow-[0_0_40px_-6px_var(--color-brand)]", active && "animate-pulse")} />
    <span className="relative text-4xl">{icon}</span></div>);
const Steps = ({ step }: { step: number }) => (
  <div className="mt-4 space-y-2">{STEPS.map((s, i) => <p key={s} className={cx("flex items-center gap-2 text-sm transition", i <= step ? "text-bone" : "text-dim/50")}>
    <span className={cx("grid h-5 w-5 place-items-center rounded-full text-[10px]", i < step ? "bg-ok text-white" : i === step ? "animate-pulse bg-brand text-white" : "bg-line")}>{i < step ? "✓" : ""}</span>{s}</p>)}</div>);
function Recent({ kind, go }: { kind: string; go: Go }) {
  const [rows, setRows] = useState<Scan[]>([]); useEffect(() => { api(`/api/history?kind=${kind}&limit=3`).then(setRows).catch(() => {}); }, []);
  if (!rows.length) return null;
  return <><p className="mb-2 mt-6 text-xs uppercase tracking-widest text-dim">Recent scans</p><div className="space-y-2">{rows.map(s => <TimelineRow key={s.id} s={s} onOpen={() => go("result", s.id)} />)}</div></>;
}
function UrlScanner({ go }: { go: Go }) {
  const [v, setV] = useState(""); const a = useAnalyze(go, "url");
  return (<Card><ScanRing icon="🌐" active={a.busy} /><p className="mb-4 mt-3 text-center text-sm text-dim">Enter a link to check it for phishing and malware.</p>
    <Input value={v} onChange={e => setV(e.target.value)} placeholder="https://example.com" inputMode="url" onKeyDown={e => e.key === "Enter" && v.trim() && !a.busy && a.run("url", v)} />
    <Btn onClick={() => a.run("url", v)} disabled={a.busy || !v.trim()} className="mt-3 w-full">{a.busy ? "Analyzing…" : "Analyze"}</Btn>
    {a.busy && <Steps step={a.step} />}<div className="mt-3"><Err msg={a.err} /></div></Card>);
}
function SmsScanner({ go }: { go: Go }) {
  const [v, setV] = useState(""); const a = useAnalyze(go, "sms");
  return (<Card><ScanRing icon="💬" active={a.busy} /><p className="mb-4 mt-3 text-center text-sm text-dim">Paste a suspicious message. Scam phrases are highlighted in the result.</p>
    <textarea value={v} onChange={e => setV(e.target.value)} rows={5} maxLength={2000} placeholder="Congratulations! You've won a prize…" className="w-full rounded-2xl border border-line bg-ink/60 p-4 font-mono text-sm outline-none focus:border-brand" />
    <Btn onClick={() => a.run("message", v)} disabled={a.busy || !v.trim()} className="mt-3 w-full">{a.busy ? "Analyzing…" : "Analyze SMS"}</Btn>
    {a.busy && <Steps step={a.step} />}<div className="mt-3"><Err msg={a.err} /></div></Card>);
}
function QrScanner({ go }: { go: Go }) {
  const [v, setV] = useState(""); const a = useAnalyze(go, "qr");
  const scan = (c: string) => { setV(c); a.run("content", c); };
  return (<Card>
    <div className="relative mx-auto mb-3 grid aspect-square max-w-[220px] place-items-center rounded-3xl bg-ink/50">
      {[["left-3 top-3", "border-l-4 border-t-4 rounded-tl-xl"], ["right-3 top-3", "border-r-4 border-t-4 rounded-tr-xl"], ["left-3 bottom-3", "border-l-4 border-b-4 rounded-bl-xl"], ["right-3 bottom-3", "border-r-4 border-b-4 rounded-br-xl"]].map(([p, b]) => <span key={p} className={cx("absolute h-8 w-8 border-brand", p, b)} />)}
      <span className="text-5xl opacity-80">▣</span>{a.busy && <div className="absolute inset-x-6 h-1/3 bg-gradient-to-b from-transparent to-aqua/40" style={{ animation: "sweep 1.4s linear infinite" }} />}</div>
    <p className="mb-4 text-center text-sm text-dim">Position the QR code inside the frame</p>
    <QrCamera onCode={scan} />
    {a.busy && <div className="mt-4 rounded-2xl bg-ink/50 p-3"><p className="text-xs uppercase tracking-widest text-dim">QR content</p><p className="break-all font-mono text-sm">{v}</p><p className="mt-1 text-sm text-aqua">Analyzing destination…</p><Steps step={a.step} /></div>}
    <p className="mb-2 mt-5 text-xs uppercase tracking-widest text-dim">Or paste the decoded text</p>
    <div className="flex gap-2"><div className="flex-1"><Input value={v} onChange={e => setV(e.target.value)} placeholder="Decoded QR content" /></div><Btn onClick={() => a.run("content", v)} disabled={a.busy || !v.trim()}>Analyze</Btn></div>
    <div className="mt-3"><Err msg={a.err} /></div></Card>);
}
export function ScanHub({ go, tab }: { go: Go; tab?: string }) {
  const [t, setT] = useState(tab || "url");
  const TABS = [["url", "🌐", "URL"], ["sms", "💬", "SMS"], ["qr", "▣", "QR"], ["password", "🔐", "Password"]];
  return (<><H sub="Pick what you want to check.">Scan</H>
    <div className="glass mb-4 grid grid-cols-4 rounded-2xl p-1">{TABS.map(([id, ic, l]) => <button key={id} onClick={() => setT(id)} className={cx("rounded-xl py-2.5 text-sm font-semibold transition", t === id ? "bg-brand text-white shadow-[0_6px_20px_-6px_var(--color-brand)]" : "text-dim hover:text-bone")}><span className="mr-1">{ic}</span><span className="hidden sm:inline">{l}</span><span className="sm:hidden">{l === "Password" ? "" : l}</span></button>)}</div>
    {t === "url" && <><UrlScanner go={go} /><Recent kind="url" go={go} /></>}
    {t === "sms" && <><SmsScanner go={go} /><Recent kind="sms" go={go} /></>}
    {t === "qr" && <><QrScanner go={go} /><Recent kind="qr" go={go} /></>}
    {t === "password" && <PasswordChecker embedded />}</>);
}

/* ================= Result screen ================= */
function Highlight({ text, flags }: { text: string; flags: string[] }) {
  if (!flags?.length) return <>{text}</>;
  const re = new RegExp(`(${flags.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(re).map((p, i) => i % 2 ? <mark key={i} className="rounded bg-bad/25 px-0.5 text-bad">{p}</mark> : p)}</>;
}
const SI = { ok: ["✓", "text-ok"], warn: ["⚠", "text-warn"], bad: ["✕", "text-bad"], na: ["–", "text-dim"] } as const;
function Bar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0); useEffect(() => { const t = setTimeout(() => setW(pct), 80); return () => clearTimeout(t); }, [pct]);
  return <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full transition-all duration-1000" style={{ width: `${w}%`, background: color }} /></div>;
}
export function ResultScreen({ arg, go }: { arg: Full | number; go: Go }) {
  const [d, setD] = useState<Full | null>(typeof arg === "object" ? arg : null); const [err, setErr] = useState(""); const [why, setWhy] = useState(false);
  useEffect(() => { if (typeof arg === "number") api<Full>(`/api/scans/${arg}`).then(setD).catch(e => setErr(e.message)); }, [arg]);
  const conf = useCountUp(d?.confidence ?? 0);
  if (err) return <Err msg={err} />; if (!d) return <p className="text-dim">Loading analysis…</p>;
  const v = V[d.verdict];
  return (<>
    <button onClick={() => go("home")} className="mb-3 text-sm text-dim hover:text-bone">← Scan Result</button>
    <Card className="relative overflow-hidden text-center">
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-60 w-60 rounded-full blur-3xl" style={{ background: v.hex + "33" }} />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl font-bold text-white" style={{ background: v.hex, boxShadow: `0 0 36px ${v.hex}88` }}>{v.icon}</div>
        <p className={cx("mt-3 font-display text-3xl font-extrabold tracking-wide", v.text)}>{v.label}</p>
        <div className="mt-2 flex justify-center"><Gauge score={d.score} verdict={d.verdict} label="/ 100" size={170} /></div>
        <div className="mx-auto mt-2 max-w-sm text-left"><div className="mb-1 flex justify-between text-sm"><span className="text-dim">{d.engine === "ml+rules" ? "AI Confidence" : "Rule Confidence"}</span><span className="font-mono">{conf}%</span></div><Bar pct={d.confidence} color={v.hex} /></div>
      </div></Card>
    <Card className="mt-3"><p className="text-xs uppercase tracking-widest text-dim">{d.kind === "sms" ? "Message" : d.kind === "qr" ? "QR content" : "URL"}</p>
      <p className="mt-1 break-all font-mono text-sm leading-relaxed"><Highlight text={d.input} flags={d.kind === "sms" || d.type === "sms" ? d.flags : []} /></p></Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">Risk indicators</h3><ul className="mt-3 space-y-2 text-sm">
      {d.reasons.map((r, i) => <li key={i} className="flex gap-2"><span className={d.verdict === "safe" ? "text-ok" : "text-warn"}>{d.verdict === "safe" ? "✓" : "⚠"}</span>{r}</li>)}
      {d.input.toLowerCase().startsWith("https") && <li className="flex gap-2"><span className="text-ok">✓</span>HTTPS enabled</li>}</ul></Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">🤖 AI explanation</h3><p className="mt-2 text-sm text-dim">{d.explanation}</p>
      <div className="mt-3 rounded-2xl border border-brand/30 bg-brand/10 p-3 text-sm"><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand">Recommendation</p>{d.recommendation}</div></Card>
    <Card className="mt-3"><button onClick={() => setWhy(!why)} className="flex w-full items-center justify-between font-display text-lg font-bold">Why this result?<span className="text-dim">{why ? "˄" : "˅"}</span></button>
      {why && <div className="mt-4 space-y-3">{d.breakdown.length ? d.breakdown.map(b => <div key={b.name}><div className="mb-1 flex justify-between text-sm"><span>{b.name}</span><span className="font-mono text-dim">+{b.points}</span></div><Bar pct={(b.points / Math.max(1, d.score)) * 100} color={v.hex} /></div>) : <p className="text-sm text-dim">No risk signals contributed to this score.</p>}
        <div className="flex justify-between border-t border-line pt-3 font-semibold"><span>Total risk</span><span className={cx("font-mono", v.text)}>{d.score}%</span></div></div>}</Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">Threat intelligence</h3><div className="mt-3 divide-y divide-line">
      {d.checks.map(c => <div key={c.name} className="flex items-center gap-3 py-2.5 text-sm"><span className={cx("w-5 text-center font-bold", SI[c.status][1])}>{SI[c.status][0]}</span><div className="flex-1"><p>{c.name}</p><p className="text-xs text-dim">{c.detail}</p></div></div>)}</div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-3"><span className="text-sm text-dim">Final risk</span><span className={cx("font-display text-xl font-extrabold", v.text)}>{d.score} / 100 · {v.label}</span></div></Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><Btn onClick={() => go("assistant", d.id)}>🤖 Ask the AI about this</Btn><Btn kind="ghost" onClick={() => go("home")}>Back to Dashboard</Btn></div>
    <ReportBtn scan={d} /></>);
}

/* ================= History timeline ================= */
function TimelineRow({ s, onOpen, onDelete }: { s: Scan; onOpen: () => void; onDelete?: () => void }) {
  const v = V[s.verdict];
  return (<div onClick={onOpen} className="glass flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition hover:border-brand/50 active:scale-[.99]">
    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: v.hex, boxShadow: `0 0 10px ${v.hex}` }} />
    <div className="min-w-0 flex-1"><p className={cx("text-xs font-semibold", v.text)}>{v.label[0] + v.label.slice(1).toLowerCase()}</p><p className="truncate font-mono text-sm">{ICON[s.kind]} {s.input}</p>
      <p className="text-xs text-dim">{s.kind.toUpperCase()} · {fmtTime(s.created_at)}</p></div>
    <span className={cx("font-display text-lg font-bold", v.text)}>{s.score}</span>
    {onDelete && <button aria-label="Delete" onClick={e => { e.stopPropagation(); onDelete(); }} className="px-2 text-dim hover:text-bad">✕</button>}</div>);
}
const dayLabel = (iso: string) => { const d = new Date(iso), t = new Date(), y = new Date(Date.now() - 864e5);
  return d.toDateString() === t.toDateString() ? "TODAY" : d.toDateString() === y.toDateString() ? "YESTERDAY" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }).toUpperCase(); };
export function History({ go }: { go: Go }) {
  const [rows, setRows] = useState<Scan[] | null>(null); const [f, setF] = useState(""); const [err, setErr] = useState("");
  const load = () => api(`/api/history${f ? `?kind=${f}` : ""}`).then(setRows).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [f]);
  const groups: [string, Scan[]][] = []; rows?.forEach(s => { const l = dayLabel(s.created_at); const g = groups.find(x => x[0] === l); g ? g[1].push(s) : groups.push([l, [s]]); });
  return (<><H sub="Tap any scan to reopen its full analysis.">History</H>
    <div className="mb-4 flex flex-wrap gap-2">{["", "url", "sms", "qr"].map(k => <button key={k} onClick={() => setF(k)} className={cx("rounded-full border px-4 py-1.5 text-sm uppercase", f === k ? "border-brand bg-brand/15 text-brand" : "border-line text-dim")}>{k || "all"}</button>)}
      <Btn kind="danger" className="ml-auto !min-h-0 !py-1.5 text-sm" onClick={async () => { if (confirm("Delete all history?")) { await api("/api/history", "DELETE"); load(); } }}>Clear all</Btn></div>
    <Err msg={err} />{rows && !rows.length && <Card><p className="text-dim">No scans yet. Try the scanner!</p></Card>}
    {groups.map(([l, items]) => <div key={l} className="mb-5"><p className="mb-2 px-1 text-xs font-semibold tracking-widest text-dim">{l}</p><div className="space-y-2">{items.map(s => <TimelineRow key={s.id} s={s} onOpen={() => go("result", s.id)} onDelete={async () => { await api(`/api/history/${s.id}`, "DELETE"); load(); }} />)}</div></div>)}</>);
}

/* ================= Analytics ================= */
export function Analytics() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/analytics").then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Err msg={err} />; if (!d) return <p className="text-dim">Loading…</p>;
  const max = Math.max(1, ...d.days.map((x: any) => x.count)), kinds = [["URL", d.by_kind.url, "#2f7bff"], ["SMS", d.by_kind.sms, "#22d3ee"], ["QR", d.by_kind.qr, "#22c55e"], ["Password checks", d.by_kind.password, "#f59e0b"]] as const;
  const km = Math.max(1, ...kinds.map(k => k[1])), ds = d.distribution;
  return (<><H sub="Your security activity at a glance.">Security Analytics</H>
    <Card><div className="flex items-baseline justify-between"><h3 className="font-display text-lg font-bold">Last 7 days</h3><span className="text-sm text-dim">{d.days.reduce((a: number, x: any) => a + x.count, 0)} scans</span></div>
      <div className="mt-4 flex h-40 items-end gap-2">{d.days.map((x: any) => <div key={x.day} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="font-mono text-xs text-dim">{x.count || ""}</span>
        <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-aqua transition-all duration-700" style={{ height: `${Math.max(4, (x.count / max) * 100)}%`, opacity: x.count ? 1 : .25 }} /><span className="text-xs text-dim">{x.day}</span></div>)}</div></Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">Scans by type</h3><div className="mt-3 space-y-3">{kinds.map(([n, c, col]) => <div key={n}><div className="mb-1 flex justify-between text-sm"><span>{n}</span><span className="font-mono text-dim">{c}</span></div><Bar pct={(c / km) * 100} color={col} /></div>)}</div></Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">Threat distribution</h3>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-line">{d.total > 0 && <><div style={{ width: ds.safe + "%", background: V.safe.hex }} /><div style={{ width: ds.suspicious + "%", background: V.suspicious.hex }} /><div style={{ width: ds.dangerous + "%", background: V.dangerous.hex }} /></>}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">{(["safe", "suspicious", "dangerous"] as const).map(k => <div key={k}><p className={cx("font-display text-2xl font-extrabold", V[k].text)}>{ds[k]}%</p><p className="text-xs text-dim">{V[k].label}</p></div>)}</div></Card></>);
}

/* ================= Security Center ================= */
export function SecurityCenter() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/security").then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Err msg={err} />; if (!d) return <p className="text-dim">Loading…</p>;
  return (<><H sub="Your protection status and recommendations.">Security Center</H>
    <Card className="relative overflow-hidden text-center"><div className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-56 w-56 rounded-full bg-ok/25 blur-3xl" />
      <div className="relative"><div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-ok/40 bg-ok/10 text-5xl shadow-[0_0_50px_-8px_#22c55e]">🛡️</div>
        <p className="mt-3 font-display text-3xl font-extrabold tracking-wide text-ok">PROTECTED</p><p className="text-sm text-dim">Engine: {d.engine === "ml+rules" ? "AI model + rules" : "rules only"}</p></div></Card>
    <Card className="mt-3 !py-2"><div className="divide-y divide-line">{d.protections.map((p: any) => <div key={p.name} className="flex items-center justify-between py-3"><span>{p.name}</span><span className="rounded-full bg-ok/15 px-3 py-0.5 text-xs font-bold text-ok">ON</span></div>)}</div></Card>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">Recommendations</h3><ul className="mt-3 space-y-2.5 text-sm">{d.recommendations.map((r: any) => <li key={r.text} className="flex gap-2"><span className={r.ok ? "text-ok" : "text-warn"}>{r.ok ? "✓" : "⚠"}</span>{r.text}</li>)}</ul></Card></>);
}

/* ================= Profile (Me) ================= */
function Row({ icon, label, hint, onClick, children, danger }: any) {
  const [open, setOpen] = useState(false);
  return (<div><button onClick={() => (children ? setOpen(!open) : onClick?.())} className={cx("flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5", danger && "text-bad")}>
    <span className="w-6 text-center text-lg">{icon}</span><span className="flex-1">{label}</span>{hint && <span className="text-xs text-dim">{hint}</span>}<span className="text-dim">{children ? (open ? "˄" : "˅") : "›"}</span></button>
    {children && open && <div className="space-y-3 border-t border-line bg-ink/30 p-4">{children}</div>}</div>);
}
const Section = ({ title, children }: any) => <div className="mb-5"><p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-dim">{title}</p><div className="glass divide-y divide-line overflow-hidden rounded-2xl">{children}</div></div>;
export function ThemePicker() {
  const [m, setM] = useState<ThemeMode>(getTheme());
  return <div className="space-y-2">{(["system", "light", "dark"] as ThemeMode[]).map(t => <label key={t} className="flex cursor-pointer items-center gap-3 text-sm"><input type="radio" name="theme" checked={m === t} onChange={() => { setTheme(t); setM(t); }} className="accent-[#2f7bff]" />{{ system: "System default", light: "Light", dark: "Dark" }[t]}</label>)}</div>;
}
function NotifyToggle() {
  const [on, setOn] = useState(localStorage.getItem("cs_notify") === "1");
  const toggle = async () => { if (!on) { if (!("Notification" in window)) return alert("Notifications aren't supported in this browser."); if ((await Notification.requestPermission()) !== "granted") return; } localStorage.setItem("cs_notify", on ? "0" : "1"); setOn(!on); };
  return <button onClick={toggle} className="flex items-center gap-3 text-sm"><span className={cx("h-6 w-11 rounded-full p-0.5 transition", on ? "bg-brand" : "bg-line")}><span className={cx("block h-5 w-5 rounded-full bg-white transition", on && "translate-x-5")} /></span>Alert me about dangerous results</button>;
}
function Activity() {
  const [rows, setRows] = useState<any[] | null>(null); useEffect(() => { api("/api/auth/activity").then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <p className="text-sm text-dim">Loading…</p>;
  return <ul className="space-y-2 text-sm">{rows.map((r, i) => <li key={i} className="flex gap-2"><span className={i === 0 ? "text-ok" : "text-dim"}>{i === 0 ? "●" : "○"}</span><span className="flex-1">{r.device}<span className="block text-xs text-dim">{i === 0 ? "Latest session" : "Previous session"} · {ago(r.at)}</span></span></li>)}</ul>;
}
function ChangePassword() {
  const [f, setF] = useState({ current: "", new: "" }); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  return <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setErr(""); setMsg(""); try { await api("/api/auth/change-password", "POST", f); setMsg("Password updated ✓"); setF({ current: "", new: "" }); } catch (x: any) { setErr(x.message); } }}>
    <Input type="password" label="Current password" value={f.current} onChange={e => setF({ ...f, current: e.target.value })} required autoComplete="current-password" />
    <Input type="password" label="New password" value={f.new} onChange={e => setF({ ...f, new: e.target.value })} required minLength={6} autoComplete="new-password" />
    <Err msg={err} />{msg && <p className="text-sm text-ok">{msg}</p>}<Btn type="submit">Update password</Btn></form>;
}
export function Profile({ user, onUser, go, onLogout }: { user: any; onUser: (u: any) => void; go: Go; onLogout: () => void }) {
  const [name, setName] = useState(user.name); const [ok, setOk] = useState(""); const [pw, setPw] = useState(""); const [derr, setDerr] = useState("");
  return (<><div className="mb-6 flex flex-col items-center text-center"><div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand to-aqua font-display text-4xl font-extrabold text-white shadow-[0_0_40px_-8px_var(--color-brand)]">{user.name[0]?.toUpperCase()}</div>
    <p className="mt-3 font-display text-2xl font-extrabold">{user.name}</p><p className="text-sm text-dim">{user.email}</p></div>
    <Section title="Account">
      <Row icon="👤" label="Personal information"><Input label="Name" value={name} onChange={e => setName(e.target.value)} /><Input label="Email" value={user.email} disabled />
        <div className="flex items-center gap-3"><Btn onClick={async () => { const u = await api("/api/auth/me", "PATCH", { name }); TokenStore.setUser(u); onUser(u); setOk("Saved ✓"); }}>Save</Btn><span className="text-sm text-ok">{ok}</span></div></Row>
      <Row icon="🛡️" label="Security Center" onClick={() => go("security")} />
      <Row icon="🔑" label="Change password"><ChangePassword /></Row>
      <Row icon="🕘" label="Login activity"><Activity /></Row></Section>
    <Section title="Preferences">
      <Row icon="🔔" label="Notifications"><NotifyToggle /></Row><Row icon="🌗" label="Appearance"><ThemePicker /></Row>
      <Row icon="🔒" label="Privacy"><p className="text-sm text-dim">Passwords you test are checked only in your browser and never sent to the server. Scans are stored in your history so you can reopen them — delete them anytime.</p></Row>
      <Row icon="⚙️" label="Backend connection" onClick={() => go("settings")} /></Section>
    <Section title="Explore"><Row icon="🤖" label="AI Assistant" onClick={() => go("assistant")} /><Row icon="🏆" label="Cyber Score" onClick={() => go("score")} /><Row icon="🚨" label="Report a scam" onClick={() => go("report")} /><Row icon="📚" label="Cyber Hub" onClick={() => go("hub")} /></Section>
    <Section title="Danger zone"><Row icon="🗑️" label="Delete account" danger><p className="text-sm text-dim">This permanently deletes your account, scans and reports.</p>
      <Input type="password" label="Confirm with your password" value={pw} onChange={e => setPw(e.target.value)} /><Err msg={derr} />
      <Btn kind="danger" disabled={!pw} onClick={async () => { try { await api("/api/auth/me", "DELETE", { password: pw }); onLogout(); } catch (e: any) { setDerr(e.message); } }}>Delete my account</Btn></Row></Section>
    <Btn kind="ghost" onClick={onLogout} className="w-full">Log out</Btn></>);
}

/* ================= Settings ================= */
export function Settings() {
  const [base, setB] = useState(getBase()); const [health, setH] = useState("");
  const test = async () => { setH("Testing…"); try { const r = await fetch(base.replace(/\/$/, "") + "/api/health"); const j = await r.json(); setH(r.ok ? `✓ Backend reachable · AI model ${j.model_loaded ? "loaded" : "not trained yet"}` : "✗ Backend error"); } catch { setH("✗ Cannot reach backend"); } };
  return (<><H sub="Connection and appearance.">Settings</H><Card className="max-w-lg space-y-4">
    <Input label="Backend URL (blank = same origin / proxy)" value={base} onChange={e => setB(e.target.value)} placeholder="http://192.168.1.10:8000" />
    <div className="flex flex-wrap items-center gap-3"><Btn kind="ghost" onClick={test}>Test connection</Btn><Btn onClick={() => { setBase(base.trim()); setH("Saved ✓"); }}>Save</Btn><span className="text-sm text-dim">{health}</span></div></Card>
    <Card className="mt-3 max-w-lg"><h3 className="mb-3 font-display text-lg font-bold">Appearance</h3><ThemePicker /></Card></>);
}
