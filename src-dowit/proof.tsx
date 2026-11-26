import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PROOF_BONUS } from "./game";
import { canShare, formatDuration, keepProofs, MAX_PROOFS, pickProof, shareProof } from "./media";
import { Proof } from "./storage";
import { alpha, colors, radius } from "./theme";
import { Button } from "./ui";

/** Small square preview of a photo or video. */
export function ProofThumb({ proof, size = 72, onPress, onRemove }: { proof: Proof; size?: number | "fill"; onPress?: () => void; onRemove?: () => void }) {
  const box = size === "fill" ? { width: "100%" as const, height: "100%" as const } : { width: size, height: size };
  const iconSize = size === "fill" ? 36 : size * 0.42;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={proof.kind === "video" ? "Proof video" : "Proof photo"} disabled={!onPress} onPress={onPress} style={[styles.thumb, box]}>
      {proof.kind === "image" ? (
        <Image source={{ uri: proof.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoThumb]}>
          <Ionicons name="play-circle" size={iconSize} color={colors.white} />
          {proof.duration ? <Text style={styles.duration}>{formatDuration(proof.duration)}</Text> : null}
        </View>
      )}
      {onRemove ? (
        <Pressable accessibilityLabel="Remove" hitSlop={8} onPress={onRemove} style={styles.remove}>
          <Ionicons name="close" size={14} color={colors.white} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Horizontal row of thumbnails. */
export function ProofStrip({ proofs, onOpen, size = 64 }: { proofs: Proof[]; onOpen: (index: number) => void; size?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {proofs.map((proof, index) => <ProofThumb key={proof.id} proof={proof} size={size} onPress={() => onOpen(index)} />)}
    </ScrollView>
  );
}

/**
 * Bottom sheet for adding proof. Used when completing a challenge
 * (with an optional skip) and for adding proof to one already done.
 */
export function ProofSheet({
  visible,
  title,
  color,
  existing = 0,
  bonusAvailable,
  allowSkip,
  onConfirm,
  onSkip,
  onClose,
  onError
}: {
  visible: boolean;
  title: string;
  color: string;
  existing?: number;
  bonusAvailable: boolean;
  allowSkip: boolean;
  onConfirm: (proofs: Proof[]) => void;
  onSkip?: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Proof[]>([]);
  const [busy, setBusy] = useState(false);
  const remaining = MAX_PROOFS - existing - picked.length;

  useEffect(() => {
    if (!visible) setPicked([]);
  }, [visible]);

  const add = async (source: "camera" | "library") => {
    const result = await pickProof(source, remaining);
    if (!result) return;
    if ("error" in result) onError(result.error);
    else setPicked((current) => [...current, ...result.proofs]);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      onConfirm(await keepProofs(picked));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <View style={[styles.sheetIcon, { backgroundColor: alpha(color, 0.18) }]}>
            <Ionicons name="camera" size={24} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Prove it!</Text>
            <Text style={styles.sheetSub} numberOfLines={2}>{title}</Text>
          </View>
          <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {bonusAvailable ? (
          <View style={styles.bonus}>
            <Ionicons name="sparkles" size={16} color={colors.gold} />
            <Text style={styles.bonusText}>Add a photo or video for <Text style={{ fontWeight: "900", color: colors.gold }}>+{PROOF_BONUS} bonus points</Text></Text>
          </View>
        ) : null}

        {picked.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picked}>
            {picked.map((proof) => (
              <ProofThumb key={proof.id} proof={proof} size={84} onRemove={() => setPicked((current) => current.filter((p) => p.id !== proof.id))} />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.sources}>
          <SourceButton icon="camera" label="Camera" sub="Photo or video" color={color} disabled={remaining <= 0} onPress={() => add("camera")} />
          <SourceButton icon="images" label="Gallery" sub={`Up to ${Math.max(0, remaining)} more`} color={color} disabled={remaining <= 0} onPress={() => add("library")} />
        </View>

        <Button
          label={picked.length > 0 ? (allowSkip ? "Complete with proof" : "Save proof") : allowSkip ? "Add proof to continue" : "Pick a photo or video"}
          icon="checkmark-circle"
          color={color}
          disabled={picked.length === 0}
          loading={busy}
          onPress={confirm}
        />
        {allowSkip && onSkip ? (
          <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={8} style={styles.skip}>
            <Text style={styles.skipText}>Skip, complete without proof</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

function SourceButton({ icon, label, sub, color, disabled, onPress }: { icon: "camera" | "images"; label: string; sub: string; color: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.source, disabled && { opacity: 0.4 }, pressed && { backgroundColor: alpha(color, 0.14), borderColor: color }]}
    >
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.sourceLabel}>{label}</Text>
      <Text style={styles.sourceSub}>{sub}</Text>
    </Pressable>
  );
}

/** Full-screen swipeable viewer for photos and videos. */
export function ProofViewer({ proofs, start, caption, onClose, onDelete }: { proofs: Proof[]; start: number; caption?: string; onClose: () => void; onDelete?: (proof: Proof) => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [shareable, setShareable] = useState(false);
  const current = proofs[index];

  useEffect(() => {
    canShare().then(setShareable);
  }, []);

  useEffect(() => {
    if (proofs.length === 0) onClose();
    else if (index >= proofs.length) setIndex(proofs.length - 1);
  }, [proofs.length, index, onClose]);

  const confirmDelete = () => {
    if (!current || !onDelete) return;
    Alert.alert("Delete this proof?", "It will be removed from this challenge.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(current) }
    ]);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.viewer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * width, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {proofs.map((proof, i) => (
            <View key={proof.id} style={{ width, height, justifyContent: "center" }}>
              {proof.kind === "image" ? (
                <Image source={{ uri: proof.uri }} style={{ width, height }} resizeMode="contain" />
              ) : (
                <VideoItem uri={proof.uri} active={i === index} width={width} height={height * 0.75} />
              )}
            </View>
          ))}
        </ScrollView>

        <View style={[styles.viewerBar, { top: insets.top + 8 }]}>
          <Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={10} style={styles.roundBtn}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          {proofs.length > 1 ? <Text style={styles.counter}>{index + 1} / {proofs.length}</Text> : <View />}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {shareable && current ? (
              <Pressable accessibilityLabel="Share" onPress={() => shareProof(current).catch(() => undefined)} hitSlop={10} style={styles.roundBtn}>
                <Ionicons name="share-outline" size={22} color={colors.white} />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable accessibilityLabel="Delete" onPress={confirmDelete} hitSlop={10} style={styles.roundBtn}>
                <Ionicons name="trash-outline" size={22} color={colors.white} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {caption ? (
          <View style={[styles.caption, { paddingBottom: insets.bottom + 18 }]}>
            <Text style={styles.captionText} numberOfLines={2}>{caption}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function VideoItem({ uri, active, width, height }: { uri: string; active: boolean; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 14, overflow: "hidden", backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  videoThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "#111326" },
  duration: { position: "absolute", bottom: 4, right: 6, color: colors.white, fontSize: 11, fontWeight: "800" },
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 10, gap: 16, width: "100%", maxWidth: 600, alignSelf: "center" },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: colors.text, fontSize: 21, fontWeight: "900" },
  sheetSub: { color: colors.muted, fontSize: 14, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceHigh, alignItems: "center", justifyContent: "center" },
  bonus: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 12 },
  bonusText: { flex: 1, color: colors.text, fontSize: 14 },
  picked: { gap: 10, paddingVertical: 2 },
  sources: { flexDirection: "row", gap: 12 },
  source: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 18, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  sourceLabel: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
  sourceSub: { color: colors.faint, fontSize: 12 },
  skip: { alignItems: "center", paddingVertical: 4 },
  skipText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  counter: { color: colors.white, fontSize: 15, fontWeight: "800" },
  caption: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 30, backgroundColor: "rgba(0,0,0,0.55)" },
  captionText: { color: colors.white, fontSize: 16, fontWeight: "700" }
});
