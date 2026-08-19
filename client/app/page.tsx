"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, ArrowRight, Check, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Signature, secondSignature } from "@/components/ui/Signature";
import { NewGameModal } from "@/components/modals/NewGameModal";
import { JoinGameModal } from "@/components/modals/JoinGameModal";
import { useDevice } from "@/context/DeviceContext";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { Card } from "shared-types";
import { Suit, CardRank } from "shared-types";
import { AbilityTriptych, PileDiagram } from "@/app/rules/illustrations";

const NAV_ITEMS = [
  { label: "How it plays", href: "#how" },
  { label: "Rules", href: "/rules" },
] as const;

const LETTER_STAGGER = 0.08;
const LETTER_LIFT = {
  type: "spring",
  stiffness: 400,
  damping: 10,
} as const;

const textContainerVariants = {
  hover: {
    transition: {
      staggerChildren: LETTER_STAGGER,
      delayChildren: 0,
    },
  },
};

const letterVariants: Variants = {
  initial: {
    y: 0,
  },
  hover: {
    y: -10,
    transition: LETTER_LIFT,
  },
};

/** The mark takes the letters' lift, but it cannot take their stagger: it
 *  mounts after the container has already dealt the delays out, so it waits its
 *  turn on a delay of its own. Zero while the name is announcing itself, where
 *  the mark arrives to letters that are already up and belongs up with them. */
const markLiftVariants: Variants = {
  initial: {
    y: 0,
  },
  hover: (delay: number) => ({
    y: -10,
    transition: { ...LETTER_LIFT, delay },
  }),
};

const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Geometry lifted verbatim from `app/opengraph-image.tsx`, the key art in the
 *  README, so the page and the link preview open on the same image. Left, top
 *  and rotate are set per card rather than derived from a shared pivot: the dip
 *  on the outer pair is what makes the arc peak in the centre, and a pivot
 *  swing produces the opposite. `open` is the hovered pose. */
const CARD_W = 166;
const CARD_H = Math.round((CARD_W * 7) / 5);
const CARD_R = Math.round(CARD_W * 0.1);
const FAN = [
  {
    id: "hero-1",
    left: 0,
    top: 44,
    rotate: -17,
    open: { left: -22, top: 34, rotate: -24 },
    faceUp: false,
    suit: Suit.Spades,
  },
  {
    id: "hero-2",
    left: 96,
    top: 12,
    rotate: -6,
    open: { left: 89, top: 2, rotate: -8.5 },
    faceUp: false,
    suit: Suit.Diamonds,
  },
  {
    id: "hero-3",
    left: 192,
    top: 12,
    rotate: 6,
    open: { left: 199, top: 2, rotate: 8.5 },
    faceUp: false,
    suit: Suit.Clubs,
  },
  {
    id: "hero-4",
    left: 288,
    top: 44,
    rotate: 17,
    open: { left: 310, top: 34, rotate: 24 },
    faceUp: true,
    suit: Suit.Hearts,
  },
];

/** Nunito Sans carries no heart, so the key art draws one. Same path here, so
 *  the two surfaces stay identical, and the other three are drawn onto the same
 *  24 box at the same weight — a typeface's pips would arrive at four different
 *  sizes and turn the hand into four fonts. The club is circles rather than one
 *  contour: three lobes and a stem in a single path have to wind the same way
 *  or the overlaps punch holes in each other. */
const PIP_SHAPES: Record<Suit, ReactNode> = {
  [Suit.Hearts]: (
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  ),
  [Suit.Spades]: (
    <path d="M12 2L6.5 8.5C4.5 10.7 4 12.2 4 13.5A4.5 4.5 0 0 0 11 17.2L10 22h4l-1-4.8a4.5 4.5 0 0 0 7-3.7c0-1.3-.5-2.8-2.5-5L12 2z" />
  ),
  [Suit.Diamonds]: <path d="M12 2.5L19.5 12 12 21.5 4.5 12z" />,
  [Suit.Clubs]: (
    <>
      <circle cx="12" cy="6.8" r="4.2" />
      <circle cx="8" cy="13" r="4.2" />
      <circle cx="16" cy="13" r="4.2" />
      <path d="M12 13c0 4 1 6.5 2.4 9h-4.8c1.4-2.5 2.4-5 2.4-9z" />
    </>
  ),
};

