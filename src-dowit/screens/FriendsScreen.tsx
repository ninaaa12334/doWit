import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Friend } from "../backend";
import { buildSabotage, checkRedeemable, decodeCode, levelInfo, Payload, recordSabotageSent, redeem, SABOTAGE_UNLOCK, sabotageAllowance, sabotageInfo, totalPoints, currentStreak } from "../game";
import { ProofThumb, ProofViewer } from "../proof";
import { SabotageKind } from "../storage";
import { alpha, colors, IconName, radius, useAccent } from "../theme";
import { Button, Card, Decor, Empty, IconBadge, Locked, Pill, SectionTitle, styles as ui } from "../ui";
import { ScreenProps } from "./types";

export function FriendsScreen(props: ScreenProps) {
  const { state, today, update, toast, go, social } = props;
  const accent = useAccent();
  const points = totalPoints(state);
  const [friendCode, setFriendCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<Friend | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const online = social.configured && social.status === "ready" && social.me;

  const invite = () =>
    Share.share({
      message: `Play Dowit with me! 🔥 Daily challenges, dares and sabotage.\n\nAdd me with my friend code: ${social.me?.friendCode}`
    }).catch(() => undefined);

  const add = async () => {
    setAdding(true);
    if (await social.addFriend(friendCode)) setFriendCode("");
    setAdding(false);
  };

  const confirmRemove = (friend: Friend) =>
    Alert.alert(`Remove ${friend.name}?`, "You can add each other again any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => social.removeFriend(friend) }
    ]);

  const openSabotage = (friend: Friend) => {
    if (points < SABOTAGE_UNLOCK) toast(`Sabotage unlocks at ${SABOTAGE_UNLOCK} points. ${SABOTAGE_UNLOCK - points} to go!`, "danger");
    else setTarget(friend);
  };

  const board = [
    { id: social.me?.id ?? "me", name: state.name || "You", points, streak: currentStreak(state, today), title: state.title, me: true },
    ...social.friends.map((f) => ({ ...f, me: false }))
  ].sort((a, b) => b.points - a.points);

  const incoming = social.requests.filter((r) => r.incoming);
  const outgoing = social.requests.filter((r) => !r.incoming);
  const feedProofs = social.feed.map((p) => ({ id: p.id, uri: p.url, kind: p.kind }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={ui.scroll}
        contentContainerStyle={ui.screen}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={online ? <RefreshControl refreshing={social.refreshing} onRefresh={social.refresh} tintColor={accent} /> : undefined}
      >
        <View style={ui.inner}>
          <View style={ui.header}>
            <View style={ui.headerText}>
              <Text style={ui.title}>Friends</Text>
              <Text style={ui.subtitle}>Dare them. Sabotage them. Stay friends.</Text>
            </View>
            <Pill icon="shield-checkmark" label={String(state.inventory.shields)} color={colors.success} />
          </View>

          {!social.configured ? (
            <Card style={styles.notice}>
              <IconBadge icon="cloud-offline" color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Online play isn't set up yet</Text>
                <Text style={styles.cardSub}>Follow SETUP.md to connect a free database. Until then you can still swap codes below.</Text>
              </View>
            </Card>
          ) : social.status === "connecting" ? (
            <Card style={styles.notice}>
              <ActivityIndicator color={accent} />
              <Text style={styles.cardSub}>Connecting to your friends…</Text>
            </Card>
          ) : social.status === "error" ? (
            <Card style={styles.notice}>
              <IconBadge icon="warning" color={colors.danger} />
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={styles.cardTitle}>Couldn't connect</Text>
                <Text style={styles.cardSub}>{social.error}</Text>
                <Button label="Try again" icon="refresh" small onPress={social.retry} style={{ alignSelf: "flex-start" }} />
              </View>
            </Card>
          ) : null}

          {online ? (
            <>
              {/* Invite */}
              <View style={[styles.invite, { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.45) }]}>
                <Decor color={accent} />
                <Text style={styles.inviteLabel}>YOUR FRIEND CODE</Text>
                <Text selectable style={styles.code}>{social.me!.friendCode}</Text>
                <Text style={styles.cardSub}>Friends type this code in their app to add you.</Text>
                <Button label="Invite friends" icon="share-social" onPress={invite} style={{ marginTop: 14 }} />
              </View>

              <Card style={{ marginTop: 14 }}>
                <Text style={styles.cardTitle}>Add a friend</Text>
                <View style={styles.addRow}>
                  <TextInput
                    value={friendCode}
                    onChangeText={(t) => setFriendCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="FRIEND CODE"
                    placeholderTextColor={colors.faint}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    style={styles.codeInput}
                    returnKeyType="send"
                    onSubmitEditing={() => friendCode.length === 6 && add()}
                  />
                  <Button label="Add" icon="person-add" onPress={add} disabled={friendCode.length !== 6} loading={adding} />
                </View>
              </Card>

              {incoming.length + outgoing.length > 0 ? (
                <>
                  <SectionTitle title="Requests" />
                  <Card style={{ paddingVertical: 6 }}>
                    {[...incoming, ...outgoing].map((r, i) => (
                      <View key={r.id} style={[styles.row, i > 0 && styles.divider]}>
                        <Avatar name={r.name} color={r.incoming ? accent : colors.faint} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{r.name}</Text>
                          <Text style={styles.meta}>{r.incoming ? "Wants to be friends" : "Waiting for them to accept"}</Text>
                        </View>
                        {r.incoming ? (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <IconButton icon="close" color={colors.muted} label="Decline" onPress={() => social.respond(r, false)} />
                            <IconButton icon="checkmark" color={colors.success} label="Accept" onPress={() => social.respond(r, true)} filled />
                          </View>
                        ) : (
                          <IconButton icon="close" color={colors.muted} label="Cancel request" onPress={() => social.respond(r, false)} />
                        )}
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}

              <SectionTitle title="Leaderboard" right={social.refreshing ? <ActivityIndicator size="small" color={accent} /> : null} />
              {social.friends.length === 0 ? (
                <Empty icon="people-outline" title="No friends yet" text="Share your friend code. Once they add you, you can dare and sabotage each other." />
              ) : (
                <Card style={{ paddingVertical: 6 }}>
                  {board.map((p, i) => {
                    const friend = social.friends.find((f) => f.id === p.id);
                    return (
                      <Pressable key={p.id} onLongPress={friend ? () => confirmRemove(friend) : undefined} delayLongPress={500} style={[styles.row, i > 0 && styles.divider, p.me && { backgroundColor: alpha(accent, 0.08) }]}>
                        <Text style={[styles.rank, i === 0 && { color: colors.gold }]}>{i === 0 ? "👑" : i + 1}</Text>
                        <Avatar name={p.name} color={p.me ? accent : colors.surfaceHigh} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name} numberOfLines={1}>{p.me ? `${p.name} (you)` : p.name}</Text>
                          <Text style={styles.meta} numberOfLines={1}>
                            Lv {levelInfo(p.points).level} · {p.points} pts · 🔥 {p.streak}{p.title ? ` · ${p.title}` : ""}
                          </Text>
                        </View>
                        {friend ? (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <IconButton icon="flash" color="#22B8F0" label={`Dare ${friend.name}`} onPress={() => {
                              props.setDareFor(friend.id);
                              go("create");
                            }} />
                            <IconButton icon="skull" color={points >= SABOTAGE_UNLOCK ? colors.danger : colors.faint} label={`Sabotage ${friend.name}`} onPress={() => openSabotage(friend)} />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </Card>
              )}
              {social.friends.length > 0 ? <Text style={styles.hint}>Tap ⚡ to dare, 💀 to sabotage. Long-press a friend to remove them.</Text> : null}

              <SectionTitle title="Proof feed" />
              {social.feed.length === 0 ? (
                <Empty icon="images-outline" title="No proof yet" text="Photos and videos you and your friends add to challenges show up here." />
              ) : (
                <View style={styles.feed}>
                  {social.feed.slice(0, 12).map((post, i) => (
                    <View key={post.id} style={styles.feedCell}>
                      <ProofThumb proof={feedProofs[i]} size="fill" onPress={() => setViewer(i)} />
                      <View style={styles.feedTag} pointerEvents="none">
                        <Text style={styles.feedName} numberOfLines={1}>{post.name}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {!online ? <OfflineSabotage {...props} /> : null}
          <RedeemCode {...props} />

          <SectionTitle title="Activity" />
          {state.activity.length === 0 ? (
            <Empty icon="notifications-outline" title="Nothing yet" text="Dares and sabotages you send or receive show up here." />
          ) : (
            <Card style={{ paddingVertical: 6 }}>
              {state.activity.slice(0, 15).map((item, index) => (
                <View key={item.id} style={[styles.row, index > 0 && styles.divider]}>
                  <IconBadge icon={item.icon as IconName} color={item.color} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityText}>{item.text}</Text>
                    <Text style={styles.meta}>{timeAgo(item.at)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <SabotageSheet {...props} friend={target} onClose={() => setTarget(null)} />
      {viewer !== null && social.feed[viewer] ? (
        <ProofViewer proofs={feedProofs} start={viewer} caption={`${social.feed[viewer].name} · ${social.feed[viewer].title}`} onClose={() => setViewer(null)} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Pick Double Trouble or Hard Mode for one friend. */
function SabotageSheet({ state, today, social, friend, onClose }: ScreenProps & { friend: Friend | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState<SabotageKind | null>(null);
  const allowance = sabotageAllowance(state, today);
  const left = allowance.free + allowance.tokens;

  const send = async (kind: SabotageKind) => {
    if (!friend) return;
    setSending(kind);
    const ok = await social.sendSabotage(friend, kind);
    setSending(null);
    if (ok) onClose();
  };

  return (
    <Modal visible={friend !== null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Sabotage {friend?.name} 😈</Text>
        <Text style={styles.cardSub}>{left > 0 ? `${allowance.free} free today · ${allowance.tokens} tokens` : "You're out of sabotages today. Earn tokens in the Royal Pass."}</Text>
        {(Object.keys(sabotageInfo) as SabotageKind[]).map((kind) => {
          const info = sabotageInfo[kind];
          return (
            <Pressable
              key={kind}
              disabled={left <= 0 || sending !== null}
              onPress={() => send(kind)}
              style={({ pressed }) => [styles.sabOption, { borderColor: alpha(info.color, 0.5) }, left <= 0 && { opacity: 0.4 }, pressed && { backgroundColor: alpha(info.color, 0.15) }]}
            >
              <View style={[styles.sabIcon, { backgroundColor: info.color }]}><Ionicons name={info.icon} size={24} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sabName}>{info.name}</Text>
                <Text style={styles.cardSub}>{info.tagline} They earn ×{info.multiplier} if they beat it.</Text>
              </View>
              {sending === kind ? <ActivityIndicator color={info.color} /> : <Ionicons name="paper-plane" size={20} color={info.color} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

/** Code-based sabotage for when online play isn't available. */
function OfflineSabotage({ state, today, update, toast }: ScreenProps) {
  const [sending, setSending] = useState<SabotageKind | null>(null);
  const points = totalPoints(state);
  const allowance = sabotageAllowance(state, today);
  const canSabotage = points >= SABOTAGE_UNLOCK && allowance.free + allowance.tokens > 0;

  const send = async (kind: SabotageKind) => {
    setSending(kind);
    try {
      const info = sabotageInfo[kind];
      const result = await Share.share({
        message: `😈 ${state.name || "A friend"} sabotaged you on Dowit with ${info.name}!\n\nOpen Dowit → Friends → Redeem a code, and paste this:\n${buildSabotage(state, kind)}`
      });
      if (result.action !== Share.dismissedAction) {
        update(recordSabotageSent(state, kind, today));
        toast(`${info.name} sent. Mwahaha 😈`, "danger");
      }
    } catch {
      toast("Couldn't open sharing. Try again.", "danger");
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      <SectionTitle title="Sabotage" right={points >= SABOTAGE_UNLOCK ? <Text style={styles.meta}>{allowance.free} free · {allowance.tokens} tokens</Text> : null} />
      {points < SABOTAGE_UNLOCK ? (
        <Locked icon="skull" title="Unleash sabotage" text="At 1000 points you can double a friend's challenge or force them into Hard Mode." required={SABOTAGE_UNLOCK} current={points} color={colors.danger} />
      ) : (
        (Object.keys(sabotageInfo) as SabotageKind[]).map((kind) => {
          const info = sabotageInfo[kind];
          return (
            <View key={kind} style={[styles.sabCard, { borderColor: alpha(info.color, 0.4) }]}>
              <Decor color={info.color} />
              <View style={styles.row}>
                <View style={[styles.sabIcon, { backgroundColor: info.color }]}><Ionicons name={info.icon} size={24} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sabName}>{info.name}</Text>
                  <Text style={styles.cardSub}>{info.tagline}</Text>
                </View>
              </View>
              <Button label={`Send ${info.name} as a code`} icon="paper-plane" color={info.color} onPress={() => send(kind)} disabled={!canSabotage} loading={sending === kind} />
            </View>
          );
        })
      )}
    </>
  );
}

function RedeemCode({ state, today, update, toast, go, social }: ScreenProps) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(!social.configured);

  const finish = (payload: Payload, useShield: boolean) => {
    const result = redeem(state, payload, today, useShield);
    update(result.state);
    setCode("");
    toast(result.message, payload.k === "d" ? "info" : useShield ? "success" : "danger");
    if (payload.k === "d") go("today");
  };

  const onRedeem = () => {
    const payload = decodeCode(code);
    if (!payload) return toast("That doesn't look like a Dowit code.", "danger");
    const problem = checkRedeemable(state, payload);
    if (problem) return toast(problem, "danger");
    if (payload.k === "s" && state.inventory.shields > 0) {
      const info = sabotageInfo[payload.m];
      Alert.alert(`${payload.f || "A friend"} sabotaged you!`, `${info.name}: your next challenge gets tougher.\n\nUse a shield to block it? You have ${state.inventory.shields}.`, [
        { text: "Take the hit", style: "destructive", onPress: () => finish(payload, false) },
        { text: "Block with shield 🛡️", onPress: () => finish(payload, true) }
      ]);
      return;
    }
    finish(payload, false);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(!open)} style={styles.collapse} hitSlop={6}>
        <Text style={ui.sectionTitle}>Redeem a code</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
      </Pressable>
      {open ? (
        <Card>
          <Text style={styles.cardSub}>Got a DOWIT- code in a message? Paste it here.</Text>
          <TextInput value={code} onChangeText={setCode} placeholder="DOWIT-..." placeholderTextColor={colors.faint} autoCapitalize="none" autoCorrect={false} multiline style={styles.input} />
          <Button label="Redeem" icon="flash" onPress={onRedeem} disabled={!code.trim()} />
        </Card>
      ) : null}
    </>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <Text style={styles.avatarText}>{(name || "?").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function IconButton({ icon, color, label, onPress, filled }: { icon: IconName; color: string; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.iconBtn, { borderColor: alpha(color, 0.5) }, filled && { backgroundColor: color, borderColor: color }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={filled ? colors.white : color} />
    </Pressable>
  );
}

function timeAgo(at: number) {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  cardSub: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  invite: { borderRadius: radius.lg, borderWidth: 1, padding: 20, overflow: "hidden", alignItems: "center" },
  inviteLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  code: { color: colors.text, fontSize: 40, fontWeight: "900", letterSpacing: 8, marginVertical: 6 },
  addRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  codeInput: { flex: 1, backgroundColor: colors.bg, color: colors.text, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54, fontSize: 20, fontWeight: "800", letterSpacing: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rank: { width: 26, textAlign: "center", color: colors.muted, fontSize: 16, fontWeight: "900" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: "900" },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  hint: { color: colors.faint, fontSize: 12, textAlign: "center", marginTop: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  feed: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  feedCell: { width: "31.8%", aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  feedTag: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.55)" },
  feedName: { color: colors.white, fontSize: 11, fontWeight: "800" },
  activityText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  collapse: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  input: { backgroundColor: colors.bg, color: colors.text, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 14, minHeight: 64, maxHeight: 120, fontSize: 14, marginVertical: 14, textAlignVertical: "top" },
  sabCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: 18, marginBottom: 12, overflow: "hidden", gap: 14 },
  sabIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sabName: { color: colors.text, fontSize: 17, fontWeight: "900" },
  sabOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.bg },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 10, gap: 12, width: "100%", maxWidth: 600, alignSelf: "center" },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 6 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: "900" }
});
