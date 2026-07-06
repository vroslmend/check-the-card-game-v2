import type { Metadata } from "next";
import RulesContent from "./RulesContent";

export const metadata: Metadata = {
  title: "Rules · Check!",
  description:
    "The complete rules of Check!: card values, setup, turns, the matching window, King, Queen and Jack abilities, calling Check, and scoring.",
  openGraph: {
    title: "Rules · Check!",
    description:
      "Learn Check! in five minutes, then call it at the perfect moment.",
    url: "https://check-the-game.vercel.app/rules",
    type: "article",
  },
};

export default function RulesPage() {
  return <RulesContent />;
}
