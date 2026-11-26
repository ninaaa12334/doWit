export type Challenge = {
  title: string;
  description: string;
  /** The tougher version a friend can force on you with a "Hard Mode" sabotage. */
  hard: string;
  points: number;
  icon: string;
  color: string;
};

export const challenges: Challenge[] = [
  { title: "Learn five new words", description: "Pick any topic and write down five words you did not know before.", hard: "Learn 15 new words and use every one of them in a sentence.", points: 20, icon: "book-outline", color: "#7C5CFF" },
  { title: "Take a mindful walk", description: "Walk for 10 minutes and notice three things around you.", hard: "Walk for 30 minutes without your phone and note ten things you notice.", points: 15, icon: "walk-outline", color: "#14B8A6" },
  { title: "Draw something nearby", description: "Choose an everyday object and sketch it for at least five minutes.", hard: "Sketch three different objects for 10 minutes each. No erasing allowed.", points: 20, icon: "color-palette-outline", color: "#FF8A3D" },
  { title: "Help someone today", description: "Do one useful thing for a friend, family member, or classmate.", hard: "Do one useful thing for three different people today.", points: 25, icon: "heart-outline", color: "#FF4F8B" },
  { title: "Read for 15 minutes", description: "Read a book, article, or school text with your phone put away.", hard: "Read for 45 minutes with your phone in another room.", points: 20, icon: "library-outline", color: "#3A86FF" },
  { title: "Stretch and reset", description: "Spend 10 minutes gently stretching your arms, legs, and back.", hard: "Do a 25-minute stretch routine, then finish with 20 squats.", points: 15, icon: "body-outline", color: "#14B8A6" },
  { title: "Write a tiny story", description: "Create a story in exactly six sentences. Any genre is welcome.", hard: "Write three six-sentence stories, each in a different genre.", points: 25, icon: "pencil-outline", color: "#9B5DE5" },
  { title: "Tidy one small space", description: "Organize one drawer, shelf, or part of your desk.", hard: "Tidy an entire room from top to bottom.", points: 15, icon: "sparkles-outline", color: "#F4A261" },
  { title: "Practice a skill", description: "Spend 15 focused minutes improving something you care about.", hard: "Practice for 45 focused minutes, then teach what you learned to someone.", points: 25, icon: "school-outline", color: "#4F8EF7" },
  { title: "Share some gratitude", description: "Tell someone one specific thing you appreciate about them.", hard: "Tell three people one specific thing you appreciate about each of them.", points: 20, icon: "chatbubble-ellipses-outline", color: "#E76F51" },
  { title: "Try a screen-free break", description: "Put all screens aside for 20 minutes and enjoy the pause.", hard: "Go completely screen-free for two hours.", points: 20, icon: "phone-portrait-outline", color: "#2A9D8F" },
  { title: "Ask a great question", description: "Think of one curious question and research a reliable answer.", hard: "Research three curious questions and explain one answer to a friend.", points: 25, icon: "bulb-outline", color: "#E9B308" }
];

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

export function getChallengeForDate(dateKey: string) {
  // The same local date always maps to the same challenge.
  const dayNumber = Math.floor(new Date(`${dateKey}T12:00:00`).getTime() / 86400000);
  return challenges[Math.abs(dayNumber) % challenges.length];
}
