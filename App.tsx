import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { getLocalDateKey } from "./src-dowit/challenges";
import { claimableCount, sabotageInfo } from "./src-dowit/game";
import { CreateScreen } from "./src-dowit/screens/CreateScreen";
import { FriendsScreen } from "./src-dowit/screens/FriendsScreen";
import { PassScreen } from "./src-dowit/screens/PassScreen";
import { ProfileScreen } from "./src-dowit/screens/ProfileScreen";
import { TodayScreen } from "./src-dowit/screens/TodayScreen";
import { ScreenProps, Tab, ToastTone } from "./src-dowit/screens/types";
import { useSocial } from "./src-dowit/social";
import { loadState, saveState, State } from "./src-dowit/storage";
import { AccentContext, alpha, colors, IconName, radius, themes } from "./src-dowit/theme";
import { Button, Decor } from "./src-dowit/ui";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

const TABS: { id: Tab; label: string; icon: IconName; iconOff: IconName }[] = [
  { id: "today", label: "Today", icon: "home", iconOff: "home-outline" },
  { id: "create", label: "Create", icon: "add-circle", iconOff: "add-circle-outline" },
  { id: "friends", label: "Friends", icon: "people", iconOff: "people-outline" },
  { id: "pass", label: "Pass", icon: "diamond", iconOff: "diamond-outline" },
  { id: "profile", label: "Me", icon: "person", iconOff: "person-outline" }
];

const TONE_COLOR: Record<ToastTone, string> = { success: colors.success, info: "#22B8F0", danger: colors.danger, gold: colors.gold };
const TONE_ICON: Record<ToastTone, IconName> = { success: "checkmark-circle", info: "information-circle", danger: sabotageInfo.hard.icon, gold: "diamond" };

function Root() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("today");
  const [dareFor, setDareFor] = useState<string | null>(null);
  const [today, setToday] = useState(getLocalDateKey());
  const [toastData, setToastData] = useState<{ message: string; tone: ToastTone } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current copy of state for async work (server sync) that outlives a render.
  const stateRef = useRef<State | null>(null);

  useEffect(() => {
    loadState().then((loaded) => {
      stateRef.current = loaded;
      setState(loaded);
    });
  }, []);

  // Pick up the new day if the app stays open past midnight.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") setToday(getLocalDateKey());
    });
    const timer = setInterval(() => setToday(getLocalDateKey()), 60000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const update = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
    saveState(next).catch(() => undefined);
  }, []);
  const getState = useCallback(() => stateRef.current, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastData({ message, tone });
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastData(null));
      }, 2800);
    },
    [toastAnim]
  );

  const social = useSocial({ state, getState, update, toast, today });

  if (!state) {
    return (
      <View style={[styles.app, styles.center]}>
        <ActivityIndicator size="large" color={themes.violet.accent} />
      </View>
    );
  }

  const accent = themes[state.theme]?.accent ?? themes.violet.accent;

  if (!state.onboarded) {
    return (
      <AccentContext.Provider value={accent}>
        <Welcome
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          initialName={state.name}
          returning={state.completions.length > 0}
          onDone={(name) => update({ ...state, name, onboarded: true })}
        />
      </AccentContext.Provider>
    );
  }

  const props: ScreenProps = { state, today, update, toast, go: setTab, social, dareFor, setDareFor };
  const passBadge = claimableCount(state, today);
  const friendsBadge = social.requests.filter((r) => r.incoming).length;

  return (
    <AccentContext.Provider value={accent}>
      <View style={[styles.app, { paddingTop: insets.top }]}>
        <View style={styles.body}>
          {tab === "today" && <TodayScreen {...props} />}
          {tab === "create" && <CreateScreen {...props} />}
          {tab === "friends" && <FriendsScreen {...props} />}
          {tab === "pass" && <PassScreen {...props} />}
          {tab === "profile" && <ProfileScreen {...props} />}
        </View>

        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.id)}
                style={styles.tab}
              >
                <View style={[styles.tabIcon, active && { backgroundColor: alpha(accent, 0.18) }]}>
                  <Ionicons name={active ? item.icon : item.iconOff} size={23} color={active ? accent : colors.faint} />
                  {item.id === "pass" && passBadge > 0 ? (
                    <View style={styles.badge}><Text style={styles.badgeText}>{passBadge > 9 ? "9+" : passBadge}</Text></View>
                  ) : null}
                  {item.id === "friends" && friendsBadge > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.danger }]}><Text style={[styles.badgeText, { color: colors.white }]}>{friendsBadge}</Text></View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, active && { color: accent }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {toastData ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.toast,
              { top: insets.top + 8, borderColor: alpha(TONE_COLOR[toastData.tone], 0.5) },
              { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] }
            ]}
          >
            <Ionicons name={TONE_ICON[toastData.tone]} size={22} color={TONE_COLOR[toastData.tone]} />
            <Text style={styles.toastText}>{toastData.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </AccentContext.Provider>
  );
}

function Welcome({ insetsTop, insetsBottom, initialName, returning, onDone }: { insetsTop: number; insetsBottom: number; initialName: string; returning: boolean; onDone: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const valid = name.trim().length >= 2;
  return (
    <KeyboardAvoidingView style={[styles.app, { paddingTop: insetsTop + 20, paddingBottom: insetsBottom + 20 }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.welcome}>
        <View style={styles.logoWrap}>
          <Decor color={themes.violet.accent} strong />
          <View style={styles.logo}><Ionicons name="flash" size={54} color={colors.white} /></View>
        </View>
        <Text style={styles.welcomeTitle}>{returning ? "Dowit got an upgrade" : "Welcome to Dowit"}</Text>
        <Text style={styles.welcomeText}>One challenge a day. Earn points, unlock your own challenges at 100, sabotage friends at 1000, and climb the Royal Pass.</Text>
        <View style={styles.features}>
          {[
            ["sunny", "Daily challenges"],
            ["construct", "Create & dare"],
            ["skull", "Sabotage"],
            ["diamond", "Royal Pass"]
          ].map(([icon, label]) => (
            <View key={label} style={styles.feature}>
              <Ionicons name={icon as IconName} size={18} color={themes.violet.accent} />
              <Text style={styles.featureText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.welcomeForm}>
        <Text style={styles.inputLabel}>What should friends call you?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="Your name"
          placeholderTextColor={colors.faint}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => valid && onDone(name.trim())}
        />
        <Button label="Let's go" icon="arrow-forward" onPress={() => onDone(name.trim())} disabled={!valid} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1 },
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: "center", gap: 3, minHeight: 52 },
  tabIcon: { width: 52, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tabLabel: { color: colors.faint, fontSize: 11, fontWeight: "800" },
  badge: { position: "absolute", top: -3, right: 6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#2A1D00", fontSize: 10, fontWeight: "900" },
  toast: { position: "absolute", left: 16, right: 16, alignSelf: "center", maxWidth: 520, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  toastText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  welcome: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  logoWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", borderRadius: 80, overflow: "hidden" },
  logo: { width: 100, height: 100, borderRadius: 34, backgroundColor: themes.violet.accent, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
  welcomeTitle: { color: colors.text, fontSize: 32, fontWeight: "900", textAlign: "center", marginTop: 20, letterSpacing: -0.5 },
  welcomeText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center", marginTop: 12, maxWidth: 420 },
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22 },
  feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, height: 36 },
  featureText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  welcomeForm: { paddingHorizontal: 24, gap: 12, width: "100%", maxWidth: 560, alignSelf: "center" },
  inputLabel: { color: colors.text, fontSize: 15, fontWeight: "800" },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 56, fontSize: 17 }
});
