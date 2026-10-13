import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { api, Auth, TokenStore, Scan } from "./api";
import { Btn, Card, Err, Gauge, H, Input, THEME, V } from "./ui";

/* ================= 1. Auth Screen ================= */
export function AuthScreen({ onAuth }: { onAuth: (u: any) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const r =
        mode === "login"
          ? await Auth.login(f.email, f.password)
          : await Auth.register(f.name, f.email, f.password);
      TokenStore.set(r.token);
      TokenStore.setUser(r.user);
      onAuth(r.user);
    } catch (x: any) {
      setErr(x.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const quickDemo = async () => {
    setErr("");
    setBusy(true);
    try {
      const demoEmail = "demo@cybershield.ai";
      const demoPass = "password123";
      let r;
      try {
        r = await Auth.login(demoEmail, demoPass);
      } catch {
        r = await Auth.register("Demo User", demoEmail, demoPass);
      }
      TokenStore.set(r.token);
      TokenStore.setUser(r.user);
      onAuth(r.user);
    } catch (x: any) {
      setErr(x.message || "Failed to launch demo account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[authStyles.scroll, { paddingBottom: 60 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={authStyles.header}>
        <View style={authStyles.badge}>
          <Text style={authStyles.badgeDot}>●</Text>
          <Text style={authStyles.badgeText}>LIVE THREAT SHIELD</Text>
        </View>
        <Text style={authStyles.title}>
          🛡️ Cyber<Text style={{ color: THEME.brand }}>Shield</Text> AI
        </Text>
        <Text style={authStyles.sub}>
          Real-time threat protection for malicious links, SMS scams, and fraudulent QR codes.
        </Text>
      </View>

      <Card style={authStyles.card}>
        <View style={authStyles.modeToggle}>
          <TouchableOpacity
            style={[authStyles.modeBtn, mode === "login" && authStyles.modeBtnActive]}
            onPress={() => {
              setMode("login");
              setErr("");
            }}
          >
            <Text style={[authStyles.modeText, mode === "login" && authStyles.modeTextActive]}>
              Log in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[authStyles.modeBtn, mode === "register" && authStyles.modeBtnActive]}
            onPress={() => {
              setMode("register");
              setErr("");
            }}
          >
            <Text style={[authStyles.modeText, mode === "register" && authStyles.modeTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "register" && (
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={f.name}
            onChangeText={(name) => setF({ ...f, name })}
          />
        )}
        <Input
          label="Email Address"
          placeholder="user@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={f.email}
          onChangeText={(email) => setF({ ...f, email })}
        />
        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={f.password}
          onChangeText={(password) => setF({ ...f, password })}
        />

        <Err msg={err} />

        <Btn onPress={submit} loading={busy} style={{ marginTop: 8 }}>
          {mode === "login" ? "Sign In" : "Register Account"}
        </Btn>

        <Btn
          kind="ghost"
          onPress={quickDemo}
          disabled={busy}
          style={{ marginTop: 10, borderColor: THEME.brand }}
        >
          ⚡ Quick Guest / Demo Login
        </Btn>
      </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const authStyles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: THEME.bg,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(47, 123, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeDot: {
    color: THEME.brand,
    marginRight: 6,
    fontSize: 10,
  },
  badgeText: {
    color: THEME.brand,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: THEME.bone,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: THEME.dim,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  card: {
    padding: 20,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: THEME.cardBorderHighlight,
  },
  modeText: {
    color: THEME.dim,
    fontWeight: "600",
    fontSize: 13,
  },
  modeTextActive: {
    color: THEME.bone,
    fontWeight: "700",
  },
});

/* ================= 2. QrCamera (Expo Camera Scanner) ================= */
export function QrCamera({ onCode }: { onCode: (c: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [scanned, setScanned] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const startCamera = async () => {
    setStatusMsg("");
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setStatusMsg("Camera permission was denied. Please allow camera access in Settings.");
        return;
      }
    }
    setScanned(false);
    setCameraActive(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);
    setCameraActive(false);
    onCode(data);
  };

  const pickImage = async () => {
    setStatusMsg("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        // If image is picked, prompt user or use sample scan
        Alert.alert(
          "Image Selected",
          "Photo loaded from gallery. To simulate scanning, choose a sample scam payload or enter decoded content below.",
          [
            { text: "SBI KYC Scam", onPress: () => onCode("hxxp://sbi-kyc-update.top/login") },
            { text: "UPI Fraud", onPress: () => onCode("upi://pay?pa=scam@upi&am=5000") },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    } catch {
      setStatusMsg("Could not access photo library.");
    }
  };

  return (
    <View style={qrStyles.container}>
      <View style={qrStyles.btnRow}>
        <Btn
          kind={cameraActive ? "danger" : "primary"}
          onPress={() => {
            if (cameraActive) setCameraActive(false);
            else startCamera();
          }}
          style={{ flex: 1, marginRight: 8 }}
        >
          {cameraActive ? "✕ Stop Camera" : "📷 Live Camera"}
        </Btn>
        <Btn kind="ghost" onPress={pickImage} style={{ flex: 1 }}>
          🖼️ Pick Photo
        </Btn>
      </View>

      {statusMsg ? <Text style={qrStyles.statusWarn}>{statusMsg}</Text> : null}

      {cameraActive && (
        <View style={qrStyles.cameraFrame}>
          <CameraView
            style={qrStyles.camera}
            facing={facing}
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          >
            <View style={qrStyles.overlay}>
              <View style={qrStyles.targetBox}>
                <View style={[qrStyles.corner, qrStyles.tl]} />
                <View style={[qrStyles.corner, qrStyles.tr]} />
                <View style={[qrStyles.corner, qrStyles.bl]} />
                <View style={[qrStyles.corner, qrStyles.br]} />
              </View>
              <Text style={qrStyles.scannerTip}>Point camera at any QR code</Text>
            </View>
          </CameraView>

          <View style={qrStyles.cameraControls}>
            <TouchableOpacity
              onPress={() => setTorch(!torch)}
              style={qrStyles.camCtrlBtn}
            >
              <Text style={qrStyles.camCtrlText}>{torch ? "⚡ Torch On" : "💡 Torch Off"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFacing(facing === "back" ? "front" : "back")}
              style={qrStyles.camCtrlBtn}
            >
              <Text style={qrStyles.camCtrlText}>🔄 Flip Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick Test Demo Payloads */}
      <View style={qrStyles.sampleBox}>
        <Text style={qrStyles.sampleTitle}>Quick Test QR Samples:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={qrStyles.samplesScroll}>
          <TouchableOpacity
            style={qrStyles.chip}
            onPress={() => onCode("hxxp://sbi-kyc-update.top/login")}
          >
            <Text style={qrStyles.chipText}>🚨 Fake SBI KYC</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={qrStyles.chip}
            onPress={() => onCode("upi://pay?pa=prize_claim@upi&am=4999&pn=Lottery%20Prize")}
          >
            <Text style={qrStyles.chipText}>📲 UPI Scam QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={qrStyles.chip}
            onPress={() => onCode("https://github.com/security")}
          >
            <Text style={qrStyles.chipText}>✓ Safe Github Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={qrStyles.chip}
            onPress={() => onCode("WIFI:S:Free_Public_Wifi;T:nopass;;")}
          >
            <Text style={qrStyles.chipText}>📶 Unsecured Wi-Fi</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const qrStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  btnRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  statusWarn: {
    color: THEME.warn,
    fontSize: 12,
    marginVertical: 4,
    textAlign: "center",
  },
  cameraFrame: {
    height: 300,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: THEME.brand,
    marginVertical: 12,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  targetBox: {
    width: 190,
    height: 190,
    borderWidth: 1,
    borderColor: "rgba(47, 123, 255, 0.4)",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: THEME.brand,
  },
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
  scannerTip: {
    color: "#ffffff",
    fontSize: 12,
    marginTop: 16,
    fontWeight: "600",
  },
  cameraControls: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  camCtrlBtn: {
    backgroundColor: "rgba(16, 22, 35, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
  },
  camCtrlText: {
    color: THEME.bone,
    fontSize: 12,
    fontWeight: "600",
  },
  sampleBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
  },
  sampleTitle: {
    fontSize: 11,
    color: THEME.dim,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  samplesScroll: {
    flexDirection: "row",
  },
  chip: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
    marginRight: 8,
  },
  chipText: {
    color: THEME.bone,
    fontSize: 12,
    fontWeight: "500",
  },
});

/* ================= 3. PasswordChecker ================= */
const COMMON = ["password", "123456", "qwerty", "admin", "welcome", "letmein", "iloveyou", "abc123", "india", "000000"];

export function PasswordChecker({ embedded = false }: { embedded?: boolean }) {
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const counted = useRef(false);

  useEffect(() => {
    if (p.length >= 6 && !counted.current) {
      counted.current = true;
      api("/api/events/password-check", "POST").catch(() => {});
    }
    if (!p) counted.current = false;
  }, [p]);

  const checks = [
    ["8+ characters", p.length >= 8],
    ["12+ characters", p.length >= 12],
    ["Upper & lower case", /[a-z]/.test(p) && /[A-Z]/.test(p)],
    ["A number", /\d/.test(p)],
    ["A symbol", /[^A-Za-z0-9]/.test(p)],
    ["Not a common password", !!p && !COMMON.some((c) => p.toLowerCase().includes(c))],
  ] as const;

  const pool = (/[a-z]/.test(p) ? 26 : 0) + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^A-Za-z0-9]/.test(p) ? 32 : 0);
  const bits = p ? Math.round(p.length * Math.log2(pool || 1)) : 0;
  const score = Math.min(100, Math.round((bits / 80) * 100) - (checks[5][1] ? 0 : 40));
  const lvl = !p
    ? ["—", THEME.dim, "#263039"]
    : score < 35
    ? ["Weak", THEME.bad, "#ef4444"]
    : score < 65
    ? ["Fair", THEME.warn, "#f59e0b"]
    : ["Strong", THEME.ok, "#22c55e"];

  return (
    <View style={{ marginBottom: 16 }}>
      {!embedded && (
        <H sub="Checked on this device only — passwords are never transmitted anywhere.">
          Password Checker
        </H>
      )}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Input
              placeholder="Enter password to test strength"
              secureTextEntry={!show}
              value={p}
              onChangeText={setP}
              autoCapitalize="none"
            />
          </View>
          <Btn kind="ghost" onPress={() => setShow(!show)} style={{ minHeight: 46 }}>
            {show ? "Hide" : "Show"}
          </Btn>
        </View>

        <View style={{ height: 8, backgroundColor: THEME.line, borderRadius: 4, marginVertical: 8, overflow: "hidden" }}>
          <View style={{ width: `${Math.max(0, p ? score : 0)}%`, height: "100%", backgroundColor: lvl[2] }} />
        </View>

        <Text style={{ fontSize: 13, color: lvl[1] as string, fontWeight: "700" }}>
          {lvl[0]} <Text style={{ color: THEME.dim, fontWeight: "400" }}>· ~{bits} bits of entropy</Text>
        </Text>

        <View style={{ marginTop: 12 }}>
          {checks.map(([lbl, ok]) => (
            <View key={lbl} style={{ flexDirection: "row", alignItems: "center", marginVertical: 3 }}>
              <Text style={{ color: ok ? THEME.ok : THEME.dim, marginRight: 8, fontSize: 13, fontWeight: "bold" }}>
                {ok ? "✓" : "○"}
              </Text>
              <Text style={{ color: ok ? THEME.bone : THEME.dim, fontSize: 13 }}>{lbl}</Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

/* ================= 4. CyberHub ================= */
const TIPS = [
  ["🎣", "Phishing", "Banks never ask for OTP, PIN or password by SMS, call or link. Type the bank's address yourself."],
  ["📲", "UPI & QR fraud", "You never scan a QR code to *receive* money. If someone asks you to scan or approve a collect request to get paid, it is 100% a scam."],
  ["🔑", "Passwords", "Use a long unique passphrase per account and a password manager. Turn on two-factor authentication."],
  ["🛜", "Public Wi-Fi", "Avoid banking on open Wi-Fi. Use mobile cellular data or a trusted VPN."],
  ["🎁", "Too good to be true", "Lottery wins, free gifts and KYC 'expiry' threats create urgency so you act before thinking. Pause and verify."],
  ["🚨", "If you were scammed", "Call your bank immediately, change passwords, and report at cybercrime.gov.in or dial 1930 (India)."],
];

export const CyberHub = () => (
  <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
    <H sub="Short, practical lessons to keep you and your money safe.">Cyber Hub</H>
    {TIPS.map(([icon, title, desc]) => (
      <Card key={title}>
        <Text style={{ fontSize: 32, marginBottom: 6 }}>{icon}</Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: THEME.bone, marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: THEME.dim, lineHeight: 19 }}>{desc}</Text>
      </Card>
    ))}
  </ScrollView>
);

/* ================= 5. Assistant ================= */
type Msg = { role: "user" | "assistant"; content: string };
const CHIPS = [
  "Someone asked for my OTP",
  "Is a QR code safe to scan to get paid?",
  "How do I make a strong password?",
  "I was scammed — what now?",
];

export function Assistant({ scanId }: { scanId?: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! I'm your CyberShield AI assistant. Ask me about scams, links, QR/UPI fraud or passwords — or pick a recent scan below and I'll explain it.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [sid, setSid] = useState<number | null>(scanId ?? null);
  const chatScroll = useRef<ScrollView>(null);

  useEffect(() => {
    api("/api/history?limit=10").then(setScans).catch(() => {});
  }, []);

  useEffect(() => {
    setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs, busy]);

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = [...msgs.filter((_, i) => i > 0), { role: "user", content: q } as Msg].slice(-10);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setText("");
    setBusy(true);
    try {
      const r = await api("/api/assistant", "POST", { messages: history, scan_id: sid || null });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (x: any) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠️ " + (x.message || "Failed to respond") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={{ flex: 1, paddingBottom: 16 }}>
        <H sub="Plain-language threat advisor. Never share personal passwords here.">AI Assistant</H>

        {scans.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, maxHeight: 40 }}>
            <TouchableOpacity
              style={[chipStyles.chip, sid === null && chipStyles.chipActive]}
              onPress={() => setSid(null)}
            >
              <Text style={[chipStyles.chipText, sid === null && chipStyles.chipTextActive]}>General Advice</Text>
            </TouchableOpacity>
            {scans.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[chipStyles.chip, sid === s.id && chipStyles.chipActive]}
                onPress={() => setSid(s.id)}
              >
                <Text style={[chipStyles.chipText, sid === s.id && chipStyles.chipTextActive]}>
                  Scan #{s.id} ({s.kind})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Card style={{ flex: 1, padding: 12 }}>
          <ScrollView
            ref={chatScroll}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 8 }}
          >
            {msgs.map((m, i) => (
              <View
                key={i}
                style={[
                  chatStyles.bubbleWrap,
                  m.role === "user" ? chatStyles.userWrap : chatStyles.asstWrap,
                ]}
              >
                <View
                  style={[
                    chatStyles.bubble,
                    m.role === "user" ? chatStyles.userBubble : chatStyles.asstBubble,
                  ]}
                >
                  <Text style={m.role === "user" ? chatStyles.userText : chatStyles.asText}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}
            {busy && <Text style={{ color: THEME.dim, fontSize: 12, marginVertical: 4 }}>AI is thinking…</Text>}
          </ScrollView>

          {msgs.length === 1 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 }}>
              {CHIPS.map((c) => (
                <TouchableOpacity key={c} onPress={() => send(c)} style={chipStyles.chip}>
                  <Text style={chipStyles.chipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TextInput
              placeholder="Type your question…"
              placeholderTextColor="#64748b"
              value={text}
              onChangeText={setText}
              style={[chatStyles.input, { flex: 1, marginRight: 8 }]}
            />
            <Btn onPress={() => send(text)} disabled={busy || !text.trim()}>
              Send
            </Btn>
          </View>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
    marginRight: 6,
    alignSelf: "flex-start",
  },
  chipActive: {
    backgroundColor: THEME.brand,
    borderColor: THEME.brand,
  },
  chipText: {
    color: THEME.dim,
    fontSize: 12,
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

const chatStyles = StyleSheet.create({
  bubbleWrap: {
    marginVertical: 4,
    flexDirection: "row",
  },
  userWrap: {
    justifyContent: "flex-end",
  },
  asstWrap: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: THEME.brand,
    borderBottomRightRadius: 4,
  },
  asstBubble: {
    backgroundColor: THEME.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  userText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
  },
  asText: {
    color: THEME.bone,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: THEME.bone,
    fontSize: 13,
  },
});

/* ================= 6. Score ================= */
export function Score() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/score")
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <Err msg={err} />;
  if (!d) return <Text style={{ color: THEME.dim }}>Calculating score…</Text>;

  const v = d.score >= 70 ? "safe" : d.score >= 40 ? "suspicious" : "dangerous";

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <H sub="Based on your last 30 days of security habits.">Cyber Score</H>
      <Card style={{ alignItems: "center", paddingVertical: 20 }}>
        <Gauge score={d.score} verdict={v} label="SAFETY / 100" size={160} />
        <Text style={{ fontSize: 26, fontWeight: "900", color: V[v as keyof typeof V].color, marginTop: 8 }}>
          {d.level}
        </Text>
        <Text style={{ color: THEME.dim, fontSize: 13, marginTop: 4 }}>
          {d.scans_30d} scans in 30 days · {d.risky_30d} risky items caught
        </Text>
      </Card>

      <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginVertical: 8 }}>
        Habit Breakdown
      </Text>
      {d.breakdown.map((b: any) => (
        <Card key={b.name} style={{ marginBottom: 8, padding: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: THEME.bone, fontSize: 13, fontWeight: "600" }}>{b.name}</Text>
            <Text style={{ color: THEME.dim, fontSize: 13 }}>
              {b.value > 0 ? "+" : ""}
              {b.value}
              {b.max ? ` / ${b.max}` : ""}
            </Text>
          </View>
          <View style={{ height: 6, backgroundColor: THEME.line, borderRadius: 3, overflow: "hidden" }}>
            <View
              style={{
                width: `${b.max ? (Math.max(0, b.value) / b.max) * 100 : Math.min(100, Math.abs(b.value) * 6.6)}%`,
                height: "100%",
                backgroundColor: b.value < 0 ? THEME.bad : THEME.brand,
              }}
            />
          </View>
        </Card>
      ))}

      <Card style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginBottom: 8 }}>
          How to improve
        </Text>
        {d.tips.map((t: string) => (
          <View key={t} style={{ flexDirection: "row", marginVertical: 4 }}>
            <Text style={{ color: THEME.brand, marginRight: 8 }}>▸</Text>
            <Text style={{ color: THEME.textSecondary, fontSize: 13, flex: 1, lineHeight: 18 }}>{t}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

/* ================= 7. Scam Reporting ================= */
export function ReportBtn({ scan }: { scan: Scan }) {
  const [state, setState] = useState("");

  return (
    <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center" }}>
      <Btn
        kind="danger"
        disabled={state === "done" || state === "busy"}
        onPress={async () => {
          setState("busy");
          try {
            await api("/api/reports", "POST", {
              kind: scan.kind,
              category: scan.kind === "qr" ? "upi_qr" : "phishing",
              content: scan.input,
              scan_id: scan.id,
            });
            setState("done");
          } catch (e: any) {
            setState(e.message || "Failed");
          }
        }}
        style={{ paddingVertical: 8, minHeight: 38 }}
      >
        🚨 Report as Scam
      </Btn>
      {state === "done" ? (
        <Text style={{ color: THEME.ok, marginLeft: 10, fontSize: 13 }}>Reported ✓</Text>
      ) : state && state !== "busy" ? (
        <Text style={{ color: THEME.warn, marginLeft: 10, fontSize: 12 }}>{state}</Text>
      ) : null}
    </View>
  );
}

export function ReportPage() {
  const [f, setF] = useState({ kind: "url", category: "phishing", content: "", description: "" });
  const [mine, setMine] = useState<any[]>([]);
  const [com, setCom] = useState<any>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api("/api/reports").then(setMine).catch(() => {});
    api("/api/reports/community").then(setCom).catch(() => {});
  };

  useEffect(load, []);

  const submit = async () => {
    if (!f.content.trim()) return;
    setErr("");
    setOk("");
    setBusy(true);
    try {
      await api("/api/reports", "POST", f);
      setOk("Report submitted. Thank you for protecting the community!");
      setF({ ...f, content: "", description: "" });
      load();
    } catch (x: any) {
      setErr(x.message || "Failed to submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 160 }}
    >
      <H sub="Community reports train the scanner and alert other users.">Report a Scam</H>

      {com && (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Card style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: THEME.dim, fontWeight: "700" }}>COMMUNITY REPORTS</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: THEME.bad }}>{com.total}</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: THEME.dim, fontWeight: "700" }}>MY REPORTS</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: THEME.brand }}>{com.mine}</Text>
          </Card>
        </View>
      )}

      <Card>
        <Input
          label="Target Content (URL, SMS text, or QR payload)"
          placeholder="e.g. hxxp://fake-bank-login.com"
          value={f.content}
          onChangeText={(content) => setF({ ...f, content })}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />
        <Input
          label="What happened? (optional - no OTPs or passwords)"
          placeholder="Details of the scam attempt..."
          value={f.description}
          onChangeText={(description) => setF({ ...f, description })}
          multiline
          numberOfLines={2}
          style={{ height: 60, textAlignVertical: "top" }}
        />

        <Err msg={err} />
        {ok ? <Text style={{ color: THEME.ok, fontSize: 13, marginVertical: 6 }}>{ok}</Text> : null}

        <Btn onPress={submit} loading={busy} style={{ marginTop: 6 }}>
          Submit Scam Report
        </Btn>
      </Card>

      <Text style={{ fontSize: 16, fontWeight: "700", color: THEME.bone, marginVertical: 12 }}>
        My Submitted Reports ({mine.length})
      </Text>
      {mine.map((r) => (
        <Card key={r.id} style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: THEME.bone, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
              {r.content}
            </Text>
            <Text style={{ color: THEME.dim, fontSize: 11, marginTop: 2 }}>
              {r.kind.toUpperCase()} · {r.category}
            </Text>
          </View>
          <TouchableOpacity
            onPress={async () => {
              await api(`/api/reports/${r.id}`, "DELETE");
              load();
            }}
            style={{ padding: 8 }}
          >
            <Text style={{ color: THEME.bad, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </Card>
      ))}
    </ScrollView>
  );
}
