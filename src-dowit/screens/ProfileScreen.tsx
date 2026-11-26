import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { allProofs, attachProofs, CREATE_UNLOCK, currentStreak, levelInfo, PROOF_BONUS, removeProof, SABOTAGE_UNLOCK, totalPoints } from "../game";
import { deleteProofFiles } from "../media";
import { ProofSheet, ProofThumb, ProofViewer } from "../proof";
import { Completion, Proof } from "../storage";
import { alpha, colors, IconName, radius, ThemeId, themes, useAccent } from "../theme";
import { Button, Card, Decor, Empty, IconBadge, ProgressBar, Screen, SectionTitle } from "../ui";
import { ScreenProps } from "./types";

export function ProfileScreen({ state, today, update, toast, social }: ScreenProps) {
  const accent = useAccent();
  const points = totalPoints(state);
  const level = levelInfo(points);
  const streak = currentStreak(state, today);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(state.name);
  const daresDone = state.completions.filter((c) => c.source === "dare").length;
  const wall = allProofs(state);
  const [attachTo, setAttachTo] = useState<Completion | null>(null);
  // The viewer shows every proof on the wall, starting from the one tapped.
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  const openProof = (proofId: string) => setViewerStart(Math.max(0, wall.findIndex((w) => w.proof.id === proofId)));

  const saveProofs = (proofs: Proof[]) => {
    if (!attachTo) return;
    const result = attachProofs(state, attachTo.id, proofs);
    update(result.state);
    setAttachTo(null);
    social.proofAdded(attachTo.title, proofs);
    toast(result.bonus ? `Proof saved! +${result.bonus} bonus points 📸` : "Proof saved 📸", "success");
  };

  const deleteProof = (proof: Proof) => {
    const owner = wall.find((w) => w.proof.id === proof.id)?.completion;
    if (!owner) return;
    update(removeProof(state, owner.id, proof.id));
    deleteProofFiles([proof]);
  };

  const saveName = () => {
    const clean = name.trim();
    if (clean.length < 2) return;
    update({ ...state, name: clean });
    setEditing(false);
    toast("Name updated", "success");
  };

  const milestones: { at: number; icon: IconName; title: string; text: string }[] = [
    { at: 0, icon: "sunny", title: "Daily challenges", text: "A fresh challenge every day" },
    { at: CREATE_UNLOCK, icon: "construct", title: "Challenge maker", text: "Create challenges and dare friends" },
    { at: SABOTAGE_UNLOCK, icon: "skull", title: "Saboteur", text: "Double or Hard Mode your friends" }
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={[styles.hero, { backgroundColor: alpha(accent, 0.18), borderColor: alpha(accent, 0.4) }]}>
          <Decor color={accent} />
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={styles.avatarText}>{(state.name || "?").slice(0, 1).toUpperCase()}</Text>
            <View style={styles.levelBadge}><Text style={styles.levelBadgeText}>{level.level}</Text></View>
          </View>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput value={name} onChangeText={setName} maxLength={20} autoFocus style={styles.nameInput} onSubmitEditing={saveName} returnKeyType="done" placeholderTextColor={colors.faint} placeholder="Your name" />
              <Button label="Save" small onPress={saveName} disabled={name.trim().length < 2} />
            </View>
          ) : (
            <Pressable onPress={() => { setName(state.name); setEditing(true); }} hitSlop={8} style={styles.nameRow}>
              <Text style={styles.name}>{state.name || "Set your name"}</Text>
              <Ionicons name="pencil" size={16} color={colors.muted} />
            </Pressable>
          )}
          {state.title ? <Text style={[styles.titleTag, { color: accent }]}>{state.title}</Text> : null}
          <View style={styles.levelWrap}>
            <View style={styles.levelRow}>
              <Text style={styles.levelText}>Level {level.level}</Text>
              <Text style={styles.levelNext}>{level.toNext} pts to level {level.level + 1}</Text>
            </View>
            <ProgressBar value={level.progress} />
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon="star" color={colors.gold} value={points} label="Points" />
          <Stat icon="flame" color="#FF8A3D" value={streak} label="Day streak" />
          <Stat icon="checkmark-done" color={colors.success} value={state.completions.length} label="Completed" />
          <Stat icon="flash" color="#22B8F0" value={daresDone} label="Dares done" />
        </View>

        <SectionTitle title="Proof wall" right={wall.length ? <Text style={styles.wallCount}>{wall.length}</Text> : null} />
        {wall.length === 0 ? (
          <Empty icon="camera-outline" title="No proof yet" text={`Add a photo or video when you finish a challenge. Each one earns +${PROOF_BONUS} bonus points.`} />
        ) : (
          <View style={styles.wall}>
            {wall.slice(0, 9).map(({ proof }) => (
              <View key={proof.id} style={styles.wallCell}>
                <ProofThumb proof={proof} size="fill" onPress={() => openProof(proof.id)} />
              </View>
            ))}
          </View>
        )}

        {social.configured ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: state.shareProofs }}
            onPress={() => update({ ...state, shareProofs: !state.shareProofs })}
            style={styles.shareRow}
          >
            <Ionicons name="people" size={20} color={accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.mTitle}>Share new proof with friends</Text>
              <Text style={styles.mText}>Friends see your photos and videos in their feed.</Text>
            </View>
            <View style={[styles.toggle, state.shareProofs && { backgroundColor: accent }]}>
              <View style={[styles.knob, state.shareProofs && { alignSelf: "flex-end" }]} />
            </View>
          </Pressable>
        ) : null}

        <SectionTitle title="Unlocks" />
        <Card style={{ paddingVertical: 6 }}>
          {milestones.map((m, index) => {
            const open = points >= m.at;
            return (
              <View key={m.title} style={[styles.milestone, index > 0 && styles.divider]}>
                <IconBadge icon={open ? m.icon : "lock-closed"} color={open ? accent : colors.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mTitle, !open && { color: colors.muted }]}>{m.title}</Text>
                  <Text style={styles.mText}>{m.text}</Text>
                </View>
                <Text style={[styles.mPts, open && { color: colors.success }]}>{open ? "Unlocked" : `${m.at} pts`}</Text>
              </View>
            );
          })}
        </Card>

        <SectionTitle title="Theme" />
        <View style={styles.themes}>
          {(Object.keys(themes) as ThemeId[]).map((id) => {
            const owned = state.themes.includes(id);
            const active = state.theme === id;
            return (
              <Pressable
                key={id}
                accessibilityLabel={`${themes[id].name} theme${owned ? "" : ", locked"}`}
                onPress={() => (owned ? update({ ...state, theme: id }) : toast("Earn this theme in the Royal Pass", "gold"))}
                style={[styles.theme, active && { borderColor: themes[id].accent }]}
              >
                <View style={[styles.themeDot, { backgroundColor: themes[id].accent }, !owned && { opacity: 0.3 }]}>
                  {!owned ? <Ionicons name="lock-closed" size={14} color={colors.white} /> : active ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
                </View>
                <Text style={styles.themeName} numberOfLines={1}>{themes[id].name}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Titles" />
        {state.titles.length === 0 ? (
          <Empty icon="ribbon-outline" title="No titles yet" text="Climb the Royal Pass to earn titles to show off." />
        ) : (
          <View style={styles.chips}>
            {state.titles.map((t) => {
              const active = state.title === t;
              return (
                <Pressable key={t} onPress={() => update({ ...state, title: active ? null : t })} style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}>
                  <Ionicons name="ribbon" size={14} color={active ? colors.white : colors.muted} />
                  <Text style={[styles.chipText, active && { color: colors.white }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionTitle title="Recent wins" />
        {state.completions.length === 0 ? (
          <Empty icon="flag-outline" title="Your first win is waiting" text="Finish today's challenge and it will appear here." />
        ) : (
          <Card style={{ paddingVertical: 6 }}>
            {[...state.completions].reverse().slice(0, 8).map((c, index) => (
              <View key={c.id} style={[styles.milestone, index > 0 && styles.divider]}>
                <IconBadge icon="checkmark" color={c.color} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mTitle} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.mText}>{new Date(`${c.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {c.source === "daily" ? "Daily" : c.source === "dare" ? "Dare" : "My challenge"}</Text>
                </View>
                {c.proofs?.length ? (
                  <ProofThumb proof={c.proofs[0]} size={40} onPress={() => openProof(c.proofs![0].id)} />
                ) : (
                  <Pressable accessibilityLabel={`Add proof to ${c.title}`} hitSlop={8} onPress={() => setAttachTo(c)} style={styles.addProof}>
                    <Ionicons name="camera-outline" size={18} color={accent} />
                  </Pressable>
                )}
                <Text style={styles.win}>+{c.points}</Text>
              </View>
            ))}
          </Card>
        )}

        <ProofSheet
          visible={attachTo !== null}
          title={attachTo?.title ?? ""}
          color={attachTo?.color ?? accent}
          existing={attachTo?.proofs?.length ?? 0}
          bonusAvailable={!attachTo?.proofBonus}
          allowSkip={false}
          onConfirm={saveProofs}
          onClose={() => setAttachTo(null)}
          onError={(message) => toast(message, "danger")}
        />
        {viewerStart !== null && wall.length > 0 ? (
          <ProofViewer
            proofs={wall.map((w) => w.proof)}
            start={Math.min(viewerStart, wall.length - 1)}
            caption={wall[Math.min(viewerStart, wall.length - 1)]?.completion.title}
            onClose={() => setViewerStart(null)}
            onDelete={deleteProof}
          />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Stat({ icon, color, value, label }: { icon: IconName; color: string; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", borderRadius: 30, borderWidth: 1, padding: 24, overflow: "hidden" },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: colors.bg },
  avatarText: { color: colors.white, fontSize: 38, fontWeight: "900" },
  levelBadge: { position: "absolute", bottom: -6, right: -6, minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 6, backgroundColor: colors.gold, borderWidth: 3, borderColor: colors.bg, alignItems: "center", justifyContent: "center" },
  levelBadgeText: { color: "#2A1D00", fontSize: 13, fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  name: { color: colors.text, fontSize: 24, fontWeight: "900" },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, alignSelf: "stretch" },
  nameInput: { flex: 1, backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 44, fontSize: 16 },
  titleTag: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5, marginTop: 4 },
  levelWrap: { alignSelf: "stretch", marginTop: 20, gap: 8 },
  levelRow: { flexDirection: "row", justifyContent: "space-between" },
  levelText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  levelNext: { color: colors.muted, fontSize: 13 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  stat: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 4 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
  statLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  milestone: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  mTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  mText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  mPts: { color: colors.faint, fontSize: 13, fontWeight: "800" },
  win: { color: colors.gold, fontSize: 15, fontWeight: "900", minWidth: 36, textAlign: "right" },
  addProof: { width: 40, height: 40, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  wallCount: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  wall: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wallCell: { width: "31.8%", aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  themes: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  theme: { flexGrow: 1, flexBasis: "28%", alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  themeDot: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  themeName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 14, fontWeight: "700" }
});
