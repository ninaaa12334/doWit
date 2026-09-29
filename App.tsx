import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { getChallengeForDate, getLocalDateKey } from "./src-dowit/challenges";
import { emptyProgress, loadProgress, Progress, saveProgress } from "./src-dowit/storage";

type Screen = "home" | "progress";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [loading, setLoading] = useState(true);
  const todayKey = getLocalDateKey();
  const challenge = useMemo(() => getChallengeForDate(todayKey), [todayKey]);
  const isCompleted = progress.completedDates.includes(todayKey);

  useEffect(() => {
    loadProgress().then((saved) => {
      setProgress(saved);
      setLoading(false);
    });
  }, []);

  const completeChallenge = async () => {
    if (isCompleted) return;
    const next = {
      totalPoints: progress.totalPoints + challenge.points,
      completedDates: [...progress.completedDates, todayKey]
    };
    setProgress(next);
    await saveProgress(next);
  };

  if (loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color="#6C5CE7" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {screen === "home" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Dowit</Text>
              <Text style={styles.muted}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
            </View>
            <View style={styles.pointsPill}>
              <Ionicons name="star" size={17} color="#F2B705" />
              <Text style={styles.pointsPillText}>{progress.totalPoints}</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>TODAY'S CHALLENGE</Text>
          <Text style={styles.heading}>One small win.{"\n"}Let's make it happen.</Text>

          <View style={[styles.challengeCard, { borderTopColor: challenge.color }]}>
            <View style={[styles.iconCircle, { backgroundColor: `${challenge.color}18` }]}>
              <Ionicons name={challenge.icon as keyof typeof Ionicons.glyphMap} size={34} color={challenge.color} />
            </View>
            <Text style={styles.challengeTitle}>{challenge.title}</Text>
            <Text style={styles.description}>{challenge.description}</Text>
            <View style={styles.rewardRow}>
              <Ionicons name="sparkles" size={18} color="#F2B705" />
              <Text style={styles.rewardText}>Worth {challenge.points} points</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isCompleted ? "Challenge completed" : "Complete today's challenge"}
              disabled={isCompleted}
              onPress={completeChallenge}
              style={({ pressed }) => [styles.doneButton, isCompleted && styles.completedButton, pressed && !isCompleted && styles.pressed]}
            >
              <Ionicons name={isCompleted ? "checkmark-circle" : "checkmark"} size={23} color="#FFFFFF" />
              <Text style={styles.doneText}>{isCompleted ? "Completed today" : "Done"}</Text>
            </Pressable>
          </View>

          <View style={styles.note}>
            <Ionicons name="sunny-outline" size={21} color="#EF8354" />
            <Text style={styles.noteText}>Come back tomorrow for a fresh challenge.</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>Your progress</Text>
              <Text style={styles.muted}>Every completed challenge counts.</Text>
            </View>
          </View>
          <View style={styles.progressHero}>
            <View style={styles.trophyCircle}><Ionicons name="trophy" size={42} color="#F2B705" /></View>
            <Text style={styles.bigPoints}>{progress.totalPoints}</Text>
            <Text style={styles.bigLabel}>TOTAL POINTS</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat icon="checkmark-done" color="#00A896" value={String(progress.completedDates.length)} label="Challenges done" />
            <Stat icon="calendar-outline" color="#6C5CE7" value={isCompleted ? "Yes" : "Not yet"} label="Completed today" />
          </View>
          <Text style={styles.sectionTitle}>Recent wins</Text>
          {progress.completedDates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={30} color="#8E92A4" />
              <Text style={styles.emptyTitle}>Your first win is waiting</Text>
              <Text style={styles.emptyText}>Finish today's challenge and it will appear here.</Text>
            </View>
          ) : (
            [...progress.completedDates].reverse().slice(0, 5).map((dateKey) => {
              const item = getChallengeForDate(dateKey);
              return (
                <View key={dateKey} style={styles.historyRow}>
                  <View style={[styles.smallIcon, { backgroundColor: `${item.color}18` }]}><Ionicons name="checkmark" size={20} color={item.color} /></View>
                  <View style={styles.historyText}>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyDate}>{new Date(`${dateKey}T12:00:00`).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.historyPoints}>+{item.points}</Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={styles.tabBar}>
        <TabButton label="Today" icon="home" active={screen === "home"} onPress={() => setScreen("home")} />
        <TabButton label="Progress" icon="stats-chart" active={screen === "progress"} onPress={() => setScreen("progress")} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  return <View style={styles.statBox}><Ionicons name={icon} size={26} color={color} /><Text style={styles.statNumber}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function TabButton({ label, icon, active, onPress }: { label: string; icon: "home" | "stats-chart"; active: boolean; onPress: () => void }) {
  const shownIcon = active ? icon : `${icon}-outline` as keyof typeof Ionicons.glyphMap;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={styles.tabButton}>
      <Ionicons name={shownIcon} size={23} color={active ? "#6C5CE7" : "#8E92A4"} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7FB", paddingTop: Platform.OS === "android" ? 28 : 0 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F7FB" },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 110 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 34 },
  brand: { color: "#22233A", fontSize: 27, fontWeight: "800" },
  muted: { color: "#777B8E", fontSize: 14, marginTop: 5 },
  pointsPill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FFFFFF", paddingHorizontal: 14, height: 40, borderRadius: 20 },
  pointsPillText: { color: "#22233A", fontSize: 16, fontWeight: "800" },
  eyebrow: { color: "#6C5CE7", fontSize: 12, fontWeight: "800" },
  heading: { color: "#22233A", fontSize: 31, lineHeight: 39, fontWeight: "800", marginTop: 9, marginBottom: 24 },
  challengeCard: { backgroundColor: "#FFFFFF", borderRadius: 8, borderTopWidth: 5, padding: 24, shadowColor: "#15162A", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  iconCircle: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  challengeTitle: { color: "#22233A", fontSize: 24, lineHeight: 31, fontWeight: "800" },
  description: { color: "#686C7E", fontSize: 16, lineHeight: 24, marginTop: 11 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20 },
  rewardText: { color: "#5D6072", fontSize: 14, fontWeight: "700" },
  doneButton: { height: 56, borderRadius: 8, backgroundColor: "#6C5CE7", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, marginTop: 25 },
  completedButton: { backgroundColor: "#00A896" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  doneText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  note: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 23 },
  noteText: { color: "#777B8E", fontSize: 13 },
  progressHero: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, paddingVertical: 30, marginBottom: 18 },
  trophyCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF7D6" },
  bigPoints: { color: "#22233A", fontSize: 48, fontWeight: "800", marginTop: 12 },
  bigLabel: { color: "#8E92A4", fontSize: 12, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: { flex: 1, minHeight: 132, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 17 },
  statNumber: { color: "#22233A", fontSize: 22, fontWeight: "800", marginTop: 11 },
  statLabel: { color: "#777B8E", fontSize: 13, lineHeight: 18, marginTop: 3 },
  sectionTitle: { color: "#22233A", fontSize: 19, fontWeight: "800", marginTop: 28, marginBottom: 13 },
  emptyState: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, padding: 25 },
  emptyTitle: { color: "#22233A", fontSize: 16, fontWeight: "800", marginTop: 10 },
  emptyText: { color: "#777B8E", textAlign: "center", lineHeight: 20, marginTop: 5 },
  historyRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 8, padding: 14, marginBottom: 9 },
  smallIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  historyText: { flex: 1, marginHorizontal: 12 },
  historyTitle: { color: "#22233A", fontSize: 14, fontWeight: "700" },
  historyDate: { color: "#8E92A4", fontSize: 12, marginTop: 3 },
  historyPoints: { color: "#00A896", fontSize: 14, fontWeight: "800" },
  tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: Platform.OS === "ios" ? 86 : 72, paddingBottom: Platform.OS === "ios" ? 18 : 5, flexDirection: "row", backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E9EAF1" },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  tabLabel: { color: "#8E92A4", fontSize: 12, fontWeight: "700" },
  tabLabelActive: { color: "#6C5CE7" }
});
