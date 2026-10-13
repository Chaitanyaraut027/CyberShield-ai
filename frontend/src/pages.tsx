import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { api, Auth, TokenStore, getBase, setBase, Scan } from "./api";
import { Btn, Card, COLORS, cx, Err, Gauge, H, Input } from "./ui";


/* ---------- Home / Login (Test 1, 3, 4) ---------- */
export function AuthScreen({ onAuth }: { onAuth: (u: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = mode === "login" ? await Auth.login(f.email, f.password) : await Auth.register(f.name, f.email, f.password);
      TokenStore.set(r.token); TokenStore.setUser(r.user); onAuth(r.user);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
      <div className="rise">
        <p className="font-mono text-xs uppercase tracking-[.3em] text-brand">● live threat shield</p>
        <h1 className="mt-4 font-display text-5xl font-extrabold leading-[1.02] sm:text-7xl">Cyber<span className="text-brand">Shield</span> AI</h1>
        <p className="mt-5 max-w-md text-lg text-dim">Check any link, SMS or QR code before you trust it. Know the risk in a second.</p>
        <div className="mt-8 hidden max-w-md space-y-2 font-mono text-sm sm:block">
          {[["hxxp://sbi-kyc-update.top/login", "98", "text-bad"], ["Your parcel is delayed, pay ₹49…", "74", "text-bad"], ["https://github.com", "4", "text-ok"]].map(([t, s, c]) => (
            <div key={t} className="flex items-center justify-between rounded-lg border border-line bg-panel/70 px-3 py-2"><span className="truncate pr-3 text-dim">{t}</span><span className={c}>{s}</span></div>))}
        </div>
      </div>
      <Card className="mx-auto w-full max-w-md">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-ink p-1">
          {(["login", "register"] as const).map(m => <button key={m} onClick={() => { setMode(m); setErr(""); }} className={cx("rounded-lg py-2 font-semibold capitalize", mode === m ? "bg-raise text-brand" : "text-dim")}>{m}</button>)}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && <Input label="Name" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" />}
          <Input label="Email" type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" />
          <Input label="Password" type="password" required minLength={6} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          <Err msg={err} />
          <Btn type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Btn>
        </form>
      </Card>
    </div>);
}

/* ---------- Scanners (Tests 5, 6, 7) ---------- */
async function decodeFile(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const BD = (window as any).BarcodeDetector;
  if (BD) { try { const r = await new BD({ formats: ["qr_code"] }).detect(bmp); if (r[0]) return r[0].rawValue; } catch {} }
  const sc = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  const ctx = c.getContext("2d")!; ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height); return jsQR(d.data, d.width, d.height)?.data ?? null;
}
/** Inside the Android/iOS app, request the native camera permission before the WebView opens the camera. */
async function ensureCameraPermission() {
  const cam = (window as any).Capacitor?.Plugins?.Camera;
  if (!cam?.requestPermissions) return;
  const r = await cam.requestPermissions({ permissions: ["camera"] });
  if (r?.camera === "denied") throw Object.assign(new Error("Camera denied"), { name: "NotAllowedError" });
}
const camError = (e: any) => e?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access for this site in your browser settings, then try again."
  : e?.name === "NotFoundError" ? "No camera was found on this device." : e?.name === "NotReadableError" ? "The camera is busy — close other apps using it and retry."
  : "Could not start the camera. Use “Take / upload photo” instead.";

export function QrCamera({ onCode }: { onCode: (c: string) => void }) {
  const vid = useRef<HTMLVideoElement>(null); const file = useRef<HTMLInputElement>(null);
  const [on, setOn] = useState(false); const [msg, setMsg] = useState("");
  const start = () => {
    setMsg("");
    if (on) return setOn(false);
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext)
      return setMsg("Live camera needs a secure connection. Open the CyberShield AI mobile app for live scanning, or use “Take / upload photo” (works everywhere).");
    setOn(true);
  };
  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null, timer: any, stopped = false;
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const BD = (window as any).BarcodeDetector, det = BD ? new BD({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        await ensureCameraPermission();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const v = vid.current!; v.srcObject = stream; await v.play();
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2 && v.videoWidth) {
            let code: string | null = null;
            if (det) { try { code = (await det.detect(v))[0]?.rawValue ?? null; } catch {} }
            if (!code) { canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
              const d = ctx.getImageData(0, 0, canvas.width, canvas.height); code = jsQR(d.data, d.width, d.height)?.data ?? null; }
            if (code) { setOn(false); onCode(code); return; }
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) { setOn(false); setMsg(camError(e)); }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [on]);
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; setMsg("Reading image…");
    try { const c = await decodeFile(f); if (c) { setMsg(""); onCode(c); } else setMsg("No QR code found in that photo. Move closer, keep it flat and well lit, and try again."); }
    catch { setMsg("Could not read that image."); }
  };
  return (<div className="flex-1">
    <div className="flex flex-col gap-2 sm:flex-row">
      <Btn kind="ghost" onClick={start} className="flex-1">{on ? "Stop camera" : "📷 Live camera"}</Btn>
      <Btn kind="ghost" onClick={() => file.current?.click()} className="flex-1">🖼️ Take / upload photo</Btn>
      <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
    </div>
    {msg && <p className="mt-2 text-sm text-warn">{msg}</p>}
    {on && <div className="relative mt-3 overflow-hidden rounded-xl border border-brand"><video ref={vid} playsInline muted autoPlay className="aspect-square w-full bg-black object-cover" />
      <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-brand/70" />
      <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent to-brand/30" style={{ animation: "sweep 1.6s linear infinite" }} /></div>}
  </div>);
}

