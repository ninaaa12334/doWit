import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { makeId, Proof } from "./storage";

export const MAX_PROOFS = 4;
const MAX_VIDEO_SECONDS = 60;

export type PickResult = { proofs: Proof[] } | { error: string } | null;

/** Opens the camera or photo library and returns the chosen photos/videos. */
export async function pickProof(source: "camera" | "library", remaining: number): Promise<PickResult> {
  if (remaining <= 0) return { error: `You can add up to ${MAX_PROOFS} photos or videos.` };
  try {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { error: "Camera access is off. You can turn it on in your phone's Settings." };
    } else if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return { error: "Photo access is off. You can turn it on in your phone's Settings." };
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images", "videos"],
      quality: 0.7,
      videoMaxDuration: MAX_VIDEO_SECONDS
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: remaining });

    if (result.canceled) return null;
    const proofs = result.assets.slice(0, remaining).map((asset): Proof => ({
      id: makeId(),
      uri: asset.uri,
      kind: asset.type === "video" ? "video" : "image",
      width: asset.width,
      height: asset.height,
      duration: asset.duration ?? null
    }));
    return { proofs };
  } catch {
    return { error: "Couldn't open the camera or gallery. Try again." };
  }
}

/**
 * The picker hands back files in a temporary cache that the phone may clear,
 * so copy them into the app's own documents folder before saving.
 */
export async function keepProofs(proofs: Proof[]): Promise<Proof[]> {
  if (Platform.OS === "web") return proofs;
  const folder = new Directory(Paths.document, "proofs");
  if (!folder.exists) folder.create();
  const kept: Proof[] = [];
  for (const proof of proofs) {
    if (proof.uri.startsWith(folder.uri)) {
      kept.push(proof);
      continue;
    }
    try {
      const extension = proof.uri.split("?")[0].split(".").pop() || (proof.kind === "video" ? "mp4" : "jpg");
      const target = new File(folder, `${proof.id}.${extension}`);
      await new File(proof.uri).copy(target);
      kept.push({ ...proof, uri: target.uri });
    } catch {
      kept.push(proof); // fall back to the original location
    }
  }
  return kept;
}

export function deleteProofFiles(proofs: Proof[]) {
  if (Platform.OS === "web") return;
  for (const proof of proofs) {
    try {
      const file = new File(proof.uri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
  }
}

export async function canShare() {
  try {
    return Platform.OS !== "web" && (await Sharing.isAvailableAsync());
  } catch {
    return false;
  }
}

export async function shareProof(proof: Proof) {
  await Sharing.shareAsync(proof.uri, { dialogTitle: "Share your proof", mimeType: proof.kind === "video" ? "video/mp4" : "image/jpeg" });
}

export function formatDuration(ms?: number | null) {
  if (!ms) return "";
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
