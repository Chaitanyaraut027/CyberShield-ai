import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { api, TokenStore, getBase, setBase, Full, Scan } from "./api";
import {
  Bar,
  Btn,
  Card,
  Err,
  Gauge,
  Go,
  H,
  Input,
  Page,
  THEME,
  V,
} from "./ui";
import { PasswordChecker, QrCamera, ReportBtn } from "./pages";

const ICON: Record<string, string> = { url: "🌐", sms: "💬", qr: "▣" };

const levelOf = (s: number) =>
  s >= 80
    ? (["SECURE", "safe"] as const)
    : s >= 60
    ? (["PROTECTED", "safe"] as const)
    : s >= 40
    ? (["LEARNING", "suspicious"] as const)
    : (["AT RISK", "dangerous"] as const);

/* ================= 1. Dashboard ================= */
export function Dashboard({ go, user }: { go: Go; user: any }) {
  const [an, setAn] = useState<any>(null);
  const [sc, setSc] = useState<any>(null);
  const [sec, setSec] = useState<any>(null);

  useEffect(() => {
    api("/api/analytics").then(setAn).catch(() => {});
    api("/api/score").then(setSc).catch(() => {});
    api("/api/security").then(setSec).catch(() => {});
  }, []);

  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const score = sc?.score ?? 0;
  const [lvl, vk] = levelOf(score);
  const k = an?.by_kind ?? {};

  const FEATS = [
    { tab: "url", icon: "🌐", t: "URL Scanner", d: "Detect phishing & malware links", cta: "Analyze URL →" },
    { tab: "sms", icon: "💬", t: "SMS Scanner", d: "Detect scam and urgency wording", cta: "Analyze SMS →" },
    { tab: "qr", icon: "▣", t: "QR Scanner", d: "Live camera QR & destination safety", cta: "Scan QR →" },
    { tab: "password", icon: "🔐", t: "Password Security", d: "Test entropy and leak criteria offline", cta: "Check Password →" },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      {/* Top Card: Status & Score */}
      <Card style={{ padding: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: THEME.bone, fontSize: 22, fontWeight: "800" }}>
              {greet}, {user?.name?.split(" ")[0] || "User"}
            </Text>
            <View style={dashStyles.liveBadge}>
              <View style={dashStyles.liveDot} />
              <Text style={dashStyles.liveText}>SYSTEM PROTECTED</Text>
            </View>
            <TouchableOpacity onPress={() => go("score")} style={{ marginTop: 8 }}>
              <Text style={{ color: THEME.brand, fontSize: 13, fontWeight: "600" }}>
                How is this calculated? →
              </Text>
            </TouchableOpacity>
          </View>
          <Gauge score={score} verdict={vk as any} label={lvl} size={130} />
        </View>
      </Card>

      {/* Stats Grid */}
      <View style={dashStyles.statsGrid}>
        <Card style={dashStyles.statCard}>
          <Text style={dashStyles.statLabel}>THREATS FOUND</Text>
          <Text style={[dashStyles.statVal, { color: THEME.bad }]}>{an?.threats ?? 0}</Text>
        </Card>
        <Card style={dashStyles.statCard}>
          <Text style={dashStyles.statLabel}>URLS CHECKED</Text>
          <Text style={dashStyles.statVal}>{k.url ?? 0}</Text>
        </Card>
        <Card style={dashStyles.statCard}>
          <Text style={dashStyles.statLabel}>SMS ANALYZED</Text>
          <Text style={dashStyles.statVal}>{k.sms ?? 0}</Text>
        </Card>
        <Card style={dashStyles.statCard}>
          <Text style={dashStyles.statLabel}>QR SCANNED</Text>
          <Text style={dashStyles.statVal}>{k.qr ?? 0}</Text>
        </Card>
      </View>

      {/* Security Tools */}
      <Text style={dashStyles.sectionTitle}>Security Scanners</Text>
      <View style={dashStyles.toolsGrid}>
        {FEATS.map((f) => (
          <TouchableOpacity
            key={f.tab}
            activeOpacity={0.8}
            onPress={() => go("scan", f.tab)}
            style={dashStyles.toolCard}
          >
            <Text style={{ fontSize: 28, marginBottom: 6 }}>{f.icon}</Text>
            <Text style={dashStyles.toolTitle}>{f.t}</Text>
            <Text style={dashStyles.toolDesc}>{f.d}</Text>
            <Text style={dashStyles.toolCta}>{f.cta}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Action Buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
        {[
          ["assistant", "🤖", "AI Assistant"],
          ["report", "🚨", "Report Scam"],
          ["security", "🛡️", "Security Center"],
          ["hub", "📚", "Cyber Hub"],
        ].map(([p, ic, lbl]) => (
          <TouchableOpacity
            key={p}
            onPress={() => go(p as Page)}
            style={dashStyles.quickPill}
          >
            <Text style={{ color: THEME.bone, fontSize: 13, fontWeight: "600" }}>
              {ic} {lbl}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent Threats */}
      <Text style={dashStyles.sectionTitle}>Recent Threats</Text>
      {an && !an.recent_threats?.length ? (
        <Card>
          <Text style={{ color: THEME.dim, fontSize: 13 }}>
            No threats detected yet. Scan a link, SMS message or QR code to test.
          </Text>
        </Card>
      ) : (
        an?.recent_threats?.map((s: Scan) => (
          <TimelineRow key={s.id} s={s} onOpen={() => go("result", s.id)} />
        ))
      )}
    </ScrollView>
  );
}

const dashStyles = StyleSheet.create({
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.okBg,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: THEME.ok,
    marginRight: 6,
  },
  liveText: {
    color: THEME.ok,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statCard: {
    width: "48%",
    padding: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: THEME.dim,
    fontWeight: "700",
    marginBottom: 4,
  },
  statVal: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.bone,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.bone,
    marginTop: 16,
    marginBottom: 10,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  toolCard: {
    width: "48%",
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  toolTitle: {
    color: THEME.bone,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  toolDesc: {
    color: THEME.dim,
    fontSize: 11,
    lineHeight: 15,
    minHeight: 30,
  },
  toolCta: {
    color: THEME.brand,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  quickPill: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
    marginRight: 8,
  },
});

/* ================= 2. ScanHub ================= */
const STEPS = ["Scanning…", "Analyzing rules…", "Checking reputation…", "AI evaluation…"];

function useAnalyze(go: Go, kind: string) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  const run = async (field: string, value: string) => {
    setErr("");
    setBusy(true);
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, 3)), 400);
    try {
      const [r] = await Promise.all([
        api<Full>(`/api/analyze/${kind}`, "POST", { [field]: value }),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      go("result", r);
    } catch (e: any) {
      setErr(e.message || "Analysis failed");
    } finally {
      clearInterval(t);
      setBusy(false);
    }
  };

  return { busy, step, err, run };
}

function StepsView({ step }: { step: number }) {
  return (
    <View style={{ marginTop: 12, backgroundColor: THEME.surface, padding: 10, borderRadius: 12 }}>
      {STEPS.map((s, i) => (
        <View key={s} style={{ flexDirection: "row", alignItems: "center", marginVertical: 3 }}>
          <Text style={{ color: i <= step ? THEME.ok : THEME.dim, marginRight: 8, fontSize: 12 }}>
            {i < step ? "✓" : i === step ? "●" : "○"}
          </Text>
          <Text style={{ color: i <= step ? THEME.bone : THEME.dim, fontSize: 12 }}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

function RecentScans({ kind, go }: { kind: string; go: Go }) {
  const [rows, setRows] = useState<Scan[]>([]);
  useEffect(() => {
    api(`/api/history?kind=${kind}&limit=3`).then(setRows).catch(() => {});
  }, [kind]);

  if (!rows.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 11, color: THEME.dim, fontWeight: "700", textTransform: "uppercase", marginBottom: 8 }}>
        Recent {kind.toUpperCase()} Scans
      </Text>
      {rows.map((s) => (
        <TimelineRow key={s.id} s={s} onOpen={() => go("result", s.id)} />
      ))}
    </View>
  );
}

function UrlScanner({ go }: { go: Go }) {
  const [v, setV] = useState("");
  const a = useAnalyze(go, "url");

  return (
    <Card>
      <View style={{ alignItems: "center", marginVertical: 10 }}>
        <Text style={{ fontSize: 44 }}>🌐</Text>
        <Text style={{ color: THEME.dim, fontSize: 13, textAlign: "center", marginTop: 4 }}>
          Enter any link to check for phishing and malicious domains.
        </Text>
      </View>
      <Input
        placeholder="https://example.com"
        value={v}
        onChangeText={setV}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Btn onPress={() => a.run("url", v)} disabled={a.busy || !v.trim()} loading={a.busy}>
        {a.busy ? "Analyzing URL…" : "Analyze URL"}
      </Btn>
      {a.busy && <StepsView step={a.step} />}
      <Err msg={a.err} />
      <RecentScans kind="url" go={go} />
    </Card>
  );
}

function SmsScanner({ go }: { go: Go }) {
  const [v, setV] = useState("");
  const a = useAnalyze(go, "sms");

  return (
    <Card>
      <View style={{ alignItems: "center", marginVertical: 10 }}>
        <Text style={{ fontSize: 44 }}>💬</Text>
        <Text style={{ color: THEME.dim, fontSize: 13, textAlign: "center", marginTop: 4 }}>
          Paste suspicious SMS or chat messages. Scam keywords are analyzed.
        </Text>
      </View>
      <Input
        placeholder="Congratulations! You have won ₹50,000 lottery..."
        value={v}
        onChangeText={setV}
        multiline
        numberOfLines={4}
        style={{ height: 100, textAlignVertical: "top" }}
      />
      <Btn onPress={() => a.run("message", v)} disabled={a.busy || !v.trim()} loading={a.busy}>
        {a.busy ? "Analyzing Message…" : "Analyze SMS"}
      </Btn>
      {a.busy && <StepsView step={a.step} />}
      <Err msg={a.err} />
      <RecentScans kind="sms" go={go} />
    </Card>
  );
}

function QrScanner({ go }: { go: Go }) {
  const [v, setV] = useState("");
  const a = useAnalyze(go, "qr");

  const scan = (code: string) => {
    setV(code);
    a.run("content", code);
  };

  return (
    <Card>
      <View style={{ alignItems: "center", marginVertical: 8 }}>
        <Text style={{ fontSize: 40 }}>▣</Text>
        <Text style={{ color: THEME.bone, fontSize: 16, fontWeight: "700", marginTop: 4 }}>
          Live Expo QR Scanner
        </Text>
        <Text style={{ color: THEME.dim, fontSize: 12, textAlign: "center", marginTop: 2 }}>
          Scan with your device camera or test with quick samples.
        </Text>
      </View>

      {/* Live camera & photo picker */}
      <QrCamera onCode={scan} />

      <Text style={{ fontSize: 11, color: THEME.dim, fontWeight: "700", textTransform: "uppercase", marginTop: 12, marginBottom: 6 }}>
        Or Paste Decoded QR Content
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Input
            placeholder="e.g. upi://pay?pa=... or https://..."
            value={v}
            onChangeText={setV}
            autoCapitalize="none"
          />
        </View>
        <Btn onPress={() => a.run("content", v)} disabled={a.busy || !v.trim()} style={{ minHeight: 46 }}>
          Analyze
        </Btn>
      </View>

      {a.busy && <StepsView step={a.step} />}
      <Err msg={a.err} />
      <RecentScans kind="qr" go={go} />
    </Card>
  );
}

export function ScanHub({ go, tab = "url" }: { go: Go; tab?: string }) {
  const [t, setT] = useState(tab);
  const TABS = [
    ["url", "🌐", "URL"],
    ["sms", "💬", "SMS"],
    ["qr", "▣", "QR"],
    ["password", "🔐", "Pass"],
  ];

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 160 }}
    >
      <H sub="Select the scanner to protect yourself against threats.">Scanner Hub</H>

      {/* Sub Tabs */}
      <View style={tabStyles.container}>
        {TABS.map(([id, ic, lbl]) => (
          <TouchableOpacity
            key={id}
            onPress={() => setT(id)}
            style={[tabStyles.tab, t === id && tabStyles.tabActive]}
          >
            <Text style={{ fontSize: 14 }}>{ic}</Text>
            <Text style={[tabStyles.tabText, t === id && tabStyles.tabTextActive]}>{lbl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {t === "url" && <UrlScanner go={go} />}
      {t === "sms" && <SmsScanner go={go} />}
      {t === "qr" && <QrScanner go={go} />}
      {t === "password" && <PasswordChecker embedded />}
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: THEME.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: THEME.brand,
  },
  tabText: {
    color: THEME.dim,
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

/* ================= 3. Result Screen ================= */
export function ResultScreen({ arg, go }: { arg: Full | number; go: Go }) {
  const [d, setD] = useState<Full | null>(typeof arg === "object" ? arg : null);
  const [err, setErr] = useState("");
  const [why, setWhy] = useState(false);

  useEffect(() => {
    if (typeof arg === "number") {
      api<Full>(`/api/scans/${arg}`).then(setD).catch((e) => setErr(e.message));
    }
  }, [arg]);

  if (err) return <Err msg={err} />;
  if (!d) return <Text style={{ color: THEME.dim, padding: 20 }}>Loading scan analysis…</Text>;

  const v = V[d.verdict];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <TouchableOpacity onPress={() => go("home")} style={{ marginBottom: 12 }}>
        <Text style={{ color: THEME.dim, fontSize: 13 }}>← Back to Dashboard</Text>
      </TouchableOpacity>

      {/* Main Verdict Card */}
      <Card style={{ alignItems: "center", paddingVertical: 20 }}>
        <View style={[resStyles.badgeIcon, { backgroundColor: v.color }]}>
          <Text style={{ fontSize: 28, color: "#ffffff", fontWeight: "900" }}>{v.icon}</Text>
        </View>
        <Text style={[resStyles.verdictLabel, { color: v.color }]}>{v.label}</Text>

        <Gauge score={d.score} verdict={d.verdict} label="/ 100 RISK" size={150} />

        <View style={{ width: "90%", marginTop: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: THEME.dim, fontSize: 12 }}>
              {d.engine === "ml+rules" ? "AI Model Confidence" : "Rules Engine Confidence"}
            </Text>
            <Text style={{ color: THEME.bone, fontSize: 12, fontWeight: "700" }}>{d.confidence}%</Text>
          </View>
          <Bar pct={d.confidence} color={v.color} />
        </View>
      </Card>

      {/* Target Content */}
      <Card>
        <Text style={{ fontSize: 11, color: THEME.dim, fontWeight: "700", textTransform: "uppercase" }}>
          Scanned {d.kind.toUpperCase()} Payload
        </Text>
        <Text style={{ color: THEME.bone, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          {d.input}
        </Text>
      </Card>

      {/* Risk Indicators */}
      <Card>
        <Text style={{ fontSize: 15, fontWeight: "700", color: THEME.bone, marginBottom: 8 }}>
          Risk Indicators
        </Text>
        {d.reasons.map((r, i) => (
          <View key={i} style={{ flexDirection: "row", marginVertical: 3 }}>
            <Text style={{ color: d.verdict === "safe" ? THEME.ok : THEME.warn, marginRight: 8 }}>
              {d.verdict === "safe" ? "✓" : "⚠"}
            </Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13, flex: 1 }}>{r}</Text>
          </View>
        ))}
      </Card>

      {/* AI Explanation & Recommendation */}
      <Card>
        <Text style={{ fontSize: 15, fontWeight: "700", color: THEME.bone, marginBottom: 6 }}>
          🤖 AI Assessment
        </Text>
        <Text style={{ color: THEME.dim, fontSize: 13, lineHeight: 19 }}>{d.explanation}</Text>

        <View style={resStyles.recBox}>
          <Text style={resStyles.recTitle}>RECOMMENDATION</Text>
          <Text style={{ color: THEME.bone, fontSize: 13, lineHeight: 18 }}>{d.recommendation}</Text>
        </View>
      </Card>

      {/* Breakdown Accordion */}
      <Card>
        <TouchableOpacity
          onPress={() => setWhy(!why)}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: THEME.bone }}>
            Why this result?
          </Text>
          <Text style={{ color: THEME.dim, fontSize: 14 }}>{why ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {why && (
          <View style={{ marginTop: 12 }}>
            {d.breakdown.length ? (
              d.breakdown.map((b) => (
                <View key={b.name} style={{ marginVertical: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: THEME.bone, fontSize: 12 }}>{b.name}</Text>
                    <Text style={{ color: THEME.dim, fontSize: 12 }}>+{b.points} pts</Text>
                  </View>
                  <Bar pct={(b.points / Math.max(1, d.score)) * 100} color={v.color} />
                </View>
              ))
            ) : (
              <Text style={{ color: THEME.dim, fontSize: 12 }}>No threat signals detected.</Text>
            )}
          </View>
        )}
      </Card>

      {/* Threat Intel Checks */}
      <Card>
        <Text style={{ fontSize: 15, fontWeight: "700", color: THEME.bone, marginBottom: 8 }}>
          Threat Intelligence Checks
        </Text>
        {d.checks.map((c) => (
          <View key={c.name} style={resStyles.checkRow}>
            <Text style={{ fontSize: 13, color: c.status === "ok" ? THEME.ok : c.status === "bad" ? THEME.bad : THEME.warn, width: 20 }}>
              {c.status === "ok" ? "✓" : c.status === "bad" ? "✕" : "⚠"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: THEME.bone, fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
              <Text style={{ color: THEME.dim, fontSize: 11 }}>{c.detail}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Actions */}
      <View style={{ marginTop: 8, gap: 8 }}>
        <Btn onPress={() => go("assistant", d.id)}>🤖 Ask the AI About This</Btn>
        <Btn kind="ghost" onPress={() => go("home")}>Back to Dashboard</Btn>
      </View>

      <ReportBtn scan={d} />
    </ScrollView>
  );
}

const resStyles = StyleSheet.create({
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  verdictLabel: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  recBox: {
    backgroundColor: "rgba(47, 123, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(47, 123, 255, 0.3)",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  recTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.brand,
    letterSpacing: 1,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
});

/* ================= 4. Timeline Row ================= */
export function TimelineRow({
  s,
  onOpen,
  onDelete,
}: {
  s: Scan;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const v = V[s.verdict];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onOpen}
      style={rowStyles.card}
    >
      <View style={[rowStyles.dot, { backgroundColor: v.color }]} />
      <View style={{ flex: 1, marginHorizontal: 8 }}>
        <Text style={[rowStyles.verdict, { color: v.color }]}>
          {v.label} · {s.kind.toUpperCase()}
        </Text>
        <Text style={rowStyles.input} numberOfLines={1}>
          {ICON[s.kind]} {s.input}
        </Text>
        <Text style={rowStyles.time}>
          {new Date(s.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </Text>
      </View>
      <Text style={[rowStyles.score, { color: v.color }]}>{s.score}</Text>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
          <Text style={{ color: THEME.bad, fontSize: 14 }}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  verdict: {
    fontSize: 11,
    fontWeight: "700",
  },
  input: {
    color: THEME.bone,
    fontSize: 13,
    marginVertical: 2,
  },
  time: {
    color: THEME.dim,
    fontSize: 10,
  },
  score: {
    fontSize: 18,
    fontWeight: "800",
  },
});

/* ================= 5. History ================= */
export function History({ go }: { go: Go }) {
  const [rows, setRows] = useState<Scan[] | null>(null);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");

  const load = () =>
    api(`/api/history${filter ? `?kind=${filter}` : ""}`)
      .then(setRows)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <H sub="Tap any previous scan to review full AI analysis.">Scan History</H>

      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, alignItems: "center" }}>
        {["", "url", "sms", "qr"].map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setFilter(k)}
            style={[histStyles.filterPill, filter === k && histStyles.filterPillActive]}
          >
            <Text style={[histStyles.filterText, filter === k && histStyles.filterTextActive]}>
              {k ? k.toUpperCase() : "ALL"}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Clear History", "Permanently remove all scan records?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete All",
                style: "destructive",
                onPress: async () => {
                  await api("/api/history", "DELETE");
                  load();
                },
              },
            ]);
          }}
          style={{ marginLeft: "auto" }}
        >
          <Text style={{ color: THEME.bad, fontSize: 13, fontWeight: "600" }}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <Err msg={err} />
      {rows && !rows.length && (
        <Card>
          <Text style={{ color: THEME.dim, textAlign: "center", paddingVertical: 10 }}>
            No scan history found.
          </Text>
        </Card>
      )}

      {rows?.map((s) => (
        <TimelineRow
          key={s.id}
          s={s}
          onOpen={() => go("result", s.id)}
          onDelete={async () => {
            await api(`/api/history/${s.id}`, "DELETE");
            load();
          }}
        />
      ))}
    </ScrollView>
  );
}

const histStyles = StyleSheet.create({
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
  },
  filterPillActive: {
    backgroundColor: THEME.brand,
    borderColor: THEME.brand,
  },
  filterText: {
    color: THEME.dim,
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#ffffff",
  },
});

/* ================= 6. Analytics ================= */
export function Analytics() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/analytics").then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Err msg={err} />;
  if (!d) return <Text style={{ color: THEME.dim }}>Loading analytics…</Text>;

  const maxDay = Math.max(1, ...d.days.map((x: any) => x.count));
  const kinds = [
    ["URL", d.by_kind.url, THEME.brand],
    ["SMS", d.by_kind.sms, THEME.aqua],
    ["QR", d.by_kind.qr, THEME.ok],
    ["Password", d.by_kind.password, THEME.warn],
  ] as const;
  const maxKind = Math.max(1, ...kinds.map((k) => k[1]));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <H sub="Real-time threat statistics and safety activity.">Security Analytics</H>

      {/* 7-day bar chart */}
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginBottom: 12 }}>
          Last 7 Days Activity
        </Text>
        <View style={{ flexDirection: "row", height: 120, alignItems: "flex-end", gap: 6 }}>
          {d.days.map((x: any) => (
            <View key={x.day} style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: THEME.dim, fontSize: 10, marginBottom: 4 }}>{x.count || ""}</Text>
              <View
                style={{
                  width: "70%",
                  height: `${Math.max(8, (x.count / maxDay) * 100)}%`,
                  backgroundColor: THEME.brand,
                  borderRadius: 4,
                }}
              />
              <Text style={{ color: THEME.dim, fontSize: 10, marginTop: 4 }}>{x.day}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Scans by Type */}
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginBottom: 8 }}>
          Scans by Category
        </Text>
        {kinds.map(([name, count, color]) => (
          <View key={name} style={{ marginVertical: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: THEME.bone, fontSize: 12 }}>{name}</Text>
              <Text style={{ color: THEME.dim, fontSize: 12 }}>{count}</Text>
            </View>
            <Bar pct={(count / maxKind) * 100} color={color} />
          </View>
        ))}
      </Card>

      {/* Threat Distribution */}
      <Card>
        <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginBottom: 8 }}>
          Threat Distribution
        </Text>
        <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginVertical: 6 }}>
          <View style={{ width: `${d.distribution.safe}%`, backgroundColor: THEME.ok }} />
          <View style={{ width: `${d.distribution.suspicious}%`, backgroundColor: THEME.warn }} />
          <View style={{ width: `${d.distribution.dangerous}%`, backgroundColor: THEME.bad }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: THEME.ok, fontSize: 18, fontWeight: "800" }}>{d.distribution.safe}%</Text>
            <Text style={{ color: THEME.dim, fontSize: 11 }}>SAFE</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: THEME.warn, fontSize: 18, fontWeight: "800" }}>{d.distribution.suspicious}%</Text>
            <Text style={{ color: THEME.dim, fontSize: 11 }}>SUSPICIOUS</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: THEME.bad, fontSize: 18, fontWeight: "800" }}>{d.distribution.dangerous}%</Text>
            <Text style={{ color: THEME.dim, fontSize: 11 }}>DANGEROUS</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

