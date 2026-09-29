export type Challenge = {
  title: string;
  description: string;
  points: number;
  icon: string;
  color: string;
};

export const challenges: Challenge[] = [
  { title: "Learn five new words", description: "Pick any topic and write down five words you did not know before.", points: 20, icon: "book-outline", color: "#6C5CE7" },
  { title: "Take a mindful walk", description: "Walk for 10 minutes and notice three things around you.", points: 15, icon: "walk-outline", color: "#00A896" },
  { title: "Draw something nearby", description: "Choose an everyday object and sketch it for at least five minutes.", points: 20, icon: "color-palette-outline", color: "#EF8354" },
  { title: "Help someone today", description: "Do one useful thing for a friend, family member, or classmate.", points: 25, icon: "heart-outline", color: "#E84A7F" },
  { title: "Read for 15 minutes", description: "Read a book, article, or school text with your phone put away.", points: 20, icon: "library-outline", color: "#3A86FF" },
  { title: "Stretch and reset", description: "Spend 10 minutes gently stretching your arms, legs, and back.", points: 15, icon: "body-outline", color: "#00A896" },
  { title: "Write a tiny story", description: "Create a story in exactly six sentences. Any genre is welcome.", points: 25, icon: "pencil-outline", color: "#9B5DE5" },
  { title: "Tidy one small space", description: "Organize one drawer, shelf, or part of your desk.", points: 15, icon: "sparkles-outline", color: "#F4A261" },
  { title: "Practice a skill", description: "Spend 15 focused minutes improving something you care about.", points: 25, icon: "school-outline", color: "#457B9D" },
  { title: "Share some gratitude", description: "Tell someone one specific thing you appreciate about them.", points: 20, icon: "chatbubble-ellipses-outline", color: "#E76F51" },
  { title: "Try a screen-free break", description: "Put all screens aside for 20 minutes and enjoy the pause.", points: 20, icon: "phone-portrait-outline", color: "#2A9D8F" },
  { title: "Ask a great question", description: "Think of one curious question and research a reliable answer.", points: 25, icon: "bulb-outline", color: "#F2B705" }
];

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getChallengeForDate(dateKey: string) {
  // The same local date always maps to the same challenge.
  const dayNumber = Math.floor(new Date(`${dateKey}T12:00:00`).getTime() / 86400000);
  return challenges[Math.abs(dayNumber) % challenges.length];
}
