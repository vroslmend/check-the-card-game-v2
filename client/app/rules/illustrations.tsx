"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardRank, Suit, type Card } from "shared-types";
import { ArrowLeftRight, Eye, Lock, type LucideIcon } from "lucide-react";

const card = (id: string, suit: Suit, rank: CardRank): Card => ({
  id,
  suit,
  rank,
});

type SizedCardProps = ComponentProps<typeof PlayingCard> & {
  overlay?: ReactNode;
};

/** PlayingCard sizes its face type with container queries, so it needs a
 *  wrapper with real dimensions — the board's `w-* aspect-[5/7]` idiom. The
 *  overlay slot holds rings and chips above the card, exactly as in play. */
const SizedCard = ({ overlay, className, ...cardProps }: SizedCardProps) => (
  <div className={cn("relative w-14 aspect-[5/7] sm:w-16", className)}>
    <PlayingCard {...cardProps} className="h-full w-full" />
    {overlay}
  </div>
);

/** Corner chip in the board's SlotBadge vocabulary: surface chip, ink glyph;
 *  the icon carries the meaning (eye = peek, arrows = swap, lock = sealed). */
const CornerChip = ({
  icon: Icon,
  label,
  strokeWidth,
}: {
  icon: LucideIcon;
  label?: string;
  strokeWidth?: number;
}) => (
  <span
    aria-label={label}
    className="absolute -top-2 -right-2 z-20 rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
  >
    <Icon className="h-3 w-3" strokeWidth={strokeWidth} />
  </span>
);

/** The informational ring — ink, never accent (accent means "yours to act
 *  on" at the table; these figures only inform). */
const InkRing = ({ children }: { children?: ReactNode }) => (
  <div className="pointer-events-none absolute inset-0.5 z-20 rounded-md ring-[2px] ring-ink">
    {children}
  </div>
);

const Figure = ({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <figure
    className={cn("rounded-card border border-hairline p-5 sm:p-6", className)}
  >
    <div role="img" aria-label={label}>
      {children}
    </div>
    {caption && (
      <figcaption className="mt-4 text-center text-xs font-semibold text-ink-muted">
        {caption}
      </figcaption>
    )}
  </figure>
);

const Pile = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-2">
    {children}
    <span className="text-xs font-semibold text-ink-muted">{label}</span>
  </div>
);

const StepChip = ({ children }: { children: ReactNode }) => (
  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-[11px] font-bold text-ink">
    {children}
  </span>
);

// ---------------------------------------------------------------------------

const VALUE_CARDS: { c: Card; points: string }[] = [
  { c: card("rules-value-AS", Suit.Spades, CardRank.Ace), points: "−1" },
  { c: card("rules-value-7H", Suit.Hearts, CardRank.Seven), points: "7" },
  { c: card("rules-value-JC", Suit.Clubs, CardRank.Jack), points: "11" },
  { c: card("rules-value-QD", Suit.Diamonds, CardRank.Queen), points: "12" },
  { c: card("rules-value-KS", Suit.Spades, CardRank.King), points: "13" },
];

export const CardValuesStrip = () => (
  <Figure
    label="Card values: ace scores minus one, seven scores seven, jack eleven, queen twelve, king thirteen"
    caption="Aces are the only cards that subtract; 2–10 score face value."
  >
    <div className="flex items-start justify-center gap-2 sm:gap-4">
      {VALUE_CARDS.map(({ c, points }) => (
        <div key={c.id} className="flex flex-col items-center gap-2">
          <SizedCard card={c} className="w-12 sm:w-16" />
          <span className="text-sm font-bold text-ink">{points}</span>
        </div>
      ))}
    </div>
  </Figure>
);

