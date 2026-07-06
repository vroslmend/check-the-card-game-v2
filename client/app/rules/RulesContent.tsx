"use client";

import Link from "next/link";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { ReactNode } from "react";

// One quiet fade-up for every reveal. The variants carry no `ease`/`type`
// fields; the transition sits on the element so a per-instance delay can
// override it without fighting a variant-level transition.
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

const REVEAL_VIEWPORT = { once: true, amount: 0.2 } as const;
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ring";

type SectionMeta = { id: string; num: string; title: string; short?: string };

const SECTIONS: SectionMeta[] = [
  { id: "goal", num: "01", title: "The goal" },
  {
    id: "card-values",
    num: "02",
    title: "The deck and card values",
    short: "Card values",
  },
  { id: "the-table", num: "03", title: "The table" },
  { id: "setup", num: "04", title: "Setup" },
  { id: "your-turn", num: "05", title: "Your turn" },
  { id: "matching", num: "06", title: "Matching" },
  { id: "special-cards", num: "07", title: "Special cards" },
  { id: "check", num: "08", title: "Check and final turns", short: "Check" },
  { id: "scoring", num: "09", title: "Scoring" },
  { id: "fine-print", num: "10", title: "Fine print" },
];

const sec = (id: string): SectionMeta => SECTIONS.find((s) => s.id === id)!;

const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    className={className}
    variants={revealVariants}
    initial="hidden"
    whileInView="visible"
    viewport={REVEAL_VIEWPORT}
    transition={{ duration: 0.5, ease: REVEAL_EASE, delay }}
  >
    {children}
  </motion.div>
);

/** Key terms read in ink against the muted body text. */
const Term = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-ink">{children}</strong>
);

const MetaChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
    {children}
  </span>
);

const RuleSection = ({
  meta,
  figure,
  children,
}: {
  meta: SectionMeta;
  figure?: ReactNode;
  children: ReactNode;
}) => (
  <motion.section
    id={meta.id}
    className="scroll-mt-24 border-t border-hairline py-10 sm:py-14"
    variants={revealVariants}
    initial="hidden"
    whileInView="visible"
    viewport={REVEAL_VIEWPORT}
    transition={{ duration: 0.5, ease: REVEAL_EASE }}
  >
    <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
      {meta.num}
    </p>
    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
      {meta.title}
    </h2>
    <div className="mt-4 max-w-2xl space-y-4 text-[15px] leading-relaxed text-ink-muted sm:text-base">
      {children}
    </div>
    {figure && <div className="mt-8">{figure}</div>}
  </motion.section>
);

const OptionPanel = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="rounded-card border border-hairline p-5">
    <h3 className="text-sm font-bold text-ink">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
  </div>
);

