import { addDays, Challenge, getChallengeForDate, getLocalDateKey } from "./challenges";
import { Activity, Completion, ExtraChallenge, makeId, Proof, Sabotage, SabotageKind, State } from "./storage";
import { colors, IconName, ThemeId } from "./theme";

// ---------- Rules ----------

export const CREATE_UNLOCK = 100;
export const SABOTAGE_UNLOCK = 1000;
export const FREE_SABOTAGES_PER_DAY = 1;
export const SELF_CHALLENGE_POINTS = 10;
export const SELF_CHALLENGES_PER_DAY = 3;
export const DARE_POINT_OPTIONS = [10, 25, 50];
export const BOOST_MULTIPLIER = 2;
export const POINTS_PER_LEVEL = 100;
export const PROOF_BONUS = 5;

export const sabotageInfo: Record<SabotageKind, { name: string; tagline: string; effect: string; icon: IconName; color: string; multiplier: number }> = {
  double: {
    name: "Double Trouble",
    tagline: "Their next challenge has to be done twice.",
    effect: "Do it twice",
    icon: "copy",
    color: "#FF8A3D",
    multiplier: 2
  },
  hard: {
    name: "Hard Mode",
    tagline: "Swap their next challenge for a much tougher version.",
    effect: "Hard Mode",
    icon: "flame",
    color: colors.danger,
    multiplier: 3
  }
};

// ---------- Points, levels, streaks ----------

export function totalPoints(state: State) {
  return state.completions.reduce((sum, item) => sum + item.points, 0);
}

export function levelInfo(points: number) {
  return { level: Math.floor(points / POINTS_PER_LEVEL) + 1, progress: (points % POINTS_PER_LEVEL) / POINTS_PER_LEVEL, toNext: POINTS_PER_LEVEL - (points % POINTS_PER_LEVEL) };
}