export const PileDiagram = ({
  sealed = false,
  showHand = false,
}: {
  sealed?: boolean;
  showHand?: boolean;
}) => (
  <Figure
    label={
      sealed
        ? "The draw pile beside the discard pile, which carries a lock chip: sealed, it can't be drawn from this turn"
        : `The face-down draw pile with its count on the back, the face-up discard pile${showHand ? ", and a player's two-by-two hand" : ""}`
    }
    caption={
      sealed ? (
        <>
          A successful match{" "}
          <strong className="font-semibold text-ink">seals</strong> the pile
          until the next turn.
        </>
      ) : undefined
    }
  >
    <div className="flex flex-wrap items-start justify-center gap-8 sm:gap-12">
      <Pile label="Draw pile">
        <SizedCard faceDown backCount={39} />
      </Pile>
      <Pile label="Discard pile">
        <SizedCard
          card={card("rules-pile-7C", Suit.Clubs, CardRank.Seven)}
          overlay={
            sealed ? (
              <CornerChip
                icon={Lock}
                strokeWidth={2.5}
                label="Sealed: can't be drawn this turn"
              />
            ) : undefined
          }
        />
      </Pile>
      {showHand && (
        <Pile label="A hand">
          <div className="inline-grid grid-cols-2 gap-2">
            {["rules-hand-1", "rules-hand-2", "rules-hand-3", "rules-hand-4"].map(
              (id) => (
                <SizedCard key={id} faceDown className="w-10 sm:w-12" />
              ),
            )}
          </div>
        </Pile>
      )}
    </div>
  </Figure>
);

const SETUP_POSITIONS = [
  "rules-setup-1",
  "rules-setup-2",
  "rules-setup-3",
  "rules-setup-4",
];

export const SetupPeekGrid = () => (
  <Figure
    label="A two-by-two grid of face-down cards; the bottom two carry an eye badge, and you may peek at those once"
    caption="Your bottom two, one look. Then back face down."
  >
    <div className="flex justify-center">
      <div className="inline-grid grid-cols-2 gap-2">
        {SETUP_POSITIONS.map((id, i) => (
          <SizedCard
            key={id}
            faceDown
            overlay={
              i >= 2 ? (
                <InkRing>
                  <CornerChip icon={Eye} />
                </InkRing>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  </Figure>
);

const ABILITIES: { c: Card; icons: LucideIcon[]; text: string }[] = [
  {
    c: card("rules-ability-KS", Suit.Spades, CardRank.King),
    icons: [Eye, Eye, ArrowLeftRight],
    text: "Peek two, then swap one",
  },
  {
    c: card("rules-ability-QH", Suit.Hearts, CardRank.Queen),
    icons: [Eye, ArrowLeftRight],
    text: "Peek one, then swap one",
  },
  {
    c: card("rules-ability-JC", Suit.Clubs, CardRank.Jack),
    icons: [ArrowLeftRight],
    text: "Swap one",
  },
];

export const AbilityTriptych = () => (
  <Figure
    label="King: peek two then swap one. Queen: peek one then swap one. Jack: swap one."
    caption="Eye means peek, arrows mean swap. The same badges appear in play."
  >
    <div className="grid grid-cols-3 gap-3 sm:gap-6">
      {ABILITIES.map(({ c, icons, text }) => (
        <div key={c.id} className="flex flex-col items-center gap-3 text-center">
          <SizedCard card={c} />
          <div className="flex items-center gap-1.5">
            {icons.map((Icon, i) => (
              <span
                key={i}
                className="rounded-full border border-hairline bg-surface p-1 text-ink shadow-sm"
              >
                <Icon className="h-3 w-3" />
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold leading-snug text-ink">{text}</p>
        </div>
      ))}
    </div>
  </Figure>
);

export const LifoStack = () => (
  <Figure
    label="Bob's king of hearts lies on top of Alice's king of spades; Bob's resolves first, then Alice's"
    caption="Matched specials stack. Last in resolves first."
  >
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
      <div className="flex pt-3 pl-2">
        <SizedCard card={card("rules-lifo-KS", Suit.Spades, CardRank.King)} />
        <div className="-ml-6 -mt-3 rotate-3">
          <SizedCard card={card("rules-lifo-KH", Suit.Hearts, CardRank.King)} />
        </div>
      </div>
      <ol className="space-y-2 text-sm text-ink-muted">
        <li className="flex items-center gap-2.5">
          <StepChip>1</StepChip>
          Bob’s King resolves first because it landed last.
        </li>
        <li className="flex items-center gap-2.5">
          <StepChip>2</StepChip>
          Then Alice’s.
        </li>
      </ol>
    </div>
  </Figure>
);
