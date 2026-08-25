import type { Metadata } from "next";
import RulesContent from "./RulesContent";

export const metadata: Metadata = {
  title: "How to play Check! - full rules and scoring",
  description:
    "The complete rules of Check!: card values, setup, turns, the matching window, King, Queen and Jack abilities, calling Check, and scoring.",
  alternates: { canonical: "/rules" },
  openGraph: {
    title: "Rules · Check!",
    description:
      "Learn Check! in five minutes, then call it at the perfect moment.",
    url: "/rules",
    type: "article",
  },
};

export default function RulesPage() {
  return <RulesContent />;
}
