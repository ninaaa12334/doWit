import AsyncStorage from "@react-native-async-storage/async-storage";

export type Progress = { totalPoints: number; completedDates: string[] };

const STORAGE_KEY = "dowit-progress-v1";
export const emptyProgress: Progress = { totalPoints: 0, completedDates: [] };

export async function loadProgress(): Promise<Progress> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

export async function saveProgress(progress: Progress) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