/* ================= 7. SecurityCenter ================= */
export function SecurityCenter() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/security").then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Err msg={err} />;
  if (!d) return <Text style={{ color: THEME.dim }}>Checking security status…</Text>;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <H sub="Active threat shields and defense recommendations.">Security Center</H>
      <Card style={{ alignItems: "center", paddingVertical: 20 }}>
        <Text style={{ fontSize: 48, marginBottom: 8 }}>🛡️</Text>
        <Text style={{ fontSize: 24, fontWeight: "900", color: THEME.ok }}>SYSTEM PROTECTED</Text>
        <Text style={{ color: THEME.dim, fontSize: 12, marginTop: 4 }}>
          Engine: {d.engine === "ml+rules" ? "AI Model + Rules" : "On-Device Rules Engine Active"}
        </Text>
      </Card>

      <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginVertical: 8 }}>
        Active Shields
      </Text>
      <Card>
        {d.protections.map((p: any) => (
          <View key={p.name} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: THEME.line }}>
            <Text style={{ color: THEME.bone, fontSize: 14 }}>{p.name}</Text>
            <View style={{ backgroundColor: THEME.okBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: THEME.ok, fontSize: 11, fontWeight: "700" }}>ACTIVE</Text>
            </View>
          </View>
        ))}
      </Card>

      <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginVertical: 8 }}>
        Recommendations
      </Text>
      <Card>
        {d.recommendations.map((r: any, i: number) => (
          <View key={i} style={{ flexDirection: "row", marginVertical: 5 }}>
            <Text style={{ color: r.ok ? THEME.ok : THEME.warn, marginRight: 8 }}>
              {r.ok ? "✓" : "⚠"}
            </Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13, flex: 1 }}>{r.text}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

/* ================= 8. Profile (Me) ================= */
export function Profile({
  user,
  onUser,
  go,
  onLogout,
}: {
  user: any;
  onUser: (u: any) => void;
  go: Go;
  onLogout: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [ok, setOk] = useState("");

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 160 }}
    >
      {/* Avatar Header */}
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <View style={profStyles.avatar}>
          <Text style={profStyles.avatarText}>{user.name[0]?.toUpperCase() || "U"}</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: "800", color: THEME.bone, marginTop: 8 }}>
          {user.name}
        </Text>
        <Text style={{ color: THEME.dim, fontSize: 13 }}>{user.email}</Text>
      </View>

      {/* Account Info */}
      <Card>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Email Address" value={user.email} editable={false} />
        <Btn
          onPress={async () => {
            const u = await api("/api/auth/me", "PATCH", { name });
            TokenStore.setUser(u);
            onUser(u);
            setOk("Saved ✓");
          }}
        >
          Save Profile Changes
        </Btn>
        {ok ? <Text style={{ color: THEME.ok, fontSize: 12, marginTop: 6 }}>{ok}</Text> : null}
      </Card>

      {/* Shortcuts */}
      <Card>
        {([
          ["🛡️", "Security Center", () => go("security")],
          ["🤖", "AI Threat Assistant", () => go("assistant")],
          ["🏆", "My Cyber Score", () => go("score")],
          ["🚨", "Report a Scam", () => go("report")],
          ["📚", "Cyber Knowledge Hub", () => go("hub")],
          ["⚙️", "Backend Server Connection", () => go("settings")],
        ] as [string, string, () => void][]).map(([ic, label, action], i) => (
          <TouchableOpacity
            key={i}
            onPress={action}
            style={profStyles.menuRow}
          >
            <Text style={{ fontSize: 18, marginRight: 10 }}>{ic}</Text>
            <Text style={{ color: THEME.bone, fontSize: 14, flex: 1 }}>{label}</Text>
            <Text style={{ color: THEME.dim, fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}
      </Card>

      {/* Logout */}
      <Btn kind="danger" onPress={onLogout} style={{ marginTop: 8 }}>
        Sign Out / Log Out
      </Btn>
    </ScrollView>
  );
}

const profStyles = StyleSheet.create({
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
});

/* ================= 9. Settings ================= */
export function Settings() {
  const [base, setB] = useState(getBase());
  const [health, setH] = useState("");

  const test = async () => {
    setH("Testing backend connection…");
    try {
      const r = await fetch(base.replace(/\/$/, "") + "/api/health");
      const j = await r.json();
      setH(
        r.ok
          ? `✓ Backend reachable · AI Model: ${j.model_loaded ? "Loaded" : "Not trained yet"}`
          : "✗ Backend error response"
      );
    } catch {
      setH("✗ Cannot reach backend. Ensure your phone and PC are on the same Wi-Fi.");
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 160 }}
    >
      <H sub="Configure backend connection and offline engine settings.">Settings</H>
      <Card>
        <Input
          label="Backend Server URL (Blank = Offline On-Device Engine)"
          placeholder="http://192.168.1.10:8000"
          value={base}
          onChangeText={setB}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <Btn kind="ghost" onPress={test} style={{ flex: 1 }}>
            Test Connection
          </Btn>
          <Btn
            onPress={() => {
              setBase(base.trim());
              setH("Saved successfully ✓");
            }}
            style={{ flex: 1 }}
          >
            Save URL
          </Btn>
        </View>
        {health ? <Text style={{ color: THEME.dim, fontSize: 12, marginTop: 10 }}>{health}</Text> : null}
      </Card>
    </ScrollView>
  );
}
