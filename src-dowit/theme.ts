import { Ionicons } from "@expo/vector-icons";
import { createContext, useContext } from "react";

export type IconName = keyof typeof Ionicons.glyphMap;

export const colors = {
  bg: "#0B0C16",
  surface: "#151729",
  surfaceHigh: "#1D2038",
  border: "#272B47",
  text: "#F4F5FF",
  muted: "#A3A6C2",
  faint: "#6D7192",
  gold: "#F5B83D",
  goldSoft: "#F5B83D22",
  danger: "#FF4D6D",
  success: "#2BD67B",
  white: "#FFFFFF"
};

export type ThemeId = "violet" | "gold" | "ocean" | "rose" | "forest";

export const themes: Record<ThemeId, { name: string; accent: string }> = {
  violet: { name: "Violet", accent: "#7C5CFF" },
  ocean: { name: "Ocean", accent: "#22B8F0" },
  forest: { name: "Forest", accent: "#2BD67B" },
  rose: { name: "Neon Rose", accent: "#FF4F8B" },
  gold: { name: "Royal Gold", accent: "#F5B83D" }
};

export const radius = { sm: 12, md: 18, lg: 26, pill: 999 };

/** Adds a 2-digit hex alpha to a #RRGGBB colour. */
export function alpha(hex: string, amount: number) {
  const value = Math.round(Math.min(1, Math.max(0, amount)) * 255).toString(16).padStart(2, "0");
  return `${hex}${value}`;
}

export const AccentContext = createContext(themes.violet.accent);
export const useAccent = () => useContext(AccentContext);
