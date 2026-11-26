import AsyncStorage from "@react-native-async-storage/async-storage";

import { getChallengeForDate } from "./challenges";
import { ThemeId } from "./theme";

export type SabotageKind = "double" | "hard";

/** A photo or video you attached to prove you did a challenge. */
export type Proof = { id: string; uri: string; kind: "image" | "video"; width?: number; height?: number; duration?: number | null };

export type Completion = {
  id: string;
  date: string;
  title: string;
  points: number;
  source: "daily" | "self" | "dare";
  icon: string;
  color: string;
  proofs?: Proof[];
  /** True once the one-time proof bonus has been paid for this completion. */
  proofBonus?: boolean;
};

/** A challenge you created for yourself, or a dare a friend sent you. */
export type ExtraChallenge = {
  id: string;
  title: string;
  description: string;
  points: number;
  icon: string;
  color: string;
  from: string | null;
  createdAt: number;
  doneAt?: number;
  /** Set when the dare came through the server, so the sender can be told it's done. */
  remoteId?: string;
};

export type Sabotage = { id: string; date: string; kind: SabotageKind; from: string };

export type Activity = { id: string; icon: string; color: string; text: string; at: number };

export type State = {
  version: 2;
  uid: string;
  name: string;
  onboarded: boolean;
  completions: Completion[];
  extras: ExtraChallenge[];
  sabotages: Sabotage[];
  redeemed: string[];
  activity: Activity[];
  inventory: { shields: number; boosts: number; sabotageTokens: number };
  boostArmed: boolean;
  sabotageUse: { date: string; count: number };
  pass: Record<string, { free: number[]; royal: number[] }>;
  themes: ThemeId[];
  theme: ThemeId;
  titles: string[];
  title: string | null;
  /** Last known status of dares/sabotages you sent online, keyed by message id. */
  outbox: Record<string, string>;
  /** Upload your proof photos/videos so friends can see them. */
  shareProofs: boolean;
};

const STORAGE_KEY = "dowit-state-v2";
const LEGACY_KEY = "dowit-progress-v1";

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createInitialState(): State {
  return {
    version: 2,
    uid: makeId(),
    name: "",
    onboarded: false,
    completions: [],
    extras: [],
    sabotages: [],
    redeemed: [],
    activity: [],
    inventory: { shields: 0, boosts: 0, sabotageTokens: 0 },
    boostArmed: false,
    sabotageUse: { date: "", count: 0 },
    pass: {},
    themes: ["violet"],
    theme: "violet",
    titles: [],
    title: null,
    outbox: {},
    shareProofs: true
  };
}

export async function loadState(): Promise<State> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<State>;
      const base = createInitialState();
      return { ...base, ...parsed, inventory: { ...base.inventory, ...parsed.inventory } };
    }

    // Carry over progress from the first version of the app.
    const state = createInitialState();
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as { completedDates?: string[] };
      state.completions = (old.completedDates ?? []).map((date): Completion => {
        const challenge = getChallengeForDate(date);
        return { id: makeId(), date, title: challenge.title, points: challenge.points, source: "daily", icon: challenge.icon, color: challenge.color };
      });
    }
    return state;
  } catch {
    return createInitialState();
  }
}

export async function saveState(state: State) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