const Pip = ({ suit, size }: { suit: Suit; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    {PIP_SHAPES[suit]}
  </svg>
);

/** The key art's card, not the table's. The board card centres its rank with no
 *  corner index, which caps a fan at about a third of overlap before the rank
 *  disappears; this face carries corner ranks, so it reads at the key art's 42%. */
const ArtCard = ({ faceUp, suit }: { faceUp: boolean; suit: Suit }) => (
  <div
    className={
      faceUp
        ? "flex items-center justify-center border-2 border-hairline bg-surface"
        : "flex items-center justify-center bg-accent"
    }
    style={{ width: CARD_W, height: CARD_H, borderRadius: CARD_R }}
  >
    {faceUp ? (
      <div
        className={
          suit === Suit.Hearts || suit === Suit.Diamonds
            ? "flex h-full w-full flex-col justify-between text-accent"
            : "flex h-full w-full flex-col justify-between text-ink"
        }
        style={{ padding: 20 }}
      >
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: Math.round(CARD_W * 0.27) }}
        >
          A
        </span>
        <span className="flex justify-center">
          <Pip suit={suit} size={Math.round(CARD_W * 0.38)} />
        </span>
        <span
          className="text-right font-extrabold leading-none"
          style={{ fontSize: Math.round(CARD_W * 0.27) }}
        >
          A
        </span>
      </div>
    ) : (
      <Check
        className="text-accent-ink"
        strokeWidth={3}
        style={{
          width: Math.round(CARD_W * 0.22),
          height: Math.round(CARD_W * 0.22),
        }}
      />
    )}
  </div>
);

/** Both faces of one card on a shared 3D plane, so `flipped` turns the card
 *  over rather than crossfading it. The back face is the other side of the same
 *  slot: a hole card turns up an Ace, the Ace turns down. Only the flipped pose
 *  is staggered, so the hand turns over as a wave and rights itself at once. */
const FlipCard = ({
  faceUp,
  suit,
  flipped,
  delay,
}: {
  faceUp: boolean;
  suit: Suit;
  flipped: boolean;
  delay: number;
}) => (
  <div style={{ width: CARD_W, height: CARD_H, perspective: 900 }}>
    <motion.div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d" }}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={{
        type: "spring",
        stiffness: 190,
        damping: 24,
        delay: flipped ? delay : 0,
      }}
    >
      <div
        className="absolute inset-0 shadow-[0_26px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_26px_50px_rgba(0,0,0,0.55)]"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: CARD_R,
        }}
      >
        <ArtCard faceUp={faceUp} suit={suit} />
      </div>
      <div
        className="absolute inset-0 shadow-[0_26px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_26px_50px_rgba(0,0,0,0.55)]"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          borderRadius: CARD_R,
          transform: "rotateY(180deg)",
        }}
      >
        <ArtCard faceUp={!faceUp} suit={suit} />
      </div>
    </motion.div>
  </div>
);

/** The key art's hand, dealt rather than drawn: the cards start squared up on
 *  the middle position and open into the arc. `open` widens the fan while the
 *  lockup or the hand is hovered, the same signal that lifts the wordmark. On
 *  that same signal the hand also turns over: the three hole cards come up as
 *  Aces in sequence, and the one that was already up goes down behind them. */