/* ---------- Password checker (runs offline, never sent anywhere) ---------- */
const COMMON = ["password", "123456", "qwerty", "admin", "welcome", "letmein", "iloveyou", "abc123", "india", "000000"];
export function PasswordChecker({ embedded = false }: { embedded?: boolean }) {
  const [p, setP] = useState(""); const [show, setShow] = useState(false); const counted = useRef(false);
  useEffect(() => { if (p.length >= 6 && !counted.current) { counted.current = true; api("/api/events/password-check", "POST").catch(() => {}); } if (!p) counted.current = false; }, [p]);
  const checks = [["8+ characters", p.length >= 8], ["12+ characters", p.length >= 12], ["Upper & lower case", /[a-z]/.test(p) && /[A-Z]/.test(p)], ["A number", /\d/.test(p)], ["A symbol", /[^A-Za-z0-9]/.test(p)], ["Not a common password", !!p && !COMMON.some(c => p.toLowerCase().includes(c))]] as const;
  const pool = (/[a-z]/.test(p) ? 26 : 0) + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^A-Za-z0-9]/.test(p) ? 32 : 0);
  const bits = p ? Math.round(p.length * Math.log2(pool || 1)) : 0;
  const score = Math.min(100, Math.round((bits / 80) * 100) - (checks[5][1] ? 0 : 40));
  const lvl = !p ? ["—", "text-dim", "#263039"] : score < 35 ? ["Weak", "text-bad", "#ef4444"] : score < 65 ? ["Fair", "text-warn", "#f59e0b"] : ["Strong", "text-ok", "#22c55e"];
  return (<>
    {!embedded ? <H sub="Checked in your browser — your password is never sent to the server.">Password Checker</H> : <p className="mb-3 text-sm text-dim">Checked in your browser — your password is never sent to the server.</p>}
    <Card>
      <div className="flex gap-2"><div className="flex-1"><Input type={show ? "text" : "password"} value={p} onChange={e => setP(e.target.value)} placeholder="Type a password to test" autoComplete="off" /></div>
        <Btn kind="ghost" onClick={() => setShow(!show)} className="self-end">{show ? "Hide" : "Show"}</Btn></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink"><div className="h-full transition-all" style={{ width: `${Math.max(0, p ? score : 0)}%`, background: lvl[2] }} /></div>
      <p className="mt-2 font-mono text-sm"><span className={lvl[1]}>{lvl[0]}</span> <span className="text-dim">· ~{bits} bits of entropy</span></p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">{checks.map(([l, ok]) => <li key={l} className={cx("flex gap-2 text-sm", ok ? "text-ok" : "text-dim")}><span>{ok ? "✓" : "○"}</span>{l}</li>)}</ul>
    </Card></>);
}

/* ---------- Cyber Hub ---------- */
const TIPS = [["🎣", "Phishing", "Banks never ask for OTP, PIN or password by SMS, call or link. Type the bank's address yourself."], ["📲", "UPI & QR fraud", "You never scan a QR to *receive* money. If someone asks you to scan or approve a request to get paid, it's a scam."],
  ["🔑", "Passwords", "Use a long unique passphrase per account and a password manager. Turn on two-factor authentication."], ["🛜", "Public Wi-Fi", "Avoid banking on open Wi-Fi. Use mobile data or a trusted VPN."],
  ["🎁", "Too good to be true", "Lottery wins, free gifts and KYC 'expiry' threats create panic so you act before thinking. Pause."], ["🚨", "If you were scammed", "Call your bank immediately, change passwords, and report at cybercrime.gov.in or call 1930 (India)."]];
