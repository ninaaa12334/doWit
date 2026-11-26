# Dowit

Dowit is a daily challenge app built with Expo and React Native.

## Features

- **Daily challenge**: a new challenge every day, with points and a day streak.
- **Create (unlocks at 100 points)**: make your own challenges (10 pts each, up to 3 a day), or send a friend a dare worth 10, 25 or 50 points.
- **Sabotage (unlocks at 1000 points)**: hit a friend with **Double Trouble** (they do their next challenge twice, ×2 points) or **Hard Mode** (a much tougher version, ×3 points). You get 1 free sabotage a day, and you can earn more as tokens.
- **Royal Pass**: each month is a season. Every point you earn that month is season XP, and every 50 XP unlocks a tier (10 tiers). The free track is open to everyone. The gold Royal track (the Royal Pass) is earned by doing the daily challenge on each of the first 5 days of the month, in a row. Miss one of those days and you have to wait for next month. Rewards include themes, titles, 2x Boosts, Shields (block a sabotage) and Sabotage tokens.

### Playing with friends

Connect a free Supabase database to get friend codes, a live leaderboard, instant dares and sabotage, and a shared proof feed. See **[SETUP.md](SETUP.md)**. It takes about 5 minutes.

Without it, dares and sabotages still work as codes you paste into **Friends → Redeem a code**.

## Start the app

```powershell
npm install
npx expo start
```

Install Expo Go on your phone, connect the phone and computer to the same Wi-Fi, then scan the QR code shown in the terminal.
