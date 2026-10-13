import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { initStorage, TokenStore } from "./src/api";
import { initOfflineDb } from "./src/offline/engine";
import { Go, Page, THEME } from "./src/ui";
import * as P from "./src/pages";
import * as S from "./src/screens";

const BOTTOM_TABS: ([Page, string, string] | "SCAN")[] = [
  ["home", "🏠", "Home"],
  ["history", "🕘", "History"],
  "SCAN",
  ["analytics", "📊", "Stats"],
  ["profile", "👤", "Me"],
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState<Page>("home");
  const [arg, setArg] = useState<any>(undefined);

  useEffect(() => {
    (async () => {
      await Promise.all([initStorage(), initOfflineDb()]);
      const existingUser = TokenStore.user();
      if (existingUser) setUser(existingUser);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={appStyles.splash}>
        <StatusBar style="light" />
        <Text style={{ fontSize: 50, marginBottom: 12 }}>🛡️</Text>
        <Text style={appStyles.splashTitle}>
          Cyber<Text style={{ color: THEME.brand }}>Shield</Text> AI
        </Text>
        <ActivityIndicator color={THEME.brand} style={{ marginTop: 20 }} size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
        <StatusBar style="light" />
        <P.AuthScreen onAuth={setUser} />
      </SafeAreaView>
    );
  }

  const go: Go = (p, a) => {
    setPage(p);
    setArg(a);
  };

  const logout = () => {
    TokenStore.clear();
    setUser(null);
    setPage("home");
  };

  const isMainTab = ["home", "history", "analytics", "profile"].includes(page);
  const activeBottomTab: Page = page === "result" ? "scan" : page;

  const view = (
    {
      home: <S.Dashboard go={go} user={user} />,
      scan: <S.ScanHub go={go} tab={arg} />,
      result: <S.ResultScreen arg={arg} go={go} />,
      analytics: <S.Analytics />,
      history: <S.History go={go} />,
      assistant: <P.Assistant scanId={typeof arg === "number" ? arg : undefined} />,
      hub: <P.CyberHub />,
      report: <P.ReportPage />,
      security: <S.SecurityCenter />,
      score: <P.Score />,
      profile: <S.Profile user={user} onUser={setUser} go={go} onLogout={logout} />,
      settings: <S.Settings />,
    } as Record<Page, JSX.Element>
  )[page];

  return (
    <SafeAreaView style={appStyles.root}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={appStyles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {!isMainTab && (
            <TouchableOpacity onPress={() => go("home")} style={appStyles.backBtn}>
              <Text style={{ color: THEME.bone, fontSize: 16, fontWeight: "700" }}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={appStyles.brandTitle}>
            🛡️ Cyber<Text style={{ color: THEME.brand }}>Shield</Text>
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => go("profile")}
          style={appStyles.userBadge}
          activeOpacity={0.8}
        >
          <Text style={appStyles.userBadgeText}>
            {user?.name ? user.name[0]?.toUpperCase() : "U"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <KeyboardAvoidingView
        style={appStyles.main}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {view}
      </KeyboardAvoidingView>

      {/* Bottom Floating Navigation Bar */}
      <View style={appStyles.bottomNav}>
        {BOTTOM_TABS.map((tab, idx) => {
          if (tab === "SCAN") {
            const isScanActive = activeBottomTab === "scan";
            return (
              <TouchableOpacity
                key="scan"
                onPress={() => go("scan")}
                activeOpacity={0.8}
                style={appStyles.centerScanBtnWrap}
              >
                <View
                  style={[
                    appStyles.centerScanCircle,
                    isScanActive && appStyles.centerScanCircleActive,
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>🔍</Text>
                </View>
                <Text
                  style={[
                    appStyles.tabLabel,
                    { marginTop: 4, color: isScanActive ? THEME.brand : THEME.dim },
                  ]}
                >
                  Scan
                </Text>
              </TouchableOpacity>
            );
          }

          const [pageId, icon, label] = tab;
          const isActive = activeBottomTab === pageId;
          return (
            <TouchableOpacity
              key={pageId}
              onPress={() => go(pageId)}
              activeOpacity={0.7}
              style={appStyles.tabItem}
            >
              <Text style={{ fontSize: 20 }}>{icon}</Text>
              <Text style={[appStyles.tabLabel, isActive && appStyles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const appStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  splash: {
    flex: 1,
    backgroundColor: THEME.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: THEME.bone,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    backgroundColor: THEME.bg,
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: THEME.bone,
  },
  userBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  userBadgeText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingTop: 8,
    paddingBottom: 16,
    alignItems: "flex-end",
    justifyContent: "space-around",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.dim,
    marginTop: 2,
  },
  tabLabelActive: {
    color: THEME.brand,
    fontWeight: "800",
  },
  centerScanBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    marginTop: -22,
  },
  centerScanCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: THEME.bg,
    shadowColor: THEME.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  centerScanCircleActive: {
    backgroundColor: "#1d61d1",
    transform: [{ scale: 1.05 }],
  },
});