export const CyberHub = () => (<><H sub="Short, practical lessons to keep you safe.">Cyber Hub</H>
  <div className="grid gap-3 sm:grid-cols-2">{TIPS.map(([i, t, d]) => <Card key={t}><p className="text-3xl">{i}</p><h3 className="mt-2 font-display text-xl font-bold">{t}</h3><p className="mt-1 text-sm text-dim">{d}</p></Card>)}</div></>);

/* ---------- AI Assistant ---------- */
type Msg = { role: "user" | "assistant"; content: string };
const CHIPS = ["Someone asked for my OTP", "Is a QR code safe to scan to get paid?", "How do I make a strong password?", "I was scammed — what now?"];
export function Assistant({ scanId }: { scanId?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Hi! I'm your CyberShield assistant. Ask me about scams, links, QR/UPI fraud or passwords — or pick a recent scan below and I'll explain it." }]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [scans, setScans] = useState<Scan[]>([]); const [sid, setSid] = useState<number | "">(scanId ?? "");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { api("/api/history?limit=10").then(setScans).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = [...msgs.filter((_, i) => i > 0), { role: "user", content: q } as Msg].slice(-10);
    setMsgs(m => [...m, { role: "user", content: q }]); setText(""); setBusy(true);
    try { const r = await api("/api/assistant", "POST", { messages: history, scan_id: sid || null }); setMsgs(m => [...m, { role: "assistant", content: r.reply }]); }
    catch (x: any) { setMsgs(m => [...m, { role: "assistant", content: "⚠️ " + x.message }]); } finally { setBusy(false); }
  };
  return (<><H sub="Plain-language help. Never share OTPs or passwords here.">AI Assistant</H>
    <Card className="flex h-[60dvh] flex-col !p-0 md:h-[65dvh]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.map((m, i) => <div key={i} className={cx("flex", m.role === "user" && "justify-end")}><p className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-brand text-white" : "bg-raise")}>{m.content}</p></div>)}
        {busy && <p className="text-sm text-dim">Thinking…</p>}
        {msgs.length === 1 && <div className="flex flex-wrap gap-2 pt-2">{CHIPS.map(c => <button key={c} onClick={() => send(c)} className="rounded-full border border-line px-3 py-1.5 text-xs text-dim hover:border-brand hover:text-brand">{c}</button>)}</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        <select value={sid} onChange={e => setSid(e.target.value ? +e.target.value : "")} className="mb-2 w-full rounded-lg border border-line bg-ink px-3 py-2 text-xs text-dim">
          <option value="">Ask a general question</option>{scans.map(s => <option key={s.id} value={s.id}>Explain: [{s.kind}] {s.input.slice(0, 50)}</option>)}</select>
        <div className="flex gap-2"><input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send(text)} maxLength={1000} placeholder="Type your question…" className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-brand" />
          <Btn onClick={() => send(sid && !text ? "Explain this result" : text)} disabled={busy || (!text.trim() && !sid)}>Send</Btn></div>
      </div></Card></>);
}

/* ---------- Personal Cyber Score ---------- */
export function Score() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => { api("/api/score").then(setD).catch(e => setErr(e.message)); }, []);
  if (err) return <Err msg={err} />; if (!d) return <p className="text-dim">Calculating…</p>;
  const v = d.score >= 70 ? "safe" : d.score >= 40 ? "suspicious" : "dangerous";
  return (<><H sub="Based on your last 30 days of safe habits.">Cyber Score</H>
    <Card className="flex flex-col items-center gap-5 sm:flex-row"><Gauge score={d.score} verdict={v} label="SAFETY / 100" />
      <div><p className={cx("font-display text-3xl font-extrabold", COLORS[v as "safe"])}>{d.level}</p><p className="text-sm text-dim">{d.scans_30d} scans in 30 days · {d.risky_30d} risky items caught</p></div></Card>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">{d.breakdown.map((b: any) => <Card key={b.name}><div className="flex justify-between text-sm"><span>{b.name}</span><span className="font-mono text-dim">{b.value > 0 ? "+" : ""}{b.value}{b.max ? ` / ${b.max}` : ""}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink"><div className={cx("h-full", b.value < 0 ? "bg-bad" : "bg-brand")} style={{ width: `${b.max ? (b.value / b.max) * 100 : Math.min(100, -b.value * 6.6)}%` }} /></div></Card>)}</div>
    <Card className="mt-3"><h3 className="font-display text-lg font-bold">How to improve</h3><ul className="mt-2 space-y-2 text-sm">{d.tips.map((t: string) => <li key={t} className="flex gap-2"><span className="text-brand">▸</span>{t}</li>)}</ul></Card></>);
}

