import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import * as api from "./backend";
import { checkRedeemable, currentStreak, log, Payload, recordDareSent, recordSabotageSent, redeem, sabotageInfo, totalPoints } from "./game";
import { Completion, ExtraChallenge, Proof, SabotageKind, State } from "./storage";
import { colors } from "./theme";

type Tone = "success" | "info" | "danger" | "gold";

export type Social = {
  configured: boolean;
  status: "off" | "connecting" | "ready" | "error";
  error: string | null;
  me: api.Me | null;
  friends: api.Friend[];
  requests: api.FriendRequest[];
  feed: api.FeedPost[];
  refreshing: boolean;
  refresh: () => Promise<void>;
  retry: () => void;
  addFriend: (code: string) => Promise<boolean>;
  respond: (request: api.FriendRequest, accept: boolean) => Promise<void>;
  removeFriend: (friend: api.Friend) => Promise<void>;
  sendDare: (friend: api.Friend, dare: api.DarePayload) => Promise<boolean>;
  sendSabotage: (friend: api.Friend, kind: SabotageKind) => Promise<boolean>;
  /** Call after any completion: uploads proof and tells the friend their dare is done. */
  completed: (completion: Completion, extra?: ExtraChallenge) => void;
  /** Call after adding proof to an earlier completion. */
  proofAdded: (title: string, proofs: Proof[]) => void;
};

type Options = {
  state: State | null;
  getState: () => State | null;
  update: (next: State) => void;
  toast: (message: string, tone?: Tone) => void;
  today: string;
};

