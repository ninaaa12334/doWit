# Play with friends: online setup

Dowit uses [Supabase](https://supabase.com) (free) for accounts, friends, dares, sabotage and shared proof photos.
You only do this once. Everyone who uses your build of the app joins the same database.

## 1. Create the project (about 3 minutes)

1. Go to https://supabase.com, sign up, and click **New project**. Any name and region works. Save the database password somewhere.
2. When it's ready, open **SQL Editor → New query**. Paste everything from [`supabase/schema.sql`](supabase/schema.sql), then click **Run**.
3. Open **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**.
   (Players don't need an email. Each phone gets its own account automatically.)

## 2. Connect the app

1. In Supabase, open **Project Settings → API** (or click **Connect**). Copy the **Project URL** and the **anon / public** key.
2. In this folder, copy `.env.example` to a new file called `.env` and paste the two values in.
3. Restart the app: `npx expo start` (press `r` if it's already running).

The Friends tab now shows your **friend code**.

## How playing together works

- **Add friends**: share your 6-letter friend code. Your friend types it in Friends → Add a friend, and you accept the request.
- **Leaderboard**: everyone's points, level and streak, updated live.
- **Dares**: Create → Dare a friend → pick them. It appears on their Today screen right away. You get notified when they complete it.
- **Sabotage** (1000+ points): tap 💀 next to a friend. If they have a Shield they get to decide whether to block it.
- **Proof feed**: photos and videos you add to challenges are shared with your friends (you can turn this off on the Me tab).

## Good to know

- The free Supabase plan is plenty for a group of friends (500 MB database, 1 GB of photo/video storage).
- An account lives on the phone. If someone deletes the app, they get a new account and need to re-add friends.
- Points are calculated on each phone, so a determined cheater could fake them. That's fine between friends. A public version would need server-side scoring.
- This repo's `.env` is committed, so the app connects right after cloning. It only holds the publishable key, which is designed to be public; the security rules in `schema.sql` protect the data. **Never** put the `service_role` / secret key in it. If the key is ever abused, rotate it in Supabase → Project Settings → API Keys and update `.env`.
