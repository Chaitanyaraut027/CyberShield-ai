import { useEffect, useState } from "react";
import { TokenStore } from "./api";
import { applyTheme, cx, getTheme, Go, Page } from "./ui";
import * as P from "./pages";
import * as S from "./screens";

const SIDE: [Page, string, string][] = [["home", "🏠", "Dashboard"], ["scan", "🔍", "Scan"], ["analytics", "📊", "Analytics"], ["history", "🕘", "History"], ["assistant", "🤖", "AI Assistant"],
  ["hub", "📚", "Cyber Hub"], ["report", "🚨", "Report a Scam"], ["security", "🛡️", "Security Center"], ["score", "🏆", "Cyber Score"], ["profile", "👤", "Profile"], ["settings", "⚙️", "Settings"]];
const BOTTOM: ([Page, string, string] | "SCAN")[] = [["home", "🏠", "Home"], ["history", "🕘", "History"], "SCAN", ["analytics", "📊", "Analytics"], ["profile", "👤", "Me"]];

export default function App() {
  const [user, setUser] = useState<any>(TokenStore.get() ? TokenStore.user() : null);
  const [page, setPage] = useState<Page>("home"); const [arg, setArg] = useState<any>(undefined);
  useEffect(() => { const mq = matchMedia("(prefers-color-scheme: dark)"), f = () => getTheme() === "system" && applyTheme(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  if (!user) return <P.AuthScreen onAuth={setUser} />;
  const go: Go = (p, a) => { setPage(p); setArg(a); window.scrollTo(0, 0); };
  const logout = () => { TokenStore.clear(); setUser(null); setPage("home"); };
  const active: Page = page === "result" ? "scan" : page;
  const view = ({
    home: <S.Dashboard go={go} user={user} />, scan: <S.ScanHub go={go} tab={arg} />, result: <S.ResultScreen arg={arg} go={go} />, analytics: <S.Analytics />,
    history: <S.History go={go} />, assistant: <P.Assistant scanId={typeof arg === "number" ? arg : undefined} />, hub: <P.CyberHub />, report: <P.ReportPage />,
    security: <S.SecurityCenter />, score: <P.Score />, profile: <S.Profile user={user} onUser={setUser} go={go} onLogout={logout} />, settings: <S.Settings />,
  } as Record<Page, JSX.Element>)[page];
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      <aside className="glass sticky top-0 hidden h-dvh flex-col rounded-none border-y-0 border-l-0 p-4 md:flex">
        <p className="mb-6 px-2 font-display text-xl font-extrabold">🛡️ Cyber<span className="text-brand">Shield</span> AI</p>
        <nav className="space-y-1 overflow-y-auto">{SIDE.map(([id, ic, l]) => <button key={id} onClick={() => go(id)} className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition", active === id ? "bg-brand/15 text-brand shadow-[inset_3px_0_0_var(--color-brand)]" : "text-dim hover:bg-white/5 hover:text-bone")}><span>{ic}</span>{l}</button>)}</nav>
        <button onClick={logout} className="mt-auto rounded-2xl px-3 py-2.5 text-left text-dim hover:text-bad">⎋ Log out</button>
      </aside>
      <div>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-ink/80 px-4 py-3 backdrop-blur md:hidden">
          <p className="font-display text-lg font-extrabold">🛡️ Cyber<span className="text-brand">Shield</span> AI</p>
          <button aria-label="Profile" onClick={() => go("profile")} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand to-aqua font-bold text-white">{user.name[0]?.toUpperCase()}</button>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 pb-32 sm:px-8 md:pb-10" key={page + (typeof arg === "object" ? arg?.id : String(arg))}>{view}</main>
      </div>
      <nav className="safe-b glass fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-end rounded-none border-x-0 border-b-0 md:hidden">
        {BOTTOM.map(n => n === "SCAN"
          ? <button key="scan" onClick={() => go("scan")} aria-label="Scan" className="flex flex-col items-center pb-2"><span className={cx("-mt-6 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand to-aqua text-2xl text-white shadow-[0_8px_30px_-4px_var(--color-brand)] ring-4 ring-ink transition active:scale-95", active === "scan" && "scale-105")}>🔍</span><span className={cx("mt-1 text-[11px]", active === "scan" ? "text-brand" : "text-dim")}>Scan</span></button>
          : <button key={n[0]} onClick={() => go(n[0])} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-[11px]", active === n[0] ? "text-brand" : "text-dim")}><span className="text-xl">{n[1]}</span>{n[2]}</button>)}
      </nav>
    </div>);
}
