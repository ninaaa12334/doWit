import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";

import { addSelfChallenge, buildDare, CREATE_UNLOCK, DARE_POINT_OPTIONS, recordDareSent, SELF_CHALLENGE_POINTS, SELF_CHALLENGES_PER_DAY, selfChallengesLeft, totalPoints } from "../game";
import { alpha, colors, IconName, radius, useAccent } from "../theme";
import { Button, Card, Decor, Header, Locked, Screen } from "../ui";
import { ScreenProps } from "./types";

const ICONS: IconName[] = ["barbell", "book", "bicycle", "musical-notes", "restaurant", "water", "camera", "code-slash", "leaf", "happy", "moon", "trophy"];
const SWATCHES = ["#7C5CFF", "#22B8F0", "#2BD67B", "#F5B83D", "#FF8A3D", "#FF4F8B", "#9B5DE5", "#14B8A6"];

export function CreateScreen({ state, today, update, toast, go, social, dareFor, setDareFor }: ScreenProps) {
  const accent = useAccent();
  const points = totalPoints(state);
  const [mode, setMode] = useState<"self" | "dare">(dareFor ? "dare" : "self");
  // Friend to send the dare to; null means "share as a code".
  const [recipient, setRecipient] = useState<string | null>(dareFor);
  const online = social.status === "ready" && social.friends.length > 0;

  useEffect(() => {
    if (!dareFor) return;
    setMode("dare");
    setRecipient(dareFor);
    setDareFor(null);
  }, [dareFor, setDareFor]);

  useEffect(() => {
    // Default to the first friend once the list loads.
    if (online && recipient === null && mode === "dare" && social.friends[0]) setRecipient(social.friends[0].id);
  }, [online, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<IconName>("barbell");
  const [color, setColor] = useState(SWATCHES[0]);
  const [darePoints, setDarePoints] = useState(25);
  const [sending, setSending] = useState(false);

  if (points < CREATE_UNLOCK) {
    return (
      <Screen>
        <Header title="Create" subtitle="Design challenges for you and your friends." />
        <Locked
          icon="construct"
          title="Become a challenge maker"
          text="Reach 100 points to design your own challenges and dare your friends to do them."
          required={CREATE_UNLOCK}
          current={points}
        />
        <Button label="Go to today's challenge" icon="arrow-forward" variant="ghost" onPress={() => go("today")} style={{ marginTop: 14 }} />
      </Screen>
    );
  }

  const cleanTitle = title.trim();
  const selfLeft = selfChallengesLeft(state, today);
  const valid = cleanTitle.length >= 3 && (mode === "dare" || selfLeft > 0);
  const reward = mode === "self" ? SELF_CHALLENGE_POINTS : darePoints;

  const reset = () => {
    setTitle("");
    setDescription("");
  };

  const submit = async () => {
    if (!valid) return;
    const input = { title: cleanTitle, description: description.trim(), icon, color };
    if (mode === "self") {
      update(addSelfChallenge(state, input));
      toast("Challenge added to your Today list", "success");
      reset();
      go("today");
      return;
    }
    const friend = social.friends.find((f) => f.id === recipient);
    if (friend) {
      setSending(true);
      const ok = await social.sendDare(friend, { ...input, points: darePoints });
      setSending(false);
      if (ok) reset();
      return;
    }
    setSending(true);
    try {
      const code = buildDare(state, { ...input, points: darePoints });
      const result = await Share.share({
        message: `🔥 ${state.name || "A friend"} dared you on Dowit: "${cleanTitle}" (+${darePoints} pts)\n\nOpen Dowit → Friends → Redeem a code, and paste this:\n${code}`
      });
      if (result.action !== Share.dismissedAction) {
        update(recordDareSent(state, cleanTitle));
        toast("Dare sent! 😈", "info");
        reset();
      }
    } catch {
      toast("Couldn't open sharing. Try again.", "danger");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title="Create" subtitle="Make a challenge for yourself or dare a friend." />

        <View style={styles.segment}>
          {(["self", "dare"] as const).map((value) => {
            const active = mode === value;
            return (
              <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setMode(value)} style={[styles.segmentItem, active && { backgroundColor: accent }]}>
                <Ionicons name={value === "self" ? "person" : "paper-plane"} size={16} color={active ? colors.white : colors.muted} />
                <Text style={[styles.segmentText, active && { color: colors.white }]}>{value === "self" ? "For me" : "Dare a friend"}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Live preview */}
        <View style={[styles.preview, { backgroundColor: color }]}>
          <Decor color={colors.white} />
          <View style={styles.previewTop}>
            <Text style={styles.previewLabel}>{mode === "self" ? "MY CHALLENGE" : `DARE FROM ${(state.name || "YOU").toUpperCase()}`}</Text>
            <Text style={styles.previewPts}>+{reward} pts</Text>
          </View>
          <View style={styles.previewIcon}><Ionicons name={icon} size={30} color={color} /></View>
          <Text style={styles.previewTitle} numberOfLines={2}>{cleanTitle || "Your challenge title"}</Text>
          <Text style={styles.previewText} numberOfLines={3}>{description.trim() || "Add a short description so it's clear what counts as done."}</Text>
        </View>

        <Card style={{ marginTop: 16 }}>
          <Field label="Title" count={`${title.length}/40`}>
            <TextInput value={title} onChangeText={setTitle} maxLength={40} placeholder="e.g. 50 push-ups" placeholderTextColor={colors.faint} style={styles.input} returnKeyType="next" />
          </Field>
          <Field label="Description" count={`${description.length}/140`}>
            <TextInput value={description} onChangeText={setDescription} maxLength={140} placeholder="What do you have to do?" placeholderTextColor={colors.faint} style={[styles.input, styles.multiline]} multiline />
          </Field>

          <Text style={styles.label}>Icon</Text>
          <View style={styles.grid}>
            {ICONS.map((name) => (
              <Pressable key={name} accessibilityLabel={name} onPress={() => setIcon(name)} style={[styles.iconChoice, icon === name && { borderColor: color, backgroundColor: alpha(color, 0.18) }]}>
                <Ionicons name={name} size={22} color={icon === name ? color : colors.muted} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Color</Text>
          <View style={styles.grid}>
            {SWATCHES.map((swatch) => (
              <Pressable key={swatch} accessibilityLabel={`Color ${swatch}`} onPress={() => setColor(swatch)} style={[styles.swatch, { backgroundColor: swatch }, color === swatch && styles.swatchActive]}>
                {color === swatch ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
              </Pressable>
            ))}
          </View>

          {mode === "dare" ? (
            <>
              <Text style={styles.label}>Send to</Text>
              <View style={styles.grid}>
                {social.friends.map((f) => (
                  <Pressable key={f.id} onPress={() => setRecipient(f.id)} style={[styles.friendChip, recipient === f.id && { borderColor: accent, backgroundColor: alpha(accent, 0.18) }]}>
                    <Ionicons name="person-circle" size={18} color={recipient === f.id ? accent : colors.muted} />
                    <Text style={[styles.friendText, recipient === f.id && { color: colors.text }]}>{f.name}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setRecipient(null)} style={[styles.friendChip, recipient === null && { borderColor: accent, backgroundColor: alpha(accent, 0.18) }]}>
                  <Ionicons name="share-social" size={18} color={recipient === null ? accent : colors.muted} />
                  <Text style={[styles.friendText, recipient === null && { color: colors.text }]}>Share as a code</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Reward</Text>
          {mode === "dare" ? (
            <View style={styles.pointsRow}>
              {DARE_POINT_OPTIONS.map((value) => (
                <Pressable key={value} onPress={() => setDarePoints(value)} style={[styles.pointsChoice, darePoints === value && { borderColor: colors.gold, backgroundColor: colors.goldSoft }]}>
                  <Text style={[styles.pointsValue, darePoints === value && { color: colors.gold }]}>{value}</Text>
                  <Text style={styles.pointsCaption}>{value === 10 ? "Easy" : value === 25 ? "Medium" : "Brutal"}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>
              Challenges you make for yourself are worth {SELF_CHALLENGE_POINTS} points each, up to {SELF_CHALLENGES_PER_DAY} a day.{" "}
              <Text style={{ color: selfLeft > 0 ? colors.text : colors.danger, fontWeight: "800" }}>{selfLeft} left today.</Text> Dare friends for bigger rewards!
            </Text>
          )}
        </Card>

        <Button
          label={mode === "self" ? "Add to my challenges" : "Send dare"}
          icon={mode === "self" ? "add-circle" : "paper-plane"}
          onPress={submit}
          disabled={!valid}
          loading={sending}
          style={{ marginTop: 16 }}
        />
        {mode === "dare" ? (
          <Text style={styles.footnote}>
            {recipient ? "It shows up on their Today screen right away." : online ? "Pick who gets it in your messaging app. They paste the code into Dowit." : "Add friends in the Friends tab to send dares directly. For now you can share a code."}
          </Text>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field({ label, count, children }: { label: string; count: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.fieldTop}>
        <Text style={[styles.label, { marginTop: 0 }]}>{label}</Text>
        <Text style={styles.counter}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md, padding: 5, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  segmentItem: { flex: 1, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", height: 44, borderRadius: 13 },
  segmentText: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  preview: { borderRadius: radius.lg, padding: 20, overflow: "hidden", minHeight: 200 },
  previewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "900", letterSpacing: 1, flex: 1 },
  previewPts: { color: colors.white, fontSize: 13, fontWeight: "900", backgroundColor: "rgba(0,0,0,0.18)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: "hidden" },
  previewIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginVertical: 14 },
  previewTitle: { color: colors.white, fontSize: 22, fontWeight: "900" },
  previewText: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20, marginTop: 6 },
  fieldTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 6, marginBottom: 10 },
  counter: { color: colors.faint, fontSize: 12, fontWeight: "700" },
  input: { backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  multiline: { minHeight: 90, paddingTop: 14, textAlignVertical: "top" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  iconChoice: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderWidth: 3, borderColor: colors.white },
  pointsRow: { flexDirection: "row", gap: 10 },
  pointsChoice: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  pointsValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  pointsCaption: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  friendChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  friendText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  footnote: { color: colors.faint, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 12 }
});
