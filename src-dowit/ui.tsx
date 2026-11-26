import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { alpha, colors, IconName, radius, useAccent } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "light" | "ghost" | "danger" | "gold";

export function Button({
  label,
  icon,
  onPress,
  variant = "primary",
  disabled,
  loading,
  color,
  style,
  small
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const accent = useAccent();
  const background = {
    primary: color ?? accent,
    light: colors.white,
    ghost: colors.surfaceHigh,
    danger: colors.danger,
    gold: colors.gold
  }[variant];
  const foreground = variant === "light" ? (color ?? accent) : variant === "gold" ? "#2A1D00" : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background },
        variant === "ghost" && styles.buttonGhost,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 17 : 20} color={foreground} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: foreground }]} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 10, track = colors.surfaceHigh }: { value: number; color?: string; height?: number; track?: string }) {
  const accent = useAccent();
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: Math.max(0, Math.min(1, value)), duration: 600, useNativeDriver: false }).start();
  }, [value, width]);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }]}>
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? accent,
          width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
        }}
      />
    </View>
  );
}

export function Pill({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress?: () => void }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.pill, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.3) }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function IconBadge({ icon, color, size = 44 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.iconBadge, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: alpha(color, 0.16) }]}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function Locked({ icon, title, text, required, current, color }: { icon: IconName; title: string; text: string; required: number; current: number; color?: string }) {
  const accent = useAccent();
  const tint = color ?? accent;
  return (
    <Card style={styles.locked}>
      <Decor color={tint} />
      <View style={[styles.lockCircle, { backgroundColor: alpha(tint, 0.16) }]}>
        <Ionicons name={icon} size={34} color={tint} />
        <View style={styles.lockBadge}><Ionicons name="lock-closed" size={13} color={colors.white} /></View>
      </View>
      <Text style={styles.lockedTitle}>{title}</Text>
      <Text style={styles.lockedText}>{text}</Text>
      <View style={styles.lockedBar}>
        <ProgressBar value={current / required} color={tint} />
        <Text style={styles.lockedCount}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{current}</Text> / {required} pts · {Math.max(0, required - current)} to go
        </Text>
      </View>
    </Card>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <Card style={styles.empty}>
      <Ionicons name={icon} size={28} color={colors.faint} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </Card>
  );
}

/** Soft decorative circles that make flat cards feel lit. */
export function Decor({ color, strong }: { color: string; strong?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, { backgroundColor: alpha(color, strong ? 0.35 : 0.12), top: -70, right: -50, width: 200, height: 200 }]} />
      <View style={[styles.blob, { backgroundColor: alpha(color, strong ? 0.22 : 0.07), bottom: -90, left: -60, width: 220, height: 220 }]} />
    </View>
  );
}

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  screen: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  inner: { width: "100%", maxWidth: 560, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, overflow: "hidden" },
  button: { minHeight: 54, borderRadius: radius.md, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonSmall: { minHeight: 42, borderRadius: radius.sm, paddingHorizontal: 14 },
  buttonGhost: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: "800" },
  buttonTextSmall: { fontSize: 14 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  track: { width: "100%", overflow: "hidden" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: "800" },
  iconBadge: { alignItems: "center", justifyContent: "center" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  locked: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 22 },
  lockCircle: { width: 84, height: 84, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  lockBadge: { position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  lockedTitle: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 18, textAlign: "center" },
  lockedText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 8 },
  lockedBar: { width: "100%", marginTop: 22, gap: 10 },
  lockedCount: { color: colors.muted, fontSize: 13, textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 26, gap: 6 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  blob: { position: "absolute", borderRadius: 999 }
});