export function useSocial({ state, getState, update, toast, today }: Options): Social {
  const configured = api.backendConfigured;
  const [status, setStatus] = useState<Social["status"]>(configured ? "connecting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<api.Me | null>(null);
  const [friends, setFriends] = useState<api.Friend[]>([]);
  const [requests, setRequests] = useState<api.FriendRequest[]>([]);
  const [feed, setFeed] = useState<api.FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const prompting = useRef(false);
  const busy = useRef(false);
  const todayRef = useRef(today);
  todayRef.current = today;

  const onboarded = !!state?.onboarded;

  // ---- Connect once the player has a name ----
  useEffect(() => {
    if (!configured || !onboarded) return;
    let cancelled = false;
    setStatus("connecting");
    setError(null);
    api
      .connect(getState()?.name ?? "")
      .then((result) => {
        if (cancelled) return;
        setMe(result);
        setStatus("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [configured, onboarded, attempt, getState]);

  // ---- Incoming dares and sabotages ----
  const applyMessage = useCallback(
    async (message: api.InboxMessage, useShield: boolean) => {
      const current = getState();
      if (!current || !me) return;
      const payload: Payload =
        message.kind === "dare"
          ? { k: "d", i: message.id, u: message.sender, f: message.senderName, t: message.payload.title, d: message.payload.description, p: message.payload.points, ic: message.payload.icon, c: message.payload.color }
          : { k: "s", i: message.id, u: message.sender, f: message.senderName, m: message.payload.kind };
      if (!checkRedeemable(current, payload)) {
        const result = redeem(current, payload, todayRef.current, useShield, true);
        update(result.state);
        toast(result.message, message.kind === "dare" ? "info" : useShield ? "success" : "danger");
      }
      await api.markMessage(message.id, useShield ? "blocked" : "delivered").catch(() => undefined);
    },
    [getState, me, update, toast]
  );

  const processInbox = useCallback(
    async (inbox: api.InboxMessage[]) => {
      for (const message of inbox) {
        const current = getState();
        if (!current) return;
        if (message.kind === "sabotage" && current.inventory.shields > 0) {
          if (prompting.current) continue;
          prompting.current = true;
          const info = sabotageInfo[message.payload.kind];
          Alert.alert(`${message.senderName} sabotaged you!`, `${info.name}: your next challenge gets tougher.\n\nUse a shield to block it? You have ${current.inventory.shields}.`, [
            { text: "Take the hit", style: "destructive", onPress: () => applyMessage(message, false).finally(() => (prompting.current = false)) },
            { text: "Block with shield 🛡️", onPress: () => applyMessage(message, true).finally(() => (prompting.current = false)) }
          ]);
          continue;
        }
        await applyMessage(message, false);
      }
    },
    [applyMessage, getState]
  );

  // ---- What happened to things you sent ----
  const processOutbox = useCallback(
    (updates: api.OutboxUpdate[]) => {
      let current: State | null = getState();
      if (!current) return;
      let changed = false;
      for (const u of updates) {
        const known: string | undefined = current.outbox[u.id];
        if (known === u.status) continue;
        if (known !== undefined) {
          if (u.status === "completed") current = log(current, { icon: "trophy", color: colors.gold, text: `${u.recipientName} completed your dare "${u.title ?? ""}"` });
          if (u.status === "blocked") current = log(current, { icon: "shield-checkmark", color: colors.success, text: `${u.recipientName} blocked your ${u.sabotage ? sabotageInfo[u.sabotage].name : "sabotage"} with a shield` });
          if (u.status === "completed") toast(`${u.recipientName} completed your dare! 🏆`, "gold");
          if (u.status === "blocked") toast(`${u.recipientName} blocked your sabotage 🛡️`, "info");
        }
        current = { ...current, outbox: { ...current.outbox, [u.id]: u.status } };
        changed = true;
      }
      if (changed) update(current);
    },
    [getState, update, toast]
  );

  const refresh = useCallback(async () => {
    if (!me || busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const social = await api.loadFriends(me);
      setFriends(social.friends);
      setRequests(social.requests);
      await processInbox(await api.fetchInbox(me));
      processOutbox(await api.fetchOutbox(me));
      setFeed(await api.loadFeed(me, social.friends));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, [me, processInbox, processOutbox]);

  // ---- Live updates, plus polling as a backup ----
  useEffect(() => {
    if (!me) return;
    refresh();
    const unsubscribe = api.subscribe(me, () => refresh());
    const timer = setInterval(refresh, 30000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => {
      unsubscribe();
      clearInterval(timer);
      sub.remove();
    };
  }, [me, refresh]);

  // ---- Keep your public profile (leaderboard) up to date ----
  const points = state ? totalPoints(state) : 0;
  const streak = state ? currentStreak(state, today) : 0;
  const name = state?.name ?? "";
  const title = state?.title ?? null;
  useEffect(() => {
    if (!me) return;
    const timer = setTimeout(() => api.syncProfile(me, { name, points, streak, title }).catch(() => undefined), 1200);
    return () => clearTimeout(timer);
  }, [me, name, points, streak, title]);

  // ---- Actions ----
  const addFriend = useCallback(
    async (code: string) => {
      if (!me) return false;
      try {
        toast(await api.addFriend(me, code), "success");
        refresh();
        return true;
      } catch (e) {
        toast((e as Error).message, "danger");
        return false;
      }
    },
    [me, refresh, toast]
  );

  const respond = useCallback(
    async (request: api.FriendRequest, accept: boolean) => {
      try {
        await api.respondToRequest(request.id, accept);
        if (accept) toast(`You and ${request.name} are now friends!`, "success");
        refresh();
      } catch (e) {
        toast((e as Error).message, "danger");
      }
    },
    [refresh, toast]
  );

  const removeFriend = useCallback(
    async (friend: api.Friend) => {
      if (!me) return;
      try {
        await api.removeFriend(me, friend.id);
        setFriends((list) => list.filter((f) => f.id !== friend.id));
        refresh();
      } catch (e) {
        toast((e as Error).message, "danger");
      }
    },
    [me, refresh, toast]
  );

  const sendDare = useCallback(
    async (friend: api.Friend, dare: api.DarePayload) => {
      try {
        const id = await api.sendDare(friend.id, dare);
        const current = getState();
        if (current) update({ ...recordDareSent(current, dare.title, friend.name), outbox: { ...current.outbox, [id]: "sent" } });
        toast(`Dare sent to ${friend.name}! 🔥`, "info");
        return true;
      } catch (e) {
        toast((e as Error).message, "danger");
        return false;
      }
    },
    [getState, update, toast]
  );

  const sendSabotage = useCallback(
    async (friend: api.Friend, kind: SabotageKind) => {
      try {
        const id = await api.sendSabotage(friend.id, kind);
        const current = getState();
        if (current) update({ ...recordSabotageSent(current, kind, todayRef.current, friend.name), outbox: { ...current.outbox, [id]: "sent" } });
        toast(`${sabotageInfo[kind].name} sent to ${friend.name}. Mwahaha 😈`, "danger");
        return true;
      } catch (e) {
        toast((e as Error).message, "danger");
        return false;
      }
    },
    [getState, update, toast]
  );

  const upload = useCallback(
    async (title: string, proofs: Proof[]) => {
      if (!me || !proofs.length || !getState()?.shareProofs) return [];
      try {
        const ids = await api.uploadProofs(me, title, proofs);
        api.loadFeed(me, friends).then(setFeed).catch(() => undefined);
        return ids;
      } catch {
        toast("Saved on your phone, but couldn't upload your proof for friends.", "danger");
        return [];
      }
    },
    [me, friends, getState, toast]
  );

  const completed = useCallback(
    (completion: Completion, extra?: ExtraChallenge) => {
      if (!me) return;
      (async () => {
        const posts = await upload(completion.title, completion.proofs ?? []);
        if (extra?.remoteId) await api.markMessage(extra.remoteId, "completed", { posts }).catch(() => undefined);
      })();
    },
    [me, upload]
  );

  const proofAdded = useCallback((title: string, proofs: Proof[]) => void upload(title, proofs), [upload]);

  return {
    configured,
    status,
    error,
    me,
    friends,
    requests,
    feed,
    refreshing,
    refresh,
    retry: () => setAttempt((n) => n + 1),
    addFriend,
    respond,
    removeFriend,
    sendDare,
    sendSabotage,
    completed,
    proofAdded
  };
}
