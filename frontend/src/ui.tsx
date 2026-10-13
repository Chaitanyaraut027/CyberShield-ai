import { ReactNode, useEffect, useState } from "react";

export type Page = "home" | "scan" | "result" | "analytics" | "history" | "assistant" | "hub" | "report" | "security" | "score" | "profile" | "settings";
export type Go = (p: Page, arg?: any) => void;
export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

export const V = {
  safe: { label: "SAFE", text: "text-ok", bg: "bg-ok", hex: "#22c55e", icon: "✓", word: "Looks safe" },
  suspicious: { label: "SUSPICIOUS", text: "text-warn", bg: "bg-warn", hex: "#f59e0b", icon: "⚠", word: "Be careful" },
  dangerous: { label: "DANGEROUS", text: "text-bad", bg: "bg-bad", hex: "#ef4444", icon: "✕", word: "Dangerous" },
} as const;
export const COLORS = { safe: "text-ok", suspicious: "text-warn", dangerous: "text-bad" } as const;

/* theme */
export type ThemeMode = "system" | "light" | "dark";
export const getTheme = (): ThemeMode => (localStorage.getItem("cs_theme") as ThemeMode) || "dark";
export function applyTheme(m: ThemeMode = getTheme()) {
  const dark = m === "dark" || (m === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
export const setTheme = (m: ThemeMode) => { localStorage.setItem("cs_theme", m); applyTheme(m); };

/* animated number 0 -> target */
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0, s = 0;
    const tick = (t: number) => { if (!s) s = t; const k = Math.min(1, (t - s) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <div className={cx("glass rise rounded-3xl p-4 sm:p-5", className)}>{children}</div>;

export const H = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div className="mb-5"><h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">{children}</h1>{sub && <p className="mt-1 text-dim">{sub}</p>}</div>);

export const Btn = ({ children, onClick, disabled, kind = "primary", type = "button", className = "" }: any) => (
  <button type={type} onClick={onClick} disabled={disabled}
    className={cx("min-h-12 rounded-2xl px-5 py-3 font-semibold transition active:scale-[.98] disabled:opacity-50",
      kind === "primary" ? "bg-gradient-to-r from-brand to-aqua text-white shadow-[0_8px_28px_-8px_var(--color-brand)] hover:brightness-110"
        : kind === "danger" ? "border border-bad/50 text-bad hover:bg-bad/10" : "border border-line hover:bg-white/5", className)}>{children}</button>);

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <label className="block">{p.label && <span className="mb-1 block text-xs uppercase tracking-widest text-dim">{p.label}</span>}
    <input {...p} className={cx("w-full rounded-2xl border border-line bg-ink/60 px-4 py-3 font-mono text-sm outline-none transition focus:border-brand focus:shadow-[0_0_0_3px_rgb(47_123_255_/_.2)]", p.className)} /></label>);

export const Err = ({ msg }: { msg: string }) => msg ? <p className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{msg}</p> : null;

export function Gauge({ score, verdict, label = "RISK / 100", size = 150 }: { score: number; verdict: keyof typeof V; label?: string; size?: number }) {
  const n = useCountUp(score, 1100), r = 52, c = 2 * Math.PI * r, hex = V[verdict].hex;
  return (
    <svg viewBox="0 0 130 130" role="img" aria-label={`${score} of 100`} className="shrink-0" style={{ width: size, height: size, filter: `drop-shadow(0 0 14px ${hex}66)` }}>
      <circle cx="65" cy="65" r={r} fill="none" className="stroke-line" strokeWidth="9" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={hex} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - n / 100)} transform="rotate(-90 65 65)" />
      <text x="65" y="71" textAnchor="middle" className="fill-bone font-display" fontSize="34" fontWeight="800">{n}</text>
      <text x="65" y="90" textAnchor="middle" className="fill-dim font-mono" fontSize="8.5" letterSpacing="1">{label}</text>
    </svg>);
}
