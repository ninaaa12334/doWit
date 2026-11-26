import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { attachProofs, BOOST_MULTIPLIER, completeDaily, CREATE_UNLOCK, completeExtra, currentStreak, dailyChallenge, nextUnlock, PROOF_BONUS, removeExtra, removeProof, sabotageInfo, totalPoints } from "../game";
import { deleteProofFiles, MAX_PROOFS } from "../media";
import { ProofSheet, ProofStrip, ProofViewer } from "../proof";
import { ExtraChallenge, Proof } from "../storage";
import { alpha, colors, IconName, radius, useAccent } from "../theme";
import { Button, Card, Decor, IconBadge, Pill, ProgressBar, Screen, SectionTitle } from "../ui";
import { ScreenProps } from "./types";

export function TodayScreen({ state, today, update, toast, go, social }: ScreenProps) {
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const compact = width < 370;
  const points = totalPoints(state);
  const streak = currentStreak(state, today);
  const daily = dailyChallenge(state, today);
  const unlock = nextUnlock(points);
  const dares = state.extras.filter((e) => e.from && !e.doneAt);
  const mine = state.extras.filter((e) => !e.from && !e.doneAt);
  const pop = useRef(new Animated.Value(1)).current;
  // Which challenge the "Prove it" sheet is open for.
  const [sheet, setSheet] = useState<{ kind: "daily" } | { kind: "extra"; item: ExtraChallenge } | { kind: "attach" } | null>(null);
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const dailyProofs = daily.done?.proofs ?? [];

  useEffect(() => {
    if (!daily.done) return;
    pop.setValue(0.94);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
  }, [daily.done, pop]);

  const finishDaily = (proofs: Proof[]) => {
    const result = completeDaily(state, today, proofs);
    update(result.state);
    setSheet(null);
    social.completed(result.state.completions[result.state.completions.length - 1]);
    toast(`+${result.points} points! ${proofs.length ? "Proof saved 📸" : "Nice work 🎉"}`, "success");
  };

  const finishExtra = (item: ExtraChallenge, proofs: Proof[]) => {
    const result = completeExtra(state, item.id, today, proofs);
    update(result.state);
    setSheet(null);
    social.completed(result.state.completions[result.state.completions.length - 1], item);
    toast(`+${result.points} points from "${item.title}"`, "success");
  };

  const attachToDaily = (proofs: Proof[]) => {
    if (!daily.done) return;
    const result = attachProofs(state, daily.done.id, proofs);
    update(result.state);
    setSheet(null);
    social.proofAdded(daily.done.title, proofs);
    toast(result.bonus ? `Proof saved! +${result.bonus} bonus points 📸` : "Proof saved 📸", "success");
  };

  const deleteDailyProof = (proof: Proof) => {
    if (!daily.done) return;
    update(removeProof(state, daily.done.id, proof.id));
    deleteProofFiles([proof]);
  };

  const sheetTitle = sheet?.kind === "extra" ? sheet.item.title : daily.title;
  const sheetColor = sheet?.kind === "extra" ? sheet.item.color : daily.done ? colors.success : daily.color;

  const deleteExtra = (item: ExtraChallenge) => {
    Alert.alert("Remove challenge?", `"${item.title}" will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => update(removeExtra(state, item.id)) }
    ]);
  };

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const heroColor = daily.done ? colors.success : daily.color;
  const shownPoints = state.boostArmed && !daily.done ? daily.points * BOOST_MULTIPLIER : daily.done?.points ?? daily.points;

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}{state.name ? `, ${state.name}` : ""} 👋</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</Text>
        </View>
        <View style={styles.pills}>
          <Pill icon="flame" label={String(streak)} color="#FF8A3D" />
          <Pill icon="star" label={String(points)} color={colors.gold} onPress={() => go("profile")} />
        </View>
      </View>

      {daily.sabotage && !daily.done ? (
        <View style={[styles.sabotage, { borderColor: alpha(daily.color, 0.5), backgroundColor: alpha(daily.color, 0.12) }]}>
          <Ionicons name="skull" size={22} color={daily.color} />
          <Text style={styles.sabotageText}>
            <Text style={{ fontWeight: "900", color: colors.text }}>{daily.sabotage.from}</Text> hit you with{" "}
            <Text style={{ fontWeight: "900", color: daily.color }}>{sabotageInfo[daily.sabotage.kind].name}</Text>. Beat it for ×{sabotageInfo[daily.sabotage.kind].multiplier} points!
          </Text>
        </View>
      ) : null}

      <Animated.View style={[styles.hero, { backgroundColor: heroColor, transform: [{ scale: pop }] }]}>
        <Decor color={colors.white} />
        <View style={styles.heroTop}>
          <Text style={styles.eyebrow}>{daily.done ? "DONE FOR TODAY" : "TODAY'S CHALLENGE"}</Text>
          <View style={styles.reward}>
            <Ionicons name={state.boostArmed && !daily.done ? "rocket" : "sparkles"} size={14} color={colors.white} />
            <Text style={styles.rewardText}>+{shownPoints} pts</Text>
          </View>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name={(daily.done ? "checkmark" : daily.base.icon.replace("-outline", "")) as IconName} size={40} color={heroColor} />
        </View>
        <Text style={[styles.heroTitle, compact && { fontSize: 25, lineHeight: 30 }]}>{daily.title}</Text>
        <Text style={styles.heroText}>{daily.done ? "You showed up today. Come back tomorrow for a fresh challenge." : daily.description}</Text>
        {daily.done ? (
          <>
            <View style={styles.doneRow}>
              <Ionicons name="checkmark-circle" size={22} color={colors.white} />
              <Text style={styles.doneText}>Completed · +{daily.done.points} points</Text>
            </View>
            {dailyProofs.length > 0 ? (
              <View style={styles.proofs}>
                <Text style={styles.proofLabel}>YOUR PROOF</Text>
                <ProofStrip proofs={dailyProofs} onOpen={setViewerStart} />
              </View>
            ) : null}
            {dailyProofs.length < MAX_PROOFS ? (
              <Button
                label={dailyProofs.length ? "Add more proof" : `Add proof · +${PROOF_BONUS} pts`}
                icon="camera"
                variant="light"
                color={heroColor}
                small
                onPress={() => setSheet({ kind: "attach" })}
                style={{ marginTop: 16, alignSelf: "flex-start" }}
              />
            ) : null}
          </>
        ) : (
          <Button label="I did it!" icon="checkmark-circle" variant="light" color={heroColor} onPress={() => setSheet({ kind: "daily" })} style={{ marginTop: 22 }} />
        )}
      </Animated.View>

      {state.inventory.boosts > 0 || state.boostArmed ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: state.boostArmed }}
          onPress={() => {
            if (state.boostArmed) update({ ...state, boostArmed: false, inventory: { ...state.inventory, boosts: state.inventory.boosts + 1 } });
            else update({ ...state, boostArmed: true, inventory: { ...state.inventory, boosts: state.inventory.boosts - 1 } });
          }}
          style={({ pressed }) => [styles.boost, state.boostArmed && { borderColor: colors.gold, backgroundColor: colors.goldSoft }, pressed && { opacity: 0.85 }]}
        >
          <IconBadge icon="rocket" color={colors.gold} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{state.boostArmed ? "2x Boost is armed" : "Use a 2x Boost"}</Text>
            <Text style={styles.rowSub}>{state.boostArmed ? "Your next completed challenge pays double. Tap to cancel." : `You have ${state.inventory.boosts}. Doubles your next challenge.`}</Text>
          </View>
          <View style={[styles.toggle, state.boostArmed && { backgroundColor: colors.gold }]}>
            <View style={[styles.knob, state.boostArmed && { alignSelf: "flex-end" }]} />
          </View>
        </Pressable>
      ) : null}

      {unlock ? (
        <Card style={styles.unlock}>
          <View style={styles.unlockRow}>
            <IconBadge icon={unlock.icon} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>NEXT UNLOCK</Text>
              <Text style={styles.rowTitle}>{unlock.name}</Text>
            </View>
            <Text style={styles.unlockPts}>{unlock.at - points} pts</Text>
          </View>
          <ProgressBar value={points / unlock.at} />
        </Card>
      ) : null}

      {dares.length > 0 ? (
        <>
          <SectionTitle title="Dares from friends" right={<Text style={styles.count}>{dares.length}</Text>} />
          {dares.map((item) => <ExtraRow key={item.id} item={item} onDone={() => setSheet({ kind: "extra", item })} />)}
        </>
      ) : null}

      <SectionTitle
        title="Your challenges"
        right={
          points >= CREATE_UNLOCK ? (
            <Pressable hitSlop={10} onPress={() => go("create")} style={styles.link}>
              <Ionicons name="add" size={18} color={accent} />
              <Text style={[styles.linkText, { color: accent }]}>New</Text>
            </Pressable>
          ) : null
        }
      />
      {mine.length === 0 ? (
        <Pressable onPress={() => go("create")} style={({ pressed }) => [styles.createPrompt, pressed && { opacity: 0.8 }]}>
          <Ionicons name={points >= CREATE_UNLOCK ? "add-circle" : "lock-closed"} size={24} color={points >= CREATE_UNLOCK ? accent : colors.faint} />
          <Text style={styles.createText}>{points >= CREATE_UNLOCK ? "Create your own challenge" : `Create your own challenges at 100 points`}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      ) : (
        mine.map((item) => <ExtraRow key={item.id} item={item} onDone={() => setSheet({ kind: "extra", item })} onLongPress={() => deleteExtra(item)} />)
      )}

      <ProofSheet
        visible={sheet !== null}
        title={sheetTitle}
        color={sheetColor}
        existing={sheet?.kind === "attach" ? dailyProofs.length : 0}
        bonusAvailable={sheet?.kind === "attach" ? !daily.done?.proofBonus : true}
        allowSkip={sheet?.kind !== "attach"}
        onSkip={() => (sheet?.kind === "extra" ? finishExtra(sheet.item, []) : finishDaily([]))}
        onConfirm={(proofs) => (sheet?.kind === "extra" ? finishExtra(sheet.item, proofs) : sheet?.kind === "attach" ? attachToDaily(proofs) : finishDaily(proofs))}
        onClose={() => setSheet(null)}
        onError={(message) => toast(message, "danger")}
      />
      {viewerStart !== null && dailyProofs.length > 0 ? (
        <ProofViewer proofs={dailyProofs} start={viewerStart} caption={daily.done?.title} onClose={() => setViewerStart(null)} onDelete={deleteDailyProof} />
      ) : null}
    </Screen>
  );
}

function ExtraRow({ item, onDone, onLongPress }: { item: ExtraChallenge; onDone: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400}>
      <Card style={[styles.extra, { borderLeftColor: item.color }]}>
        <IconBadge icon={item.icon as IconName} color={item.color} />
        <View style={{ flex: 1 }}>
          {item.from ? <Text style={[styles.rowLabel, { color: item.color }]}>DARE FROM {item.from.toUpperCase()}</Text> : null}
          <Text style={styles.rowTitle}>{item.title}</Text>
          {item.description ? <Text style={styles.rowSub}>{item.description}</Text> : null}
          <Text style={styles.extraPts}>+{item.points} pts</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Complete ${item.title}`} hitSlop={8} onPress={onDone} style={({ pressed }) => [styles.check, { borderColor: item.color }, pressed && { backgroundColor: alpha(item.color, 0.3) }]}>
          <Ionicons name="checkmark" size={22} color={item.color} />
        </Pressable>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  greeting: { color: colors.text, fontSize: 22, fontWeight: "900" },
  date: { color: colors.muted, fontSize: 14, marginTop: 3 },
  pills: { flexDirection: "row", gap: 8 },
  sabotage: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.md, padding: 14, marginBottom: 14 },
  sabotageText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 20 },
  hero: { borderRadius: 30, padding: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  reward: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, height: 28, borderRadius: 14 },
  rewardText: { color: colors.white, fontSize: 13, fontWeight: "900" },
  heroIcon: { width: 76, height: 76, borderRadius: 26, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginTop: 22, marginBottom: 18 },
  heroTitle: { color: colors.white, fontSize: 29, lineHeight: 34, fontWeight: "900", letterSpacing: -0.5 },
  heroText: { color: "rgba(255,255,255,0.9)", fontSize: 16, lineHeight: 24, marginTop: 10 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, backgroundColor: "rgba(0,0,0,0.16)", alignSelf: "flex-start", paddingHorizontal: 14, height: 44, borderRadius: 22 },
  doneText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  proofs: { marginTop: 18, gap: 8 },
  proofLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  boost: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  unlock: { marginTop: 14, gap: 14 },
  unlockRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  unlockPts: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  rowLabel: { color: colors.faint, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  rowSub: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  count: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 15, fontWeight: "800" },
  createPrompt: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border },
  createText: { flex: 1, color: colors.muted, fontSize: 15, fontWeight: "700" },
  extra: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderLeftWidth: 4, padding: 14 },
  extraPts: { color: colors.gold, fontSize: 13, fontWeight: "800", marginTop: 6 },
  check: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: "center", justifyContent: "center" }
});
