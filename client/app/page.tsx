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
  useScroll,
  useTransform,
  useSpring,
  useInView,
  AnimatePresence,
  useMotionValueEvent,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronDown, Users, ArrowRight, Menu, X } from "lucide-react";
import { FaGithub, FaSpotify } from "react-icons/fa";
import { BrandMark } from "@/components/ui/BrandMark";
import { HeroCards } from "@/components/ui/HeroCards";
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

const textContainerVariants = {
  hover: {
    transition: {
      staggerChildren: 0.08,
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
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10,
    },
  },
};

const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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

const MetaChip = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
    {children}
  </span>
);

/** Editorial section in the rules page's grammar: numbered kicker, title,
 *  copy on one side, one of the game's own figures on the other. */
const StorySection = ({
  num,
  title,
  figure,
  flip = false,
  children,
}: {
  num: string;
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
            {num}
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
  return (
    <span ref={ref} className="inline-flex items-center gap-2">
      <Signature isInView={inView} />
      <span>&amp;</span>
      <Signature isInView={inView} data={secondSignature} />
    </span>
  );
};

function HomePage() {
  const [showNewGame, setShowNewGame] = useState(false);
  const [showJoinGame, setShowJoinGame] = useState(false);
  const [isCheckHovered, setIsCheckHovered] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrecisionHovered, setIsPrecisionHovered] = useState(false);
  const { isMobile } = useDevice();
  const [, startTransition] = useTransition();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const precisionHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
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

  const checkText = (isCheckHovered ? "Check!" : "Check").split("");

  const { scrollY, scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useMotionValueEvent(scrollY, "change", (latest) => {
    const atTop = latest < 50;
    if (atTop !== isAtTop) {
      setIsAtTop(atTop);
    }
    if (!atTop && isInitialLoad) {
      setIsInitialLoad(false);
    }
  });

  const heroY = useTransform(
    smoothProgress,
    [0, 1],
    shouldReduceMotion ? ["0%", "0%"] : ["0%", "-30%"],
  );

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

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
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
            className="flex items-center gap-3"
          >
            <BrandMark className="h-8" />
            <span className="text-2xl font-extrabold tracking-tight text-ink">
              Check
            </span>
          </a>

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
        <section
          ref={heroRef}
          className="relative flex min-h-[100svh] items-center justify-center"
        >
          <motion.div
            style={{ y: heroY }}
            className="mx-auto w-full max-w-6xl px-5 sm:px-8"
          >
            <div className="grid min-h-[100svh] items-center text-center lg:grid-cols-2 lg:text-left">
              <div className="flex flex-col items-center justify-center space-y-10 lg:items-start">
                <motion.div
                  initial={{ opacity: 0, y: 60 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 1.2,
                    delay: 0.6,
                    ease: [0.6, 0.01, 0.05, 0.95],
                  }}
                  className="space-y-7"
                >
                  <div className="inline-flex items-center gap-3 rounded-full border border-hairline bg-surface px-5 py-2.5">
                    <div className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-sm font-semibold tracking-wide text-ink-muted">
                      Multiplayer card game
                    </span>
                  </div>

                  <div className="space-y-8 text-center lg:text-left">
                    <h1 className="inline-block text-left text-6xl font-extrabold leading-none tracking-tight text-ink sm:text-7xl md:text-8xl xl:text-9xl">
                      <motion.span
                        className="block"
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.8 }}
                      >
                        The
                      </motion.span>
                      <motion.span
                        className="relative ml-8 inline-block"
                        initial={{ opacity: 0, x: -60 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 1.2,
                          delay: 1,
                          ease: [0.6, 0.01, 0.05, 0.95],
                        }}
                      >
                        <motion.span
                          variants={textContainerVariants}
                          initial="initial"
                          whileHover="hover"
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                            }
                            hoverTimeoutRef.current = setTimeout(() => {
                              setIsCheckHovered(true);
                            }, 300);
                          }}
                          onMouseLeave={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                            }
                            setIsCheckHovered(false);
                          }}
                          className="flex"
                          aria-label="Check"
                          data-cursor-icon
                        >
                          <AnimatePresence initial={false}>
                            {checkText.map((char, index) => {
                              if (char === "!") {
                                return (
                                  <motion.span
                                    key={index}
                                    className="inline-block"
                                    initial={{ opacity: 0, width: 0, x: -10 }}
                                    animate={{
                                      opacity: 1,
                                      width: "auto",
                                      x: 0,
                                    }}
                                    exit={{ opacity: 0, width: 0, x: 10 }}
                                    transition={{
                                      duration: 0.3,
                                      ease: "easeInOut",
                                    }}
                                  >
                                    {char}
                                  </motion.span>
                                );
                              }
                              return (
                                <motion.span
                                  key={index}
                                  variants={letterVariants}
                                  className="inline-block"
                                >
                                  {char}
                                </motion.span>
                              );
                            })}
                          </AnimatePresence>
                        </motion.span>
                        <motion.div
                          initial={{ scaleX: 0, originX: 0.5 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            duration: 1.5,
                            delay: 1.6,
                            ease: [0.6, 0.01, 0.05, 0.95],
                          }}
                          className="absolute -bottom-3 left-[52%] h-1 w-[96%] -translate-x-1/2 rounded-full bg-accent"
                        />
                      </motion.span>
                    </h1>

                    <motion.p
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="max-w-lg text-xl font-normal leading-relaxed text-ink-muted"
                    >
                      Outwit your friends in a tense game of memory, strategy,
                      and pure luck. Keep your cards close, your score low, and
                      call "Check" at the perfect moment to snatch victory.
                    </motion.p>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1, delay: 0.7 }}
                      className="flex flex-wrap justify-center gap-2 lg:justify-start"
                    >
                      <MetaChip>2–6 players</MetaChip>
                      <MetaChip>52 cards</MetaChip>
                      <MetaChip>one round</MetaChip>
                      <MetaChip>free</MetaChip>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start"
                  >
                    {isMobile ? (
                      <>
                        <Button
                          size="lg"
                          onClick={handleCreateGame}
                          className="rounded-full bg-accent px-8 py-4 text-lg font-bold text-accent-ink hover:bg-accent/90"
                        >
                          Create a Lobby
                        </Button>
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleJoinGame}
                          className="rounded-full border border-hairline bg-surface px-8 py-4 text-lg font-bold text-ink hover:bg-surface-2"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Join a Lobby
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
                              Create a Lobby
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
                            Join a Lobby
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
                </motion.div>
              </div>

              <div className="relative hidden h-full items-center justify-center lg:flex">
                <HeroCards checkHovered={isCheckHovered} />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isAtTop ? 1 : 0 }}
              transition={
                isInitialLoad
                  ? { delay: 3, duration: 1.5 }
                  : { duration: 0.5, ease: "easeOut" }
              }
              className="absolute bottom-10 left-1/2 -translate-x-1/2"
            >
              <motion.div
                animate={!shouldReduceMotion ? { y: [0, 8, 0] } : {}}
                transition={{
                  repeat: Number.POSITIVE_INFINITY,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="flex cursor-pointer flex-col items-center gap-2 text-ink-muted transition-colors duration-300 hover:text-ink"
                onClick={() => {
                  document
                    .getElementById("how")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className="text-sm font-semibold tracking-wide">
                  How it plays
                </span>
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        <div id="how" className="mx-auto w-full max-w-4xl scroll-mt-20 px-5 sm:px-8">
          <StorySection
            num="01"
            title="A hand you barely know"
            figure={<PileDiagram showHand />}
          >
            <p>
              Four cards land face down in front of you, and you may peek at
              your bottom two, once. From then on it is draw, swap, and
              discard: every card that crosses the table is information, and
              the sharpest memory holds the advantage.
            </p>
          </StorySection>

          <StorySection
            num="02"
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
            num="03"
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
                Your turn to play
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg font-normal text-ink-muted">
                The table is set, the cards are shuffled. All that's missing is
                you.
              </p>

              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  size="lg"
                  onClick={handleCreateGame}
                  className="rounded-full bg-accent px-12 py-4 text-lg font-bold text-accent-ink hover:bg-accent/90"
                  data-cursor-link
                >
                  Create a Lobby
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleJoinGame}
                  className="rounded-full border border-hairline bg-surface px-12 py-4 text-lg font-bold text-ink hover:bg-surface-2"
                  data-cursor-link
                >
                  Join a Lobby
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
            <span className="text-lg font-bold text-ink">Check</span>
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
