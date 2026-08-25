import type { Metadata } from "next";
import React from "react";

// A room sets no title of its own, so without this it inherits the root's
// search sentence and a tab mid-game reads the landing page's ad copy.
export const metadata: Metadata = {
  title: "Check!",
};

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
