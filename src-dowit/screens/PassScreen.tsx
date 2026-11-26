import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { claimReward, passTiers, Reward, rewardLabel, ROYAL_DAYS, RoyalDay, seasonInfo, TIER_XP } from "../game";
import { alpha, colors, radius, themes, useAccent } from "../theme";
import { Card, Decor, Header, IconBadge, ProgressBar, Screen, SectionTitle } from "../ui";
import { ScreenProps } from "./types";

export function PassScreen({ state, today, update, toast }: ScreenProps) {
  const accent = useAccent();
  const season = seasonInfo(state, today);

  const claim = (tier: number, track: "free" | "royal") => {
    const result = claimReward(state, today, tier, track);
    if (result.state !== state) update(result.state);
    toast(result.message, track === "royal" ? "gold" : "success");
  };

  return (
    <Screen>
      <Header title="Royal Pass" subtitle={`${season.name} season · ${season.daysLeft} ${season.daysLeft === 1 ? "day" : "days"} left`} />

      <View style={styles.hero}>
        <Decor color={colors.gold} strong />
        <View style={styles.heroTop}>
          <View style={styles.crown}><Ionicons name="diamond" size={30} color="#2A1D00" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>CURRENT TIER</Text>
            <Text style={styles.heroTier}>{season.tier}<Text style={styles.heroOf}> / {passTiers.length}</Text></Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.heroLabel}>SEASON XP</Text>
            <Text style={styles.heroXp}>{season.xp}</Text>
          </View>
        </View>
        <ProgressBar value={season.tierProgress} color={colors.gold} height={12} track="rgba(255,255,255,0.12)" />
        <Text style={styles.heroHint}>
          {season.tier >= passTiers.length ? "Season complete. You're a legend 👑" : `${season.xpToNext} XP to tier ${season.tier + 1}. Every point you earn this month counts.`}
        </Text>
      </View>

      <Card style={[styles.royal, season.royal && { borderColor: alpha(colors.gold, 0.6) }]}>
        <IconBadge icon={season.royal ? "checkmark-circle" : season.royalMissed ? "close-circle" : "lock-closed"} color={season.royalMissed ? colors.faint : colors.gold} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.royalTitle}>
            {season.royal ? "Royal Pass earned 👑" : season.royalMissed ? "Royal Pass missed this season" : "Earn the Royal Pass"}
          </Text>
          <Text style={styles.royalText}>
            {season.royal
              ? `You did the first ${ROYAL_DAYS} days in a row. Gold rewards are yours all season.`
              : season.royalMissed
                ? `You needed the daily challenge on each of the first ${ROYAL_DAYS} days. Next chance: the 1st of next month.`
                : `Do the daily challenge on each of the first ${ROYAL_DAYS} days of the month, in a row. No payment needed.`}
          </Text>
          <View style={styles.days}>
            {season.royalDays.map((d) => <DayDot key={d.date} day={d} />)}
          </View>
        </View>
      </Card>

      <View style={styles.inventory}>
        <Stock icon="shield-checkmark" color={colors.success} value={state.inventory.shields} label="Shields" />
        <Stock icon="rocket" color={colors.gold} value={state.inventory.boosts + (state.boostArmed ? 1 : 0)} label="Boosts" />
        <Stock icon="flame" color={colors.danger} value={state.inventory.sabotageTokens} label="Tokens" />
      </View>

      <SectionTitle title="Rewards" right={<Text style={styles.legend}>Free · <Text style={{ color: colors.gold }}>Royal</Text></Text>} />
      {passTiers.map((tier, index) => {
        const reached = index < season.tier;
        return (
          <View key={index} style={styles.tierRow}>
            <RewardCell reward={tier.free} reached={reached} claimed={season.claims.free.includes(index)} available onClaim={() => claim(index, "free")} tint={accent} />
            <View style={styles.node}>
              <View style={[styles.line, index === 0 && { top: "50%" }, index === passTiers.length - 1 && { bottom: "50%" }, reached && { backgroundColor: colors.gold }]} />
              <View style={[styles.dot, reached && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
                <Text style={[styles.dotText, reached && { color: "#2A1D00" }]}>{index + 1}</Text>
              </View>
              <Text style={styles.xp}>{(index + 1) * TIER_XP}</Text>
            </View>
            <RewardCell reward={tier.royal} reached={reached} claimed={season.claims.royal.includes(index)} available={season.royal} onClaim={() => claim(index, "royal")} tint={colors.gold} royal />
          </View>
        );
      })}
      <Text style={styles.footer}>A new season starts on the 1st of every month. Themes and titles you earn are yours forever.</Text>
    </Screen>
  );
}

