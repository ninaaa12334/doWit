import { Social } from "../social";
import { State } from "../storage";

export type Tab = "today" | "create" | "friends" | "pass" | "profile";
export type ToastTone = "success" | "info" | "danger" | "gold";

export type ScreenProps = {
  state: State;
  today: string;
  update: (next: State) => void;
  toast: (message: string, tone?: ToastTone) => void;
  go: (tab: Tab) => void;
  social: Social;
  /** Friend picked from the Friends tab to receive a dare. */
  dareFor: string | null;
  setDareFor: (friendId: string | null) => void;
};