export function currentStreak(state: State, today: string) {
  const days = new Set(state.completions.filter((c) => c.source === "daily").map((c) => c.date));
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function nextUnlock(points: number) {
  if (points < CREATE_UNLOCK) return { name: "Create your own challenges", at: CREATE_UNLOCK, icon: "add-circle" as IconName };
  if (points < SABOTAGE_UNLOCK) return { name: "Sabotage your friends", at: SABOTAGE_UNLOCK, icon: "flame" as IconName };
  return null;
}

// ---------- Daily challenge ----------

export type DailyView = {
  base: Challenge;
  title: string;
  description: string;
  points: number;
  color: string;
  sabotage?: Sabotage;
  done?: Completion;
};

export function dailyChallenge(state: State, date: string): DailyView {
  const base = getChallengeForDate(date);
  const sabotage = state.sabotages.find((s) => s.date === date);
  const done = state.completions.find((c) => c.source === "daily" && c.date === date);
  if (!sabotage) return { base, title: base.title, description: base.description, points: base.points, color: base.color, done };
  const info = sabotageInfo[sabotage.kind];
  return {
    base,
    sabotage,
    done,
    color: info.color,
    points: base.points * info.multiplier,
    title: sabotage.kind === "double" ? `${base.title} ×2` : `${base.title}: Hard Mode`,
    description: sabotage.kind === "double" ? `Do it twice today! ${base.description}` : base.hard
  };
}

function withBoost(state: State, points: number) {
  return state.boostArmed ? points * BOOST_MULTIPLIER : points;
}

function proofFields(proofs: Proof[]) {
  return proofs.length > 0 ? { proofs, proofBonus: true, bonus: PROOF_BONUS } : { proofs: [], proofBonus: false, bonus: 0 };
}

export function completeDaily(state: State, date: string, proofs: Proof[] = []): { state: State; points: number } {
  const view = dailyChallenge(state, date);
  if (view.done) return { state, points: 0 };
  const { bonus, ...proofData } = proofFields(proofs);
  const points = withBoost(state, view.points) + bonus;
  const completion: Completion = { id: makeId(), date, title: view.title, points, source: "daily", icon: view.base.icon, color: view.color, ...proofData };
  return { state: { ...state, boostArmed: false, completions: [...state.completions, completion] }, points };
}

export function completeExtra(state: State, id: string, date: string, proofs: Proof[] = []): { state: State; points: number } {
  const item = state.extras.find((e) => e.id === id);
  if (!item || item.doneAt) return { state, points: 0 };
  const { bonus, ...proofData } = proofFields(proofs);
  const points = withBoost(state, item.points) + bonus;
  const completion: Completion = { id: makeId(), date, title: item.title, points, source: item.from ? "dare" : "self", icon: item.icon, color: item.color, ...proofData };
  let next: State = {
    ...state,
    boostArmed: false,
    completions: [...state.completions, completion],
    extras: state.extras.map((e) => (e.id === id ? { ...e, doneAt: Date.now() } : e))
  };
  if (item.from) next = log(next, { icon: "checkmark-done", color: colors.success, text: `You crushed ${item.from}'s dare "${item.title}"` });
  return { state: next, points };
}

/** Adds proof to a challenge you already completed. The bonus is paid only once. */
export function attachProofs(state: State, completionId: string, proofs: Proof[]): { state: State; bonus: number } {
  const target = state.completions.find((c) => c.id === completionId);
  if (!target || proofs.length === 0) return { state, bonus: 0 };
  const bonus = target.proofBonus ? 0 : PROOF_BONUS;
  const completions = state.completions.map((c) =>
    c.id === completionId ? { ...c, proofs: [...(c.proofs ?? []), ...proofs], proofBonus: true, points: c.points + bonus } : c
  );
  return { state: { ...state, completions }, bonus };
}

export function removeProof(state: State, completionId: string, proofId: string): State {
  return {
    ...state,
    completions: state.completions.map((c) => (c.id === completionId ? { ...c, proofs: (c.proofs ?? []).filter((p) => p.id !== proofId) } : c))
  };
}

export function allProofs(state: State) {
  return [...state.completions].reverse().flatMap((c) => (c.proofs ?? []).map((proof) => ({ proof, completion: c })));
}

export function addSelfChallenge(state: State, input: { title: string; description: string; icon: string; color: string }): State {
  const item: ExtraChallenge = { id: makeId(), ...input, points: SELF_CHALLENGE_POINTS, from: null, createdAt: Date.now() };
  return { ...state, extras: [item, ...state.extras] };
}

/** How many more challenges you can make for yourself today (stops point farming). */
export function selfChallengesLeft(state: State, today: string) {
  const made = state.extras.filter((e) => !e.from && getLocalDateKey(new Date(e.createdAt)) === today).length;
  return Math.max(0, SELF_CHALLENGES_PER_DAY - made);
}

export function removeExtra(state: State, id: string): State {
  return { ...state, extras: state.extras.filter((e) => e.id !== id) };
}

// ---------- Activity ----------

export function log(state: State, entry: Omit<Activity, "id" | "at">): State {
  return { ...state, activity: [{ ...entry, id: makeId(), at: Date.now() }, ...state.activity].slice(0, 40) };
}

// ---------- Share codes (dares + sabotage) ----------
// There is no server, so dares and sabotages travel as text codes sent through
// any messaging app. The friend pastes the code into Friends → Redeem.

type DarePayload = { k: "d"; i: string; u: string; f: string; t: string; d: string; p: number; ic: string; c: string };
type SabotagePayload = { k: "s"; i: string; u: string; f: string; m: SabotageKind };
export type Payload = DarePayload | SabotagePayload;

// Available globally in React Native (Hermes) and on the web.
declare function btoa(data: string): string;
declare function atob(data: string): string;

const CODE_PREFIX = "DOWIT-";

function encode(payload: Payload) {
  return CODE_PREFIX + btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeCode(text: string): Payload | null {
  const match = text.match(/DOWIT-([A-Za-z0-9+/=]+)/);
  if (!match) return null;
  try {
    const data = JSON.parse(decodeURIComponent(atob(match[1])));
    if (typeof data !== "object" || !data || typeof data.i !== "string" || typeof data.u !== "string" || typeof data.f !== "string") return null;
    if (data.k === "s" && (data.m === "double" || data.m === "hard")) return data as SabotagePayload;
    if (
      data.k === "d" &&
      typeof data.t === "string" && data.t.length > 0 && data.t.length <= 60 &&
      typeof data.d === "string" && data.d.length <= 200 &&
      DARE_POINT_OPTIONS.includes(data.p) &&
      typeof data.ic === "string" && typeof data.c === "string" && /^#[0-9A-Fa-f]{6}$/.test(data.c)
    ) {
      return data as DarePayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildDare(state: State, input: { title: string; description: string; points: number; icon: string; color: string }) {
  const payload: DarePayload = { k: "d", i: makeId(), u: state.uid, f: state.name, t: input.title, d: input.description, p: input.points, ic: input.icon, c: input.color };
  return encode(payload);
}

export function recordDareSent(state: State, title: string, to?: string): State {
  return log(state, { icon: "paper-plane", color: "#22B8F0", text: to ? `You dared ${to}: "${title}"` : `You sent a dare: "${title}"` });
}

export function sabotageAllowance(state: State, today: string) {
  const used = state.sabotageUse.date === today ? state.sabotageUse.count : 0;
  return { free: Math.max(0, FREE_SABOTAGES_PER_DAY - used), tokens: state.inventory.sabotageTokens };
}

export function buildSabotage(state: State, kind: SabotageKind) {
  const payload: SabotagePayload = { k: "s", i: makeId(), u: state.uid, f: state.name, m: kind };
  return encode(payload);
}

/** Spends a free daily sabotage first, then a token. */
export function recordSabotageSent(state: State, kind: SabotageKind, today: string, to?: string): State {
  const { free } = sabotageAllowance(state, today);
  const used = state.sabotageUse.date === today ? state.sabotageUse.count : 0;
  const next: State =
    free > 0
      ? { ...state, sabotageUse: { date: today, count: used + 1 } }
      : { ...state, inventory: { ...state.inventory, sabotageTokens: Math.max(0, state.inventory.sabotageTokens - 1) } };
  return log(next, { icon: sabotageInfo[kind].icon, color: sabotageInfo[kind].color, text: to ? `You hit ${to} with ${sabotageInfo[kind].name} 😈` : `You sent a ${sabotageInfo[kind].name} sabotage 😈` });
}

export function checkRedeemable(state: State, payload: Payload): string | null {
  if (payload.u === state.uid) return "That's your own code. Send it to a friend instead!";
  if (state.redeemed.includes(payload.i)) return "This code has already been used.";
  return null;
}

/** First day (today or later) that has no sabotage on it and isn't already completed. */
function freeSabotageDay(state: State, today: string) {
  let day = today;
  for (let i = 0; i < 365; i++) {
    const taken = state.sabotages.some((s) => s.date === day) || state.completions.some((c) => c.source === "daily" && c.date === day);
    if (!taken) return day;
    day = addDays(day, 1);
  }
  return day;
}

export function redeem(state: State, payload: Payload, today: string, useShield = false, remote = false): { state: State; message: string } {
  const from = payload.f || "A friend";
  let next: State = { ...state, redeemed: [...state.redeemed, payload.i] };

  if (payload.k === "d") {
    const dare: ExtraChallenge = { id: makeId(), title: payload.t, description: payload.d, points: payload.p, icon: payload.ic, color: payload.c, from, createdAt: Date.now(), remoteId: remote ? payload.i : undefined };
    next = log({ ...next, extras: [dare, ...next.extras] }, { icon: "flash", color: "#22B8F0", text: `${from} dared you: "${payload.t}"` });
    return { state: next, message: `New dare from ${from}! It's on your Today screen.` };
  }

  const info = sabotageInfo[payload.m];
  if (useShield && next.inventory.shields > 0) {
    next = { ...next, inventory: { ...next.inventory, shields: next.inventory.shields - 1 } };
    next = log(next, { icon: "shield-checkmark", color: colors.success, text: `Your shield blocked ${from}'s ${info.name}` });
    return { state: next, message: "Blocked! Your shield absorbed the sabotage." };
  }

  const date = freeSabotageDay(next, today);
  next = { ...next, sabotages: [...next.sabotages, { id: makeId(), date, kind: payload.m, from }] };
  next = log(next, { icon: info.icon, color: info.color, text: `${from} hit you with ${info.name}` });
  const when = date === today ? "today's" : "your next";
  return { state: next, message: `${from} sabotaged ${when} challenge! Beat it for ×${info.multiplier} points.` };
}

// ---------- Royal Pass ----------
// Each calendar month is a season. Every point earned that month is season XP.
// The free track is for everyone; the Royal track unlocks after completing
// the daily challenge on each of the first ROYAL_DAYS days of the season, in a
// row, so it is earned, not bought. Miss one of those days and it's gone until
// next month.

export const TIER_XP = 50;
export const ROYAL_DAYS = 5;

export type RoyalDay = { day: number; date: string; status: "done" | "missed" | "today" | "upcoming" };

export type Reward =
  | { kind: "title"; value: string }
  | { kind: "theme"; value: ThemeId }
  | { kind: "shield" | "boost" | "token"; amount: number };

export const passTiers: { free: Reward; royal: Reward }[] = [
  { free: { kind: "title", value: "Go-Getter" }, royal: { kind: "theme", value: "gold" } },
  { free: { kind: "boost", amount: 1 }, royal: { kind: "shield", amount: 1 } },
  { free: { kind: "theme", value: "ocean" }, royal: { kind: "token", amount: 1 } },
  { free: { kind: "shield", amount: 1 }, royal: { kind: "title", value: "Mischief Maker" } },
  { free: { kind: "boost", amount: 1 }, royal: { kind: "theme", value: "rose" } },
  { free: { kind: "title", value: "Unstoppable" }, royal: { kind: "boost", amount: 2 } },
  { free: { kind: "token", amount: 1 }, royal: { kind: "shield", amount: 2 } },
  { free: { kind: "theme", value: "forest" }, royal: { kind: "title", value: "The Saboteur" } },
  { free: { kind: "boost", amount: 1 }, royal: { kind: "token", amount: 2 } },
  { free: { kind: "title", value: "Season Finisher" }, royal: { kind: "title", value: "Royalty" } }
];

export function rewardLabel(reward: Reward): { label: string; icon: IconName } {
  switch (reward.kind) {
    case "title":
      return { label: `"${reward.value}" title`, icon: "ribbon" };
    case "theme":
      return { label: `${reward.value === "gold" ? "Royal Gold" : reward.value === "rose" ? "Neon Rose" : reward.value[0].toUpperCase() + reward.value.slice(1)} theme`, icon: "color-palette" };
    case "shield":
      return { label: `${reward.amount}× Shield`, icon: "shield-checkmark" };
    case "boost":
      return { label: `${reward.amount}× 2x Boost`, icon: "rocket" };
    case "token":
      return { label: `${reward.amount}× Sabotage token`, icon: "flame" };
  }
}

export function seasonInfo(state: State, today: string) {
  const key = today.slice(0, 7);
  const inSeason = state.completions.filter((c) => c.date.startsWith(key));
  const xp = inSeason.reduce((sum, c) => sum + c.points, 0);
  const maxXp = TIER_XP * passTiers.length;
  const tier = Math.min(passTiers.length, Math.floor(xp / TIER_XP));
  const [year, month] = key.split("-").map(Number);
  const end = new Date(year, month, 0); // last day of this month
  const now = new Date(`${today}T12:00:00`);
  const daysLeft = Math.max(1, Math.round((end.getTime() - now.getTime()) / 86400000) + 1);
  const name = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long" });
  return {
    key,
    name,
    xp,
    maxXp,
    tier,
    tierProgress: tier >= passTiers.length ? 1 : (xp % TIER_XP) / TIER_XP,
    xpToNext: tier >= passTiers.length ? 0 : TIER_XP - (xp % TIER_XP),
    daysLeft,
    completions: inSeason.length,
    ...royalStatus(state, key, today),
    claims: state.pass[key] ?? { free: [], royal: [] }
  };
}

function royalStatus(state: State, seasonKey: string, today: string) {
  const dailyDates = new Set(state.completions.filter((c) => c.source === "daily").map((c) => c.date));
  const royalDays: RoyalDay[] = Array.from({ length: ROYAL_DAYS }, (_, i) => {
    const date = `${seasonKey}-${String(i + 1).padStart(2, "0")}`;
    const status = dailyDates.has(date) ? "done" : date < today ? "missed" : date === today ? "today" : "upcoming";
    return { day: i + 1, date, status };
  });
  const royal = royalDays.every((d) => d.status === "done");
  const royalMissed = royalDays.some((d) => d.status === "missed");
  return { royal, royalMissed, royalDays, royalDone: royalDays.filter((d) => d.status === "done").length };
}

export function claimReward(state: State, today: string, tierIndex: number, track: "free" | "royal"): { state: State; message: string } {
  const season = seasonInfo(state, today);
  if (tierIndex >= season.tier) return { state, message: "Reach this tier first." };
  if (track === "royal" && !season.royal) return { state, message: "Unlock the Royal track first." };
  if (season.claims[track].includes(tierIndex)) return { state, message: "Already claimed." };

  const reward = passTiers[tierIndex][track];
  const claims = { ...season.claims, [track]: [...season.claims[track], tierIndex] };
  let next: State = { ...state, pass: { ...state.pass, [season.key]: claims } };
  let message = `Unlocked ${rewardLabel(reward).label}!`;

  const owned = (reward.kind === "title" && next.titles.includes(reward.value)) || (reward.kind === "theme" && next.themes.includes(reward.value));
  if (owned) {
    // Already earned in an earlier season: give something useful instead.
    next = { ...next, inventory: { ...next.inventory, boosts: next.inventory.boosts + 1 } };
    message = "You already own that, so here's a 2x Boost instead!";
  } else if (reward.kind === "title") {
    next = { ...next, titles: [...next.titles, reward.value], title: next.title ?? reward.value };
  } else if (reward.kind === "theme") {
    next = { ...next, themes: [...next.themes, reward.value] };
  } else {
    const field = reward.kind === "shield" ? "shields" : reward.kind === "boost" ? "boosts" : "sabotageTokens";
    next = { ...next, inventory: { ...next.inventory, [field]: next.inventory[field] + reward.amount } };
  }
  return { state: next, message };
}

export function claimableCount(state: State, today: string) {
  const season = seasonInfo(state, today);
  let count = 0;
  for (let i = 0; i < season.tier; i++) {
    if (!season.claims.free.includes(i)) count++;
    if (season.royal && !season.claims.royal.includes(i)) count++;
  }
  return count;
}
