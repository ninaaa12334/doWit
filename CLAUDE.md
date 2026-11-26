# Dowit: notes for Claude

Dowit is a daily-challenge game for friends, built with Expo (SDK 58) and React Native, with a Supabase backend.

## Working with the owner

The owner is new to coding. Do setup and run steps yourself where you can: start servers in the background, open pages on their screen, and use browser logins instead of Terminal prompts. When they need to act (phone, website, GitHub Desktop), give short numbered, click-by-click steps without jargon.

## Run it

```bash
npm install
npx expo start            # add --tunnel so phones on other networks can connect
```

- If `npx` isn't found, Node isn't on PATH. On the owner's Mac it lives in `~/.local/node-*/bin`.
- Phones use the **Expo Go** app (SDK 58). iPhones must be signed in to Expo Go with the same Expo account the CLI is logged in to (`npx expo login --browser`). Android doesn't need that.
- To share with phones, start `npx expo start --tunnel` in the background, read the `exp://` host from `curl -H "expo-platform: ios" -H "accept: application/expo+json" http://localhost:8081/` (`hostUri`), and show the owner a QR code of it.
- Checks: `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform ios`.

## Code map

- `App.tsx`: tabs, toasts, onboarding, holds state.
- `src-dowit/game.ts`: all rules (points, unlocks, sabotage, Royal Pass, share codes). Pure functions.
- `src-dowit/storage.ts`: the `State` shape, saved in AsyncStorage on the phone.
- `src-dowit/social.ts` + `backend.ts`: online play (friends, dares, sabotage, proof feed) through Supabase.
- `src-dowit/media.ts` + `proof.tsx`: photo/video proof (picker, viewer).
- `src-dowit/screens/`: Today, Create, Friends, Pass, Profile.
- `supabase/schema.sql`: tables, row-level security, storage bucket. Safe to re-run.

## Game rules

- Create your own challenges at **100 points**. Sabotage (Double Trouble ×2, Hard Mode ×3) at **1000 points**.
- **Royal Pass**: monthly season, 50 XP per tier, 10 tiers. The Royal track unlocks by doing the daily challenge on each of the **first 5 days of the month, in a row**.
- Proof photo/video: +5 bonus, paid once per completion.

## Backend

Supabase project ref `jbndkbucjykkdcfwtaic`, with anonymous sign-ins enabled. `.env` (committed on purpose) holds only the URL and the publishable key. Never commit the service_role/secret key. Free tier: the project pauses after about a week idle, so tell the owner to click "Resume project" if the app can't connect.

## Git

Repo: github.com/ninaaa12334/doWit (public). The owner pushes with GitHub Desktop.