/* ---------- Scam Reporting ---------- */
const CATS: [string, string][] = [["phishing", "Phishing / fake website"], ["lottery", "Lottery / prize"], ["kyc_bank", "Fake KYC / bank"], ["upi_qr", "UPI / QR fraud"], ["parcel", "Parcel / delivery fee"], ["job", "Fake job offer"], ["investment", "Investment scam"], ["other", "Other"]];
const catName = (c: string) => CATS.find(x => x[0] === c)?.[1] ?? c;
const guessCat = (kind: string) => (kind === "qr" ? "upi_qr" : "phishing");

export function ReportBtn({ scan }: { scan: Scan }) {
  const [state, setState] = useState(""); 
  useEffect(() => setState(""), [scan.id]);
  return (<div className="mt-3 flex items-center gap-3">
    <Btn kind="danger" disabled={state === "done" || state === "busy"} className="!min-h-0 !py-2 text-sm" onClick={async () => {
      setState("busy"); try { await api("/api/reports", "POST", { kind: scan.kind, category: guessCat(scan.kind), content: scan.input, scan_id: scan.id }); setState("done"); }
      catch (e: any) { setState(e.message); } }}>🚨 Report as scam</Btn>
    <span className="text-sm text-dim">{state === "done" ? "Thanks — reported ✓" : state && state !== "busy" ? state : ""}</span></div>);
}

export function ReportPage() {
  const [f, setF] = useState({ kind: "url", category: "phishing", content: "", description: "" });
  const [mine, setMine] = useState<any[]>([]); const [com, setCom] = useState<any>(null); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => { api("/api/reports").then(setMine).catch(() => {}); api("/api/reports/community").then(setCom).catch(() => {}); };
  useEffect(load, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setOk(""); setBusy(true);
    try { await api("/api/reports", "POST", f); setOk("Report submitted. Thank you for protecting others!"); setF({ ...f, content: "", description: "" }); load(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  const sel = "w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-brand";
  return (<><H sub="Reported scams warn other users and help train the detector.">Report a Scam</H>
    {com && <div className="mb-4 grid grid-cols-2 gap-3"><Card><p className="text-xs uppercase tracking-widest text-dim">Community reports</p><p className="font-display text-4xl font-extrabold text-bad">{com.total}</p></Card>
      <Card><p className="text-xs uppercase tracking-widest text-dim">Your reports</p><p className="font-display text-4xl font-extrabold text-brand">{com.mine}</p></Card></div>}
    <Card><form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-widest text-dim">Type</span>
          <select className={sel} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{["url", "sms", "qr", "call", "other"].map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-xs uppercase tracking-widest text-dim">Category</span>
          <select className={sel} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label></div>
      <label className="block"><span className="mb-1 block text-xs uppercase tracking-widest text-dim">Link, message, QR text or phone number</span>
        <textarea required minLength={3} maxLength={2000} rows={3} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} className={cx(sel, "font-mono")} /></label>
      <label className="block"><span className="mb-1 block text-xs uppercase tracking-widest text-dim">What happened? (optional — never include OTPs or passwords)</span>
        <textarea maxLength={1000} rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} className={sel} /></label>
      <Err msg={err} />{ok && <p className="text-sm text-brand">{ok}</p>}
      <Btn type="submit" disabled={busy}>{busy ? "Sending…" : "Submit report"}</Btn></form></Card>
    {com?.by_category?.length > 0 && <Card className="mt-3"><h3 className="font-display text-lg font-bold">Most reported types</h3><div className="mt-3 space-y-2">
      {com.by_category.map((c: any) => <div key={c.category} className="text-sm"><div className="flex justify-between"><span>{catName(c.category)}</span><span className="font-mono text-dim">{c.count}</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-ink"><div className="h-full rounded-full bg-bad" style={{ width: `${(c.count / com.by_category[0].count) * 100}%` }} /></div></div>)}</div></Card>}
    <h3 className="mb-2 mt-6 font-display text-xl font-bold">My reports</h3>
    {!mine.length && <Card><p className="text-dim">You haven't reported anything yet.</p></Card>}
    <div className="space-y-2">{mine.map(r => <Card key={r.id} className="flex items-center gap-3 !p-3">
      <span className="rounded-md bg-ink px-2 py-1 font-mono text-xs uppercase text-dim">{r.kind}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-mono text-sm">{r.content}</p><p className="text-xs text-dim">{catName(r.category)} · {new Date(r.created_at).toLocaleDateString()}</p></div>
      <button aria-label="Delete report" onClick={async () => { await api(`/api/reports/${r.id}`, "DELETE"); load(); }} className="px-2 text-dim hover:text-bad">✕</button></Card>)}</div></>);
}