export default function RulesContent() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-ground font-game text-ink">
        <header className="sticky top-0 z-20 border-b border-hairline bg-ground">
          <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-5 sm:px-8">
            <Link
              href="/"
              data-cursor-link
              className={`group flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 ${FOCUS_RING}`}
            >
              <ChevronLeft className="h-4 w-4 text-ink-muted transition-colors group-hover:text-ink" />
              <span className="text-lg font-bold tracking-tight text-ink">
                Check
              </span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-5 sm:px-8">
          <div className="pb-4 pt-12 sm:pt-20">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
              How to play
            </p>
            <h1 className="mt-3 text-5xl font-extrabold tracking-tight sm:text-6xl">
              Rules
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              Check! is a fast-paced card game of strategy, memory, and a
              little luck. Keep your hand’s total low, watch everything, and
              call it when you’re sure.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <MetaChip>2–4 players</MetaChip>
              <MetaChip>52 cards</MetaChip>
              <MetaChip>one round</MetaChip>
            </div>

            <nav
              aria-label="Contents"
              className="mt-12 border-t border-hairline pt-6"
            >
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    data-cursor-link
                    className={`flex items-baseline gap-2 rounded-sm py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink ${FOCUS_RING}`}
                  >
                    <span className="text-xs tabular-nums">{s.num}</span>
                    {s.short ?? s.title}
                  </a>
                ))}
              </div>
            </nav>
          </div>

          <RuleSection meta={sec("goal")}>
            <p>
              Every player tends a small grid of face-down cards. When the
              round ends, all hands are revealed — and the player holding the{" "}
              <Term>lowest total value</Term> wins.
            </p>
            <p>
              You’ll get there by swapping unknown cards for better ones,
              discarding the heavy ones, and matching your way to a smaller
              hand — then ending the round with a confident <Term>“Check”</Term>{" "}
              before anyone can slim down further.
            </p>
          </RuleSection>

          <RuleSection meta={sec("card-values")}>
            <p>
              Check! uses a standard 52-card deck, no jokers.{" "}
              <Term>Aces are worth −1</Term> — the only cards that subtract.
              Number cards score their face value, so a 7 is 7 points.{" "}
              <Term>Jack 11, Queen 12, King 13</Term>: the heaviest cards in
              the deck, though each earns its keep with an ability
              (section 07).
            </p>
          </RuleSection>

          <RuleSection meta={sec("the-table")}>
            <p>Three things live on the table:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Term>The draw pile</Term> — face down. The remaining count
                sits right on the top card’s back.
              </li>
              <li>
                <Term>The discard pile</Term> — face up. Only the top card
                matters, and everyone can see it.
              </li>
              <li>
                <Term>Your hand</Term> — four cards dealt face down in a 2×2
                grid in front of you. You don’t get to look at them… with one
                exception (next section).
              </li>
            </ul>
          </RuleSection>

          <RuleSection meta={sec("setup")}>
            <p>
              Players gather in a lobby and the game master starts the game —{" "}
              <Term>the moment it starts, the lobby locks</Term>; nobody else
              can join.
            </p>
            <p>
              Everyone receives four cards, face down, in a 2×2 grid. Then
              comes the one free look of the game, the{" "}
              <Term>initial peek</Term>: you may secretly look at your{" "}
              <Term>bottom two cards</Term> — just those, just once. Memorize
              them; they go back face down.
            </p>
          </RuleSection>

          <RuleSection meta={sec("your-turn")}>
            <p>
              Turns move around the table. On yours, you <Term>must draw</Term>{" "}
              — one of two ways — and every turn ends with a card landing face
              up on the discard pile.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionPanel title="Draw from the draw pile">
                Look at the card privately, then either <Term>swap</Term> it
                face down into your grid — the card it replaces goes face up
                onto the discard pile — or <Term>discard</Term> the drawn card
                directly if you don’t want it.
              </OptionPanel>
              <OptionPanel title="Take the top discard">
                Only if the pile isn’t sealed (section 06), and{" "}
                <Term>never a King, Queen, or Jack</Term>. You must swap it
                into your grid — and since everyone already knows the card,
                they’ll watch where it lands.
              </OptionPanel>
            </div>
            <p>
              A drawn King, Queen, or Jack does nothing by itself —{" "}
              <Term>abilities trigger only when a special card is discarded</Term>{" "}
              from your hand, never when you tuck one in. And every discard
              immediately opens the matching window (section 06); once it
              closes and any abilities resolve, the turn passes on.
            </p>
            <div>
              <h3 className="text-sm font-bold text-ink">
                If the clock runs out
              </h3>
              <p className="mt-1.5 text-sm">
                Every decision window is limited — 45 seconds by default — so
                nobody can stall the table:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Haven’t drawn? You draw from the draw pile automatically.</li>
                <li>Still holding a deck draw? It’s discarded for you.</li>
                <li>
                  Still holding a discard-pile draw? It’s swapped with the
                  first card in your grid.
                </li>
                <li>An unresolved ability fizzles (section 10).</li>
                <li>
                  Never ready for the initial peek? The peek phase starts
                  without you.
                </li>
              </ul>
            </div>
          </RuleSection>

          <RuleSection meta={sec("matching")}>
            <p>
              The instant <Term>any</Term> card lands face up on the discard
              pile, a short real-time window opens — about{" "}
              <Term>5 seconds</Term> — and every unlocked player,{" "}
              <Term>including whoever just discarded</Term>, may race to throw
              a card of the <Term>exact same rank</Term> from their hand onto
              it.
            </p>
            <p>
              <Term>Hit it</Term>, and your card leaves your hand — one card
              lighter. The pile also <Term>seals</Term>: nobody may draw from
              it until the start of the next turn. Match a special card onto a
              special card and both abilities trigger (section 07).
            </p>
            <p>
              <Term>Miss</Term> — throw a wrong-rank card — and it comes
              straight back with company: you immediately{" "}
              <Term>draw a penalty card</Term>. The window stays open for
              everyone, and you may even try again with a different card.
            </p>
            <p>
              <Term>Pass</Term>, and it’s final for that window — no changing
              your mind. The window closes when someone hits, everyone has
              passed, or time runs out.
            </p>
            <p>
              Two edges worth knowing: match away your <Term>last card</Term>{" "}
              and you’ve automatically called Check (section 08). Balloon to{" "}
              <Term>eight cards</Term> through penalties and you’re{" "}
              <Term>disqualified</Term> — locked out of the round, your hand
              still scored, no way to win. If disqualifications ever leave
              fewer than two active players with no Check in progress, the
              round simply ends.
            </p>
          </RuleSection>

          <RuleSection meta={sec("special-cards")}>
            <p>
              Discarding a King, Queen, or Jack — on your turn or as a match —
              triggers its ability:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Term>King</Term> — peek at any two cards on the table, then
                swap any one card with any other.
              </li>
              <li>
                <Term>Queen</Term> — peek at any one card, then swap any one
                card with any other.
              </li>
              <li>
                <Term>Jack</Term> — no peek, straight to the swap.
              </li>
            </ul>
            <p>
              Both stages are optional — skip the peek, skip the swap, or let
              the whole thing go. And peeking isn’t invisible:{" "}
              <Term>everyone sees which positions you peek at</Term>; only you
              see the faces.
            </p>
            <p>
              When a special is matched onto another special, both abilities
              stack and resolve <Term>last-in, first-out</Term>. Alice discards
              a King; Bob matches it with his own. Bob’s King resolves first —
              then Alice’s.
            </p>
          </RuleSection>

          <RuleSection meta={sec("check")}>
            <p>
              Convinced your total is the lowest at the table? End it. On your
              turn — with nothing else pending, and final turns not already
              underway — <Term>call “Check.”</Term>
            </p>
            <p>
              Your turn ends instantly and you’re <Term>locked</Term>: no more
              turns, no matching, and <Term>your cards can’t be touched</Term>{" "}
              by anyone’s abilities.
            </p>
            <p>
              Everyone else now gets exactly <Term>one last turn</Term>, played
              under the full rules — matching windows, abilities, all of it.
              Nobody else may call Check during final turns.
            </p>
            <p>
              And if a match ever empties your hand outright, that’s an{" "}
              <Term>automatic Check</Term> — same lock, same final turns for
              everyone else.
            </p>
          </RuleSection>

          <RuleSection meta={sec("scoring")}>
            <p>
              After final turns, every hand flips face up and the totals are
              counted — aces still −1. <Term>Lowest total wins.</Term> A tie is
              shared: all tied players win. The game is a single round — one
              Check, one reveal, one winner. Or several.
            </p>
          </RuleSection>

          <RuleSection meta={sec("fine-print")}>
            <dl className="divide-y divide-hairline">
              <div className="py-4 first:pt-0 last:pb-0">
                <dt className="text-sm font-bold text-ink">
                  The draw pile runs dry
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">
                  The discard pile’s top card stays put; everything beneath it
                  shuffles into a fresh face-down draw pile.
                </dd>
              </div>
              <div className="py-4 first:pt-0 last:pb-0">
                <dt className="text-sm font-bold text-ink">
                  Nothing left to draw anywhere
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">
                  If a draw is required — a penalty, say — and neither pile can
                  provide even after reshuffling, the game ends on the spot and
                  hands are scored as they lie.
                </dd>
              </div>
              <div className="py-4 first:pt-0 last:pb-0">
                <dt className="text-sm font-bold text-ink">
                  Fizzled abilities
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">
                  If your ability’s turn on the stack comes up but you’re
                  locked, it fizzles — removed with no effect.
                </dd>
              </div>
            </dl>
          </RuleSection>

          <Reveal>
            <div className="border-t border-hairline py-16 text-center sm:py-24">
              <p className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Ready?
              </p>
              <p className="mt-2 text-ink-muted">
                Lowest hand wins. You know what to do.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/"
                  data-cursor-link
                  className={`flex h-14 items-center justify-center gap-2 rounded-full bg-accent px-8 text-base font-bold text-accent-ink transition-colors hover:bg-accent/90 ${FOCUS_RING}`}
                >
                  Play a round
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </main>

        <footer className="border-t border-hairline">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-2 px-5 py-8 text-xs text-ink-muted sm:flex-row sm:px-8">
            <span>© {new Date().getFullYear()} Check</span>
            <a
              href="https://github.com/vroslmend/check-the-card-game-v2/blob/main/docs/GAME_RULES.md"
              target="_blank"
              rel="noreferrer"
              data-cursor-link
              className={`rounded-sm underline underline-offset-4 transition-colors hover:text-ink ${FOCUS_RING}`}
            >
              Full rulebook on GitHub
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