function RewardCell({ reward, reached, claimed, available, onClaim, tint, royal }: { reward: Reward; reached: boolean; claimed: boolean; available: boolean; onClaim: () => void; tint: string; royal?: boolean }) {
  const { label, icon } = rewardLabel(reward);
  const claimable = reached && available && !claimed;
  const iconColor = reward.kind === "theme" ? themes[reward.value].accent : tint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${claimed ? ", claimed" : claimable ? ", claim" : ", locked"}`}
      disabled={!claimable}
      onPress={onClaim}
      style={({ pressed }) => [
        styles.cell,
        royal && styles.cellRoyal,
        claimable && { borderColor: tint, backgroundColor: alpha(tint, 0.14) },
        claimed && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.97 }] }
      ]}
    >
      <View style={styles.cellIcon}>
        <Ionicons name={icon} size={22} color={reached || claimed ? iconColor : colors.faint} />
        {!available ? <Ionicons name="lock-closed" size={11} color={colors.faint} style={styles.cellLock} /> : null}
      </View>
      <Text style={styles.cellLabel} numberOfLines={2}>{label}</Text>
      {claimed ? (
        <Text style={[styles.cellState, { color: colors.success }]}>✓ Claimed</Text>
      ) : claimable ? (
        <Text style={[styles.cellState, { color: tint }]}>Tap to claim</Text>
      ) : null}
    </Pressable>
  );
}

function DayDot({ day }: { day: RoyalDay }) {
  const done = day.status === "done";
  const missed = day.status === "missed";
  const now = day.status === "today";
  return (
    <View style={styles.dayWrap} accessibilityLabel={`Day ${day.day}: ${day.status}`}>
      <View style={[styles.day, done && { backgroundColor: colors.gold, borderColor: colors.gold }, missed && { borderColor: alpha(colors.danger, 0.6), backgroundColor: alpha(colors.danger, 0.12) }, now && { borderColor: colors.gold }]}>
        {done ? <Ionicons name="checkmark" size={18} color="#2A1D00" /> : missed ? <Ionicons name="close" size={18} color={colors.danger} /> : <Text style={[styles.dayNum, now && { color: colors.gold }]}>{day.day}</Text>}
      </View>
      <Text style={[styles.dayLabel, now && { color: colors.gold }]}>{now ? "Today" : `Day ${day.day}`}</Text>
    </View>
  );
}

function Stock({ icon, color, value, label }: { icon: "shield-checkmark" | "rocket" | "flame"; color: string; value: number; label: string }) {
  return (
    <View style={styles.stock}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.stockValue}>{value}</Text>
      <Text style={styles.stockLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 30, padding: 22, overflow: "hidden", backgroundColor: "#2A2140", borderWidth: 1, borderColor: alpha(colors.gold, 0.45), gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  crown: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  heroLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroTier: { color: colors.white, fontSize: 34, fontWeight: "900" },
  heroOf: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  heroXp: { color: colors.gold, fontSize: 24, fontWeight: "900" },
  heroHint: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19 },
  royal: { flexDirection: "row", gap: 14, marginTop: 14, alignItems: "flex-start" },
  royalTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  royalText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  days: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  dayWrap: { alignItems: "center", gap: 4 },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  dayNum: { color: colors.muted, fontSize: 14, fontWeight: "900" },
  dayLabel: { color: colors.faint, fontSize: 11, fontWeight: "800" },
  inventory: { flexDirection: "row", gap: 10, marginTop: 14 },
  stock: { flex: 1, alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, gap: 3 },
  stockValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  stockLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  legend: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  tierRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  node: { width: 46, alignItems: "center", justifyContent: "center" },
  line: { position: "absolute", top: 0, bottom: 0, width: 3, backgroundColor: colors.border },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  dotText: { color: colors.muted, fontSize: 14, fontWeight: "900" },
  xp: { color: colors.faint, fontSize: 10, fontWeight: "800", marginTop: 3, backgroundColor: colors.bg, paddingHorizontal: 2 },
  cell: { flex: 1, minHeight: 104, marginVertical: 5, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, gap: 6 },
  cellRoyal: { backgroundColor: "#1E1A2E", borderColor: alpha(colors.gold, 0.22) },
  cellIcon: { flexDirection: "row", alignItems: "center" },
  cellLock: { marginLeft: 6 },
  cellLabel: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  cellState: { fontSize: 12, fontWeight: "900" },
  footer: { color: colors.faint, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 18 }
});
