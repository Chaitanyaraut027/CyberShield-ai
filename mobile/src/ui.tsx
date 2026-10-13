import React, { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  TextInputProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

export type Page =
  | "home"
  | "scan"
  | "result"
  | "analytics"
  | "history"
  | "assistant"
  | "hub"
  | "report"
  | "security"
  | "score"
  | "profile"
  | "settings";

export type Go = (p: Page, arg?: any) => void;

export const THEME = {
  bg: "#0a0e17",
  surface: "#101623",
  card: "#151d2e",
  cardBorder: "#1e293b",
  cardBorderHighlight: "#2b3b55",
  brand: "#2f7bff",
  aqua: "#22d3ee",
  bone: "#f8fafc",
  textSecondary: "#cbd5e1",
  dim: "#94a3b8",
  muted: "#64748b",
  line: "#1e293b",
  ok: "#22c55e",
  okBg: "rgba(34, 197, 94, 0.12)",
  warn: "#f59e0b",
  warnBg: "rgba(245, 158, 11, 0.12)",
  bad: "#ef4444",
  badBg: "rgba(239, 68, 68, 0.14)",
};

export const V = {
  safe: { label: "SAFE", color: THEME.ok, bg: THEME.okBg, icon: "✓", word: "Looks safe" },
  suspicious: { label: "SUSPICIOUS", color: THEME.warn, bg: THEME.warnBg, icon: "⚠", word: "Be careful" },
  dangerous: { label: "DANGEROUS", color: THEME.bad, bg: THEME.badBg, icon: "✕", word: "Dangerous" },
} as const;

export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => <View style={[styles.card, style]}>{children}</View>;

export const H = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <View style={styles.headerContainer}>
    <Text style={styles.headerTitle}>{children}</Text>
    {sub ? <Text style={styles.headerSub}>{sub}</Text> : null}
  </View>
);

export const Btn = ({
  children,
  onPress,
  disabled,
  kind = "primary",
  style,
  textStyle,
  loading,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost" | "danger" | "secondary";
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
}) => {
  const isPrimary = kind === "primary";
  const isDanger = kind === "danger";
  const isGhost = kind === "ghost";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        isPrimary && styles.btnPrimary,
        isDanger && styles.btnDanger,
        isGhost && styles.btnGhost,
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isGhost ? THEME.brand : "#ffffff"} size="small" />
      ) : (
        <Text
          style={[
            styles.btnText,
            isPrimary && styles.btnTextPrimary,
            isDanger && styles.btnTextDanger,
            isGhost && styles.btnTextGhost,
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export const Input = ({
  label,
  style,
  ...props
}: TextInputProps & { label?: string; style?: ViewStyle }) => (
  <View style={styles.inputGroup}>
    {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
    <TextInput
      placeholderTextColor="#64748b"
      style={[styles.input, style]}
      {...props}
    />
  </View>
);

export const Err = ({ msg }: { msg?: string | null }) => {
  if (!msg) return null;
  return (
    <View style={styles.errBox}>
      <Text style={styles.errText}>⚠️ {msg}</Text>
    </View>
  );
};

export const Bar = ({ pct, color }: { pct: number; color: string }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
};

export function Gauge({
  score,
  verdict,
  label = "RISK / 100",
  size = 140,
}: {
  score: number;
  verdict: keyof typeof V;
  label?: string;
  size?: number;
}) {
  const r = 48;
  const stroke = 9;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;
  const hex = V[verdict]?.color || THEME.brand;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={THEME.line}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={hex}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          origin={`${center}, ${center}`}
          rotation="-90"
        />
        <SvgText
          x={center}
          y={center + 6}
          textAnchor="middle"
          fill={THEME.bone}
          fontSize="30"
          fontWeight="bold"
        >
          {String(clamped)}
        </SvgText>
        <SvgText
          x={center}
          y={center + 24}
          textAnchor="middle"
          fill={THEME.dim}
          fontSize="8.5"
          fontWeight="600"
          letterSpacing="1"
        >
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.bone,
    letterSpacing: -0.3,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 13,
    color: THEME.dim,
    lineHeight: 18,
  },
  btn: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnPrimary: {
    backgroundColor: THEME.brand,
    shadowColor: THEME.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDanger: {
    backgroundColor: THEME.badBg,
    borderWidth: 1,
    borderColor: THEME.bad,
  },
  btnGhost: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.cardBorderHighlight,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  btnTextPrimary: {
    color: "#ffffff",
  },
  btnTextDanger: {
    color: THEME.bad,
  },
  btnTextGhost: {
    color: THEME.bone,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.dim,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: THEME.bone,
    fontSize: 14,
  },
  errBox: {
    backgroundColor: THEME.badBg,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  errText: {
    color: THEME.bad,
    fontSize: 13,
  },
  barTrack: {
    height: 7,
    backgroundColor: THEME.line,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
});
