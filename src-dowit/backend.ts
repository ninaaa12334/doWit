import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import { AppState, Platform } from "react-native";

import { Proof, SabotageKind } from "./storage";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app has been connected to a Supabase project (see SETUP.md). */
export const backendConfigured = Boolean(URL && KEY);

const supabase: SupabaseClient | null = backendConfigured
  ? createClient(URL!, KEY!, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
    })
  : null;

if (supabase && Platform.OS !== "web") {
  // Keep the login fresh only while the app is open.
  AppState.addEventListener("change", (status) => {
    if (status === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

function db() {
  if (!supabase) throw new Error("Online play isn't set up yet.");
  return supabase;
}

// ---------- Types ----------

export type Me = { id: string; friendCode: string };
export type Friend = { id: string; name: string; points: number; streak: number; title: string | null };
export type FriendRequest = { id: string; userId: string; name: string; incoming: boolean };
export type DarePayload = { title: string; description: string; points: number; icon: string; color: string };
export type InboxMessage =
  | { id: string; sender: string; senderName: string; kind: "dare"; payload: DarePayload }
  | { id: string; sender: string; senderName: string; kind: "sabotage"; payload: { kind: SabotageKind } };
export type OutboxUpdate = { id: string; recipientName: string; kind: "dare" | "sabotage"; status: string; title?: string; sabotage?: SabotageKind };
export type FeedPost = { id: string; userId: string; name: string; title: string; kind: "image" | "video"; url: string; createdAt: string };

// ---------- Account ----------

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid mix-ups
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function friendly(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
  if (/anonymous sign-ins are disabled/i.test(message)) return "Anonymous sign-ins are off in Supabase. Turn them on in Authentication → Sign In / Providers.";
  if (/network|fetch/i.test(message)) return "Can't reach the server. Check your internet connection.";
  return message;
}

/** Signs in (an anonymous account tied to this phone) and makes sure a profile exists. */
export async function connect(name: string): Promise<Me> {
  const client = db();
  let { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw new Error(friendly(error));
    sessionData = (await client.auth.getSession()).data;
  }
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Couldn't sign in.");

  const { data: existing, error: readError } = await client.from("profiles").select("friend_code").eq("id", userId).maybeSingle();
  if (readError) throw new Error(friendly(readError));
  if (existing) return { id: userId, friendCode: existing.friend_code };

  for (let attempt = 0; attempt < 5; attempt++) {
    const friendCode = randomCode();
    const { error } = await client.from("profiles").insert({ id: userId, name: name || "Player", friend_code: friendCode });
    if (!error) return { id: userId, friendCode };
    if (error.code !== "23505") throw new Error(friendly(error)); // 23505 = code already taken, try another
  }
  throw new Error("Couldn't create your profile. Try again.");
}

export async function syncProfile(me: Me, stats: { name: string; points: number; streak: number; title: string | null }) {
  await db()
    .from("profiles")
    .update({ name: stats.name || "Player", points: stats.points, streak: stats.streak, title: stats.title, updated_at: new Date().toISOString() })
    .eq("id", me.id);
}

// ---------- Friends ----------

export async function loadFriends(me: Me): Promise<{ friends: Friend[]; requests: FriendRequest[] }> {
  const client = db();
  const { data: rows, error } = await client.from("friendships").select("id, requester, addressee, status");
  if (error) throw new Error(friendly(error));
  const otherIds = (rows ?? []).map((r) => (r.requester === me.id ? r.addressee : r.requester));
  const profiles = new Map<string, { id: string; name: string; points: number; streak: number; title: string | null }>();
  if (otherIds.length) {
    const { data, error: profileError } = await client.from("profiles").select("id, name, points, streak, title").in("id", otherIds);
    if (profileError) throw new Error(friendly(profileError));
    for (const p of data ?? []) profiles.set(p.id, p);
  }
  const friends: Friend[] = [];
  const requests: FriendRequest[] = [];
  for (const row of rows ?? []) {
    const otherId = row.requester === me.id ? row.addressee : row.requester;
    const profile = profiles.get(otherId);
    if (!profile) continue;
    if (row.status === "accepted") friends.push(profile);
    else requests.push({ id: row.id, userId: otherId, name: profile.name, incoming: row.addressee === me.id });
  }
  friends.sort((a, b) => b.points - a.points);
  return { friends, requests };
}

/** Sends a friend request. If they already asked you, this accepts it instead. */
export async function addFriend(me: Me, code: string): Promise<string> {
  const client = db();
  const clean = code.trim().toUpperCase();
  if (clean === me.friendCode) throw new Error("That's your own code. Send it to a friend!");
  const { data, error } = await client.rpc("find_profile_by_code", { code: clean });
  if (error) throw new Error(friendly(error));
  const found = (data as { id: string; name: string }[] | null)?.[0];
  if (!found) throw new Error("No one has that friend code. Check it and try again.");

  const { data: reverse } = await client.from("friendships").select("id, status").eq("requester", found.id).eq("addressee", me.id).maybeSingle();
  if (reverse) {
    if (reverse.status === "pending") await respondToRequest(reverse.id, true);
    return `You and ${found.name} are now friends!`;
  }
  const { error: insertError } = await client.from("friendships").insert({ requester: me.id, addressee: found.id });
  if (insertError) {
    if (insertError.code === "23505") return `You've already added ${found.name}.`;
    throw new Error(friendly(insertError));
  }
  return `Friend request sent to ${found.name}.`;
}

export async function respondToRequest(id: string, accept: boolean) {
  const client = db();
  const { error } = accept ? await client.from("friendships").update({ status: "accepted" }).eq("id", id) : await client.from("friendships").delete().eq("id", id);
  if (error) throw new Error(friendly(error));
}

export async function removeFriend(me: Me, friendId: string) {
  const { error } = await db()
    .from("friendships")
    .delete()
    .or(`and(requester.eq.${me.id},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${me.id})`);
  if (error) throw new Error(friendly(error));
}

// ---------- Dares and sabotages ----------

export async function sendDare(friendId: string, dare: DarePayload) {
  const { data, error } = await db().from("messages").insert({ recipient: friendId, kind: "dare", payload: dare }).select("id").single();
  if (error) throw new Error(friendly(error));
  return data.id as string;
}

export async function sendSabotage(friendId: string, kind: SabotageKind) {
  const { data, error } = await db().from("messages").insert({ recipient: friendId, kind: "sabotage", payload: { kind } }).select("id").single();
  if (error) throw new Error(friendly(error));
  return data.id as string;
}

function validDare(p: unknown): p is DarePayload {
  const d = p as DarePayload;
  return !!d && typeof d.title === "string" && d.title.length > 0 && d.title.length <= 60 && typeof d.description === "string" && [10, 25, 50].includes(d.points) && typeof d.icon === "string" && /^#[0-9A-Fa-f]{6}$/.test(d.color);
}

export async function fetchInbox(me: Me): Promise<InboxMessage[]> {
  const client = db();
  const { data, error } = await client.from("messages").select("id, sender, kind, payload").eq("recipient", me.id).eq("status", "sent").order("created_at");
  if (error) throw new Error(friendly(error));
  if (!data?.length) return [];
  const { data: senders } = await client.from("profiles").select("id, name").in("id", [...new Set(data.map((m) => m.sender))]);
  const names = new Map((senders ?? []).map((s) => [s.id, s.name as string]));
  const inbox: InboxMessage[] = [];
  for (const m of data) {
    const senderName = names.get(m.sender) ?? "A friend";
    if (m.kind === "dare" && validDare(m.payload)) inbox.push({ id: m.id, sender: m.sender, senderName, kind: "dare", payload: m.payload });
    else if (m.kind === "sabotage" && (m.payload?.kind === "double" || m.payload?.kind === "hard")) inbox.push({ id: m.id, sender: m.sender, senderName, kind: "sabotage", payload: { kind: m.payload.kind } });
    else await markMessage(m.id, "delivered"); // malformed: drop it
  }
  return inbox;
}

export async function markMessage(id: string, status: "delivered" | "blocked" | "completed", result?: Record<string, unknown>) {
  const { error } = await db().from("messages").update({ status, result: result ?? null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(friendly(error));
}

/** What happened to dares/sabotages you sent (blocked, completed...). */
export async function fetchOutbox(me: Me): Promise<OutboxUpdate[]> {
  const client = db();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data, error } = await client.from("messages").select("id, recipient, kind, payload, status").eq("sender", me.id).gte("updated_at", since);
  if (error) throw new Error(friendly(error));
  if (!data?.length) return [];
  const { data: people } = await client.from("profiles").select("id, name").in("id", [...new Set(data.map((m) => m.recipient))]);
  const names = new Map((people ?? []).map((p) => [p.id, p.name as string]));
  return data.map((m) => ({
    id: m.id,
    recipientName: names.get(m.recipient) ?? "Your friend",
    kind: m.kind,
    status: m.status,
    title: m.kind === "dare" ? m.payload?.title : undefined,
    sabotage: m.kind === "sabotage" ? m.payload?.kind : undefined
  }));
}

// ---------- Proof posts ----------

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === "web" || !uri.startsWith("file:")) {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/** Uploads proof photos/videos so friends can see them. Returns the new post ids. */
export async function uploadProofs(me: Me, title: string, proofs: Proof[]): Promise<string[]> {
  const client = db();
  const ids: string[] = [];
  for (const proof of proofs) {
    const extension = proof.kind === "video" ? "mp4" : "jpg";
    const path = `${me.id}/${proof.id}.${extension}`;
    const body = await readBytes(proof.uri);
    const { error: uploadError } = await client.storage.from("proofs").upload(path, body, { contentType: proof.kind === "video" ? "video/mp4" : "image/jpeg", upsert: true });
    if (uploadError) throw new Error(friendly(uploadError));
    const { data, error } = await client.from("posts").insert({ title: title.slice(0, 80), kind: proof.kind, path }).select("id").single();
    if (error) throw new Error(friendly(error));
    ids.push(data.id);
  }
  return ids;
}

export async function loadFeed(me: Me, friends: Friend[]): Promise<FeedPost[]> {
  const client = db();
  const { data, error } = await client.from("posts").select("id, user_id, title, kind, path, created_at").order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error(friendly(error));
  if (!data?.length) return [];
  const { data: signed } = await client.storage.from("proofs").createSignedUrls(data.map((p) => p.path), 60 * 60 * 6);
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const names = new Map(friends.map((f) => [f.id, f.name]));
  return data
    .filter((p) => urls.get(p.path))
    .map((p) => ({ id: p.id, userId: p.user_id, name: p.user_id === me.id ? "You" : names.get(p.user_id) ?? "Friend", title: p.title, kind: p.kind, url: urls.get(p.path)!, createdAt: p.created_at }));
}

// ---------- Live updates ----------

/** Calls onChange whenever something arrives for you or a friend request changes. */
export function subscribe(me: Me, onChange: () => void): () => void {
  const client = db();
  const channel: RealtimeChannel = client
    .channel(`dowit-${me.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient=eq.${me.id}` }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `sender=eq.${me.id}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee=eq.${me.id}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `requester=eq.${me.id}` }, onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