const HeroFan = ({ open }: { open: boolean }) => {
  const reduced = useReducedMotion();
  const [dealt, setDealt] = useState(false);

  useEffect(() => {
    if (reduced) {
      setDealt(true);
      return;
    }
    const t = setTimeout(() => setDealt(true), 260);
    return () => clearTimeout(t);
  }, [reduced]);

  const stackedLeft = FAN[1]!.left;

  return (
    <div className="relative h-[192px] w-[276px] sm:h-[240px] sm:w-[345px] lg:h-[320px] lg:w-[460px]">
      <div className="absolute left-0 top-0 h-[320px] w-[460px] origin-top-left scale-[0.6] sm:scale-75 lg:scale-100">
        {FAN.map((slot, i) => (
          <motion.div
            key={slot.id}
            className="absolute"
            style={{ top: slot.top, zIndex: i }}
            initial={
              reduced
                ? false
                : { left: stackedLeft, top: slot.top, rotate: 0, opacity: 0 }
            }
            animate={
              !dealt
                ? { left: stackedLeft, top: slot.top, rotate: 0, opacity: 0 }
                : open
                  ? { ...slot.open, opacity: 1 }
                  : {
                      left: slot.left,
                      top: slot.top,
                      rotate: slot.rotate,
                      opacity: 1,
                    }
            }
            transition={{
              type: "spring",
              stiffness: open ? 260 : 150,
              damping: open ? 24 : 21,
              delay: dealt && !reduced && !open ? i * 0.07 : 0,
            }}
          >
            <FlipCard
              faceUp={slot.faceUp}
              suit={slot.suit}
              flipped={dealt && !reduced && open}
              delay={slot.faceUp ? FAN.length * 0.08 : i * 0.08}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

/** The name completes itself on arrival: the letters lift, the mark lands while
 *  they are still up, then they settle around it. On load rather than on hover,
 *  because hover is the one thing a touch visitor never has. */
const ANNOUNCE_LIFT_MS = 650;
const ANNOUNCE_MARK_MS = 950;
const ANNOUNCE_SETTLE_MS = 1400;

/** The rules page's quiet fade-up, reused as the landing's only reveal. */
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
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.5, ease: REVEAL_EASE, delay }}
  >
    {children}
  </motion.div>
);

/** Editorial section in the rules page's grammar: a kicker in the game's own
 *  vocabulary, title, copy on one side, one of the game's figures on the
 *  other. */
const StorySection = ({
  kicker,
  title,
  figure,
  flip = false,
  children,
}: {
  kicker: string;
  title: string;
  figure: ReactNode;
  flip?: boolean;
  children: ReactNode;
}) => (
  <section className="border-t border-hairline py-14 sm:py-20">
    <Reveal>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={flip ? "lg:order-2" : undefined}>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            {kicker}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {title}
          </h2>
          <div className="mt-4 max-w-lg space-y-4 text-base leading-relaxed text-ink-muted">
            {children}
          </div>
        </div>
        <div className={flip ? "lg:order-1" : undefined}>{figure}</div>
      </div>
    </Reveal>
  </section>
);

/** Draws both signatures once their spot scrolls into view. */
const SignatureInView = () => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  // The signatures are drawings with no text in them, so left alone the link
  // they sit in announces as its only readable character, an ampersand.
  return (
    <span ref={ref} className="inline-flex items-center gap-2" aria-hidden>
      <Signature isInView={inView} />
      <span>&amp;</span>
      <Signature isInView={inView} data={secondSignature} />
    </span>
  );
};

function HomePage() {
  const [showNewGame, setShowNewGame] = useState(false);
  const [showJoinGame, setShowJoinGame] = useState(false);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [showMark, setShowMark] = useState(false);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrecisionHovered, setIsPrecisionHovered] = useState(false);
  const { isMobile } = useDevice();
  const [, startTransition] = useTransition();
  const precisionHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shouldReduceMotion = useReducedMotion();

  const getRandomCard = useCallback((): Card => {
    const suits = Object.values(Suit);
    const ranks = Object.values(CardRank);
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    return {
      id: `random-${randomSuit}-${randomRank}-${Math.random()}`,
      suit: randomSuit,
      rank: randomRank,
    };
  }, []);

  const [lobbyCard, setLobbyCard] = useState<Card | null>(null);
  const [joinCard, setJoinCard] = useState<Card | null>(null);

  useEffect(() => {
    setLobbyCard(getRandomCard());
    setJoinCard(getRandomCard());
  }, [getRandomCard]);

  const buttonWithCardVariants = {
    initial: { y: 0 },
    hover: { y: -2 },
  };

  const dealtCardVariants: Variants = {
    initial: {
      x: "-50%",
      y: "-100%",
      rotate: 0,
      opacity: 0,
      scale: 0.85,
      transition: {
        opacity: { duration: 0, ease: "linear" },
        y: { duration: 0.2, ease: "easeOut" },
        rotate: { duration: 0.2, ease: "easeOut" },
        scale: { duration: 0.2, ease: "easeOut" },
      },
    },
    hover: {
      x: "-50%",
      y: "-130%",
      rotate: 8,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 15,
        mass: 0.7,
        delay: 0.1,
        opacity: { delay: 0.2, duration: 0.2 },
      },
    },
  };

  const checkText = (showMark ? "Check!" : "Check").split("");
  // The mark is the last child of the lockup, so it lifts one beat after the
  // letter before it, the same beat the container puts between the letters.
  const markLiftDelay = (checkText.length - 1) * LETTER_STAGGER;
  // One signal for the whole hero: the lockup and the hand each raise it and
  // both read it, so hovering either one anximates the other.
  const isLifted = (isHeroHovered || isAnnouncing) && !shouldReduceMotion;
  const engageHero = {
    onMouseEnter: () => setIsHeroHovered(true),
    onMouseLeave: () => setIsHeroHovered(false),
  };

  useEffect(() => {
    if (shouldReduceMotion) {
      setShowMark(true);
      return;
    }
    const timers = [
      setTimeout(() => setIsAnnouncing(true), ANNOUNCE_LIFT_MS),
      setTimeout(() => setShowMark(true), ANNOUNCE_MARK_MS),
      setTimeout(() => setIsAnnouncing(false), ANNOUNCE_SETTLE_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [shouldReduceMotion]);

  // Restoring scroll is a first-mount concern. Keyed on the menu it also fired
  // on every open and close, which threw the reader back to the top of the page.
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobileMenuOpen, isMobile]);

  const handleCreateGame = () => {
    startTransition(() => {
      setShowNewGame(true);
    });
  };

  const handleJoinGame = () => {
    startTransition(() => {
      setShowJoinGame(true);
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ground font-game noselect">
      <NewGameModal isModalOpen={showNewGame} setIsModalOpen={setShowNewGame} />
      <JoinGameModal
        isModalOpen={showJoinGame}
        setIsModalOpen={setShowJoinGame}
      />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
        className="fixed top-0 z-50 w-full border-b border-hairline bg-ground"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({
                top: 0,
                behavior: shouldReduceMotion ? "auto" : "smooth",
              });
            }}
            className="flex items-center gap-3"
          >
            <BrandMark className="h-8" />
            <span className="text-2xl font-extrabold tracking-tight text-ink">
              Check!
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="relative text-sm font-semibold tracking-wide text-ink-muted transition-colors duration-300 hover:text-ink"
                data-cursor-icon
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>

          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu />
            </Button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100vw" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100vw" }}
            transition={{ duration: 0.5, ease: REVEAL_EASE }}
            className="fixed inset-0 z-[100] flex flex-col overscroll-y-contain bg-ground p-8"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold tracking-tight text-ink">
                Menu
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav className="flex flex-1 flex-col items-center justify-center gap-12 text-2xl">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="font-semibold tracking-wide text-ink-muted transition-colors duration-300 hover:text-ink"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-8">
                <ThemeToggle />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <section className="relative flex min-h-[100svh] items-center">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-5 pb-16 pt-24 sm:px-8 lg:flex-row lg:justify-between lg:gap-16">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.1 }}
                className="flex items-center gap-4 sm:gap-6"
                {...engageHero}
                data-cursor-icon
              >
                <BrandMark className="h-14 sm:h-20 lg:h-24" />
                <h1 className="text-6xl font-extrabold leading-[0.95] tracking-tighter text-ink sm:text-8xl lg:text-9xl">
                  <motion.span
                    variants={textContainerVariants}
                    initial="initial"
                    animate={isLifted ? "hover" : "initial"}
                    className="flex"
                    aria-label="Check!"
                  >
                    <AnimatePresence initial={false}>
                      {checkText.map((char, index) =>
                        char === "!" ? (
                          <motion.span
                            key="mark"
                            className="inline-block"
                            initial={{ opacity: 0, width: 0, x: -10 }}
                            animate={{ opacity: 1, width: "auto", x: 0 }}
                            exit={{ opacity: 0, width: 0, x: 10 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                          >
                            {/* The mark arrives on its own poses, not the
                                container's variants: it mounts after the lift
                                has already fired, so an inherited label
                                resolves once and never tracks the way back
                                down. The lift is its own child, driven by the
                                same signal the letters read. */}
                            <motion.span
                              className="inline-block"
                              variants={markLiftVariants}
                              custom={isAnnouncing ? 0 : markLiftDelay}
                              initial="initial"
                              animate={isLifted ? "hover" : "initial"}
                            >
                              {char}
                            </motion.span>
                          </motion.span>
                        ) : (
                          <motion.span
                            key={index}
                            variants={letterVariants}
                            className="inline-block"
                          >
                            {char}
                          </motion.span>
                        ),
                      )}
                    </AnimatePresence>
                  </motion.span>
                </h1>
              </motion.div>

              <motion.p
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.25 }}
                className="mt-7 text-lg leading-snug text-ink-muted sm:text-2xl"
              >
                You only ever saw two of your cards.
                <br />
                Lowest hand wins.
              </motion.p>

              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.45 }}
                className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
              >
                {isMobile ? (
                  <>
                    <Button
                      size="lg"
                      onClick={handleCreateGame}
                      className="rounded-full bg-accent px-8 py-4 text-lg font-bold text-accent-ink hover:bg-accent/90"
                    >
                      Create a lobby
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleJoinGame}
                      className="rounded-full border border-hairline bg-surface px-8 py-4 text-lg font-bold text-ink hover:bg-surface-2"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Join a lobby
                    </Button>
                  </>
                ) : (
                  <>
                    <motion.div
                      variants={buttonWithCardVariants}
                      className="relative"
                      initial="initial"
                      whileHover="hover"
                      onHoverStart={() => setLobbyCard(getRandomCard())}
                    >
                      <Button
                        size="lg"
                        onClick={handleCreateGame}
                        data-cursor-link
                        className="relative z-10 rounded-full bg-accent px-8 py-4 text-lg font-bold text-accent-ink hover:bg-accent/90"
                      >
                        <span className="pointer-events-none relative z-10 flex items-center gap-2">
                          Create a lobby
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Button>
                      <motion.div
                        variants={dealtCardVariants}
                        className="pointer-events-none absolute left-1/2 top-0 h-32 w-24"
                      >
                        {lobbyCard && (
                          <PlayingCard
                            card={lobbyCard}
                            className="h-full w-full"
                          />
                        )}
                      </motion.div>
                    </motion.div>
                    <motion.div
                      variants={buttonWithCardVariants}
                      className="relative"
                      initial="initial"
                      whileHover="hover"
                      onHoverStart={() => setJoinCard(getRandomCard())}
                    >
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleJoinGame}
                        data-cursor-link
                        className="relative z-10 rounded-full border border-hairline bg-surface px-8 py-4 text-lg font-bold text-ink hover:bg-surface-2"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Join a lobby
                      </Button>
                      <motion.div
                        variants={dealtCardVariants}
                        className="pointer-events-none absolute left-1/2 top-0 h-32 w-24"
                      >
                        {joinCard && (
                          <PlayingCard
                            card={joinCard}
                            className="h-full w-full"
                          />
                        )}
                      </motion.div>
                    </motion.div>
                  </>
                )}
              </motion.div>

              <motion.p
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-6 text-sm font-semibold text-ink-muted"
              >
                Free to play with 2&ndash;6 players in the browser.
              </motion.p>
            </div>

            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="shrink-0"
              {...engageHero}
            >
              <HeroFan open={isLifted} />
            </motion.div>
          </div>
        </section>

        <div
          id="how"
          className="mx-auto w-full max-w-4xl scroll-mt-20 px-5 sm:px-8"
        >
          <StorySection
            kicker="The deal"
            title="A hand you barely know"
            figure={<PileDiagram showHand />}
          >
            <p>
              Four cards land face down in front of you, and you may peek at
              your bottom two, once. From then on it is draw, swap, and discard:
              every card that crosses the table is information, and the sharpest
              memory holds the advantage.
            </p>
          </StorySection>

          <StorySection
            kicker="The specials"
            title="Specials earn their keep"
            figure={<AbilityTriptych />}
            flip
          >
            <p>
              Kings, Queens and Jacks score heavy, but discarding one triggers
              its ability: peek at hidden cards or swap anything on the table.
              Everyone sees which cards you touch. Only you see the faces.
            </p>
          </StorySection>

          <StorySection
            kicker="The call"
            title="One call ends it"
            figure={
              <div className="rounded-card border border-hairline p-10 sm:p-14">
                <div className="flex flex-col items-center text-center">
                  <span className="-rotate-2 text-5xl font-extrabold leading-none tracking-tight text-ink sm:text-6xl">
                    CHECK.
                  </span>
                  <span className="mt-4 text-xs font-semibold text-ink-muted">
                    Your hand locks. Everyone gets one last turn.
                  </span>
                </div>
              </div>
            }
          >
            <p>
              Convinced your total is the lowest? Call Check. Your hand locks,
              every other player takes one final turn, then all cards flip and
              the lowest hand wins the round.
            </p>
          </StorySection>
        </div>

        <section id="play" className="border-t border-hairline py-24 sm:py-32">
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <Reveal className="text-center">
              <h2 className="text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
                Play a round
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg font-normal text-ink-muted">
                Create a lobby and send the link to your friends. No account
                needed.
              </p>

              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  onClick={handleCreateGame}
                  className="rounded-full bg-accent px-12 py-4 text-lg font-bold text-accent-ink hover:bg-accent/90"
                  data-cursor-link
                >
                  Create a lobby
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleJoinGame}
                  className="rounded-full border border-hairline bg-surface px-12 py-4 text-lg font-bold text-ink hover:bg-surface-2"
                  data-cursor-link
                >
                  Join a lobby
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface-2">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-y-4 px-5 py-6 text-center sm:grid-cols-3 sm:px-8 sm:text-left">
          <div className="hidden items-center gap-3 justify-self-start sm:flex">
            <BrandMark className="h-6 rounded-[4px]" />
            <span className="text-lg font-bold text-ink">Check!</span>
          </div>
          <div className="flex items-center justify-center text-sm font-normal text-ink-muted">
            <div className="flex flex-row items-center gap-x-2">
              <span>© {new Date().getFullYear()} Check Card Game.</span>
              <div className="hidden sm:block">|</div>
              <div
                className="flex items-center"
                onMouseEnter={() => {
                  if (precisionHoverTimeoutRef.current) {
                    clearTimeout(precisionHoverTimeoutRef.current);
                  }
                  setIsPrecisionHovered(true);
                }}
                onMouseLeave={() => {
                  precisionHoverTimeoutRef.current = setTimeout(() => {
                    setIsPrecisionHovered(false);
                  }, 500);
                }}
                data-cursor-icon
              >
                <span>Crafted with&nbsp;</span>
                <div className="relative h-6 min-w-[5rem]">
                  <AnimatePresence>
                    {isPrecisionHovered ? (
                      <motion.span
                        key="passion"
                        className="absolute inset-0 flex items-center justify-start"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        brainrot.
                      </motion.span>
                    ) : (
                      <motion.span
                        key="precision"
                        className="absolute inset-0 flex items-center justify-start"
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        precision.
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm font-normal text-ink-muted sm:justify-self-end">
            <span>Made by</span>
            <a
              href="https://github.com/vroslmend/check-the-card-game-v2"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ammar and Farhan, on GitHub"
              className="inline-flex items-center transition-colors hover:text-accent"
              data-cursor-icon
            >
              <SignatureInView />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return <HomePage />;
}
