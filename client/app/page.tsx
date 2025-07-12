"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
  useContext,
  useMemo,
} from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionValue,
  AnimatePresence,
  useMotionValueEvent,
  MotionValue,
  useMotionTemplate,
  useReducedMotion,
} from "framer-motion";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ChevronDown,
  Spade,
  Heart,
  Diamond,
  Users,
  ArrowRight,
} from "lucide-react";
import { Menu, X } from "lucide-react";
import { FaGithub, FaSpotify, FaDiscord } from "react-icons/fa";
import { OptimizedShapes } from "@/components/ui/OptimizedShapes";
import { PrincipleCard } from "@/components/ui/PrincipleCard";
import { CardStack } from "@/components/ui/CardStack";
import { AnimateOnView } from "@/components/ui/AnimateOnView";
import { Signature } from "@/components/ui/Signature";
import { Scrollytelling } from "@/components/ui/Scrollytelling";
import { socket } from "@/lib/socket";
import { useRouter } from "next/navigation";
import { NewGameModal } from "@/components/modals/NewGameModal";
import { JoinGameModal } from "@/components/modals/JoinGameModal";
import { useDevice } from "@/context/DeviceContext";
import { PlayingCard } from "@/components/cards/PlayingCard";
import type { Card } from "shared-types";
import { ScrollContainerContext } from "./providers";
import { cn } from "@/lib/utils";
import { Suit, CardRank } from "shared-types";
import { HeroAnimation } from "@/components/ui/HeroAnimation";

function useWindowSize() {
  // Initialise with 0 so that the very first render is identical on
  // the server **and** on the client. The real size is read once the
  // component mounts (after hydration) to avoid HTML mismatches.
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", handleResize);
    handleResize(); // Set initial size

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

const textContainerVariants = {
  hover: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0,
    },
  },
};

const letterVariants = {
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

function FeatureItem({
  index,
  feature,
  continuousActiveCard,
}: {
  index: number;
  feature: { title: string; description: string };
  continuousActiveCard: MotionValue<number>;
}) {
  const diff = useTransform(continuousActiveCard, (latest) => index - latest);

  const opacity = useTransform(
    diff,
    [-1, -0.5, 0, 0.5, 1],
    [0.5, 1, 1, 1, 0.5],
  );
  const scale = useTransform(diff, [-1, -0.5, 0, 0.5, 1], [0.9, 1, 1, 1, 0.9]);

  const bgOpacity = useTransform(diff, [-0.5, 0, 0.5], [0, 1, 0]);

  const backgroundColor = useTransform(
    bgOpacity,
    (v) => `rgba(var(--feature-item-bg-rgb), ${v})`,
  );

  const textColor = useTransform(
    bgOpacity,
    [0, 1],
    [`hsl(var(--foreground))`, `hsl(var(--feature-item-text-color-hsl))`],
  );
  const mutedTextColor = useTransform(
    bgOpacity,
    [0, 1],
    [
      `hsl(var(--muted-foreground))`,
      `hsl(var(--feature-item-text-color-hsl) / 0.7)`,
    ],
  );

  return (
    <motion.div
      className="p-8 rounded-3xl"
      style={{
        opacity,
        scale,
        backgroundColor,
      }}
    >
      <motion.h3
        style={{ color: textColor }}
        className="text-2xl font-normal text-stone-900 dark:text-stone-100 mb-3"
      >
        {feature.title}
      </motion.h3>
      <motion.p
        style={{ color: mutedTextColor }}
        className="text-stone-600 dark:text-stone-400 font-light leading-relaxed"
      >
        {feature.description}
      </motion.p>
    </motion.div>
  );
}

function MobileHeroLayout({
  handleCreateGame,
  handleJoinGame,
}: {
  handleCreateGame: () => void;
  handleJoinGame: () => void;
}) {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.6, 0.01, 0.05, 0.95] }}
        className="space-y-8"
      >
        <div className="inline-flex items-center gap-3 rounded-full border border-stone-200/60 bg-white/40 px-6 py-3 backdrop-blur-sm dark:border-stone-800/60 dark:bg-stone-900/40">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-light tracking-wide text-stone-700 dark:text-stone-300">
            Multiplayer Card Experience
          </span>
        </div>

        <div className="space-y-8">
          <h1 className="text-5xl font-light leading-none tracking-tight text-stone-900 dark:text-stone-100 sm:text-6xl">
            <span className="block">The</span>
            <motion.span
              className="relative inline-block font-normal italic"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
            >
              Check
              <motion.div
                initial={{ scaleX: 0, originX: 0.5 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 1.2,
                  delay: 0.8,
                  ease: [0.6, 0.01, 0.05, 0.95],
                }}
                className="absolute -bottom-3 left-1/2 h-1 w-[90%] -translate-x-1/2 bg-gradient-to-r from-stone-900 to-stone-600 dark:from-stone-100 dark:to-stone-400"
              />
            </motion.span>
          </h1>
          <p className="mx-auto max-w-lg text-lg font-light leading-relaxed text-stone-600 dark:text-stone-400">
            Outwit your friends in a tense game of memory, strategy, and pure
            luck. Keep your cards close, your score low, and call
            &quot;Check&quot; at the perfect moment to snatch victory.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={handleCreateGame}
            className="bg-stone-900 px-8 py-4 text-lg font-light text-white dark:bg-stone-100 dark:text-stone-900"
          >
            Create a Lobby
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleJoinGame}
            className="border-2 border-stone-200 bg-white/60 px-8 py-4 text-lg font-light text-stone-900 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100"
          >
            <Users className="mr-2 h-4 w-4" />
            Join a Lobby
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

function HomePage() {
  const [showNewGame, setShowNewGame] = useState(false);
  const [showJoinGame, setShowJoinGame] = useState(false);
  const [isCheckHovered, setIsCheckHovered] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrecisionHovered, setIsPrecisionHovered] = useState(false);
  const { useMobileLayout, isTouchDevice } = useDevice();
  const scrollContainerRef = useContext(ScrollContainerContext);
  const [isPending, startTransition] = useTransition();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const precisionHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { width: windowWidth } = useWindowSize();

  const headerWidthValue = useMemo(() => {
    if (windowWidth <= 640) {
      // Tailwind's sm breakpoint
      return windowWidth * 0.9; // 90% of viewport width
    }
    return 480; // Fixed width for larger screens
  }, [windowWidth]);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const endOfPageRef = useRef<HTMLDivElement>(null);
  const isHeroInView = useInView(heroRef, { amount: 0.3 });
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const shouldReduceMotion = useReducedMotion();

  const isModalOpen = showNewGame || showJoinGame;

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

  const dealtCardVariants = {
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

  const features = [
    {
      title: "Master Your Memory",
      description:
        "Keep track of your cards and your opponents'. A sharp memory is your greatest weapon.",
    },
    {
      title: "Unleash Chaos",
      description:
        "Use special abilities from Jacks, Queens, and Kings to peek, swap, and disrupt your way to victory.",
    },
    {
      title: "Call Their Bluff",
      description:
        "Think you have the lowest score? Call 'Check' to end the round, but be careful—a wrong move could cost you the game.",
    },
  ];

  const { scrollYProgress: footerScrollYProgress } = useScroll({
    target: endOfPageRef,
    container: scrollContainerRef ?? undefined,
    offset: ["start end", "end end"],
  });

  const smoothFooterScrollYProgress = useSpring(footerScrollYProgress, {
    stiffness: 50,
    damping: 25,
  });

  const footerY = useTransform(
    smoothFooterScrollYProgress,
    useMobileLayout ? [0.9, 1] : [0, 0.6],
    ["100%", "0%"],
  );

  const checkText = (isCheckHovered ? "Check!" : "Check").split("");

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 40, stiffness: 200, mass: 0.7 };

  const textX1 = useSpring(
    useTransform(mouseX, [-1, 1], shouldReduceMotion ? [0, 0] : [-15, 15]),
    springConfig,
  );
  const textY1 = useSpring(
    useTransform(mouseY, [-1, 1], shouldReduceMotion ? [0, 0] : [-15, 15]),
    springConfig,
  );
  const textX2 = useSpring(
    useTransform(mouseX, [-1, 1], shouldReduceMotion ? [0, 0] : [-25, 25]),
    springConfig,
  );
  const textY2 = useSpring(
    useTransform(mouseY, [-1, 1], shouldReduceMotion ? [0, 0] : [-25, 25]),
    springConfig,
  );

  const { scrollY, scrollYProgress } = useScroll({
    container: scrollContainerRef ?? undefined,
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Enhanced spring configuration for header animations
  const headerSpringConfig = {
    stiffness: 300,
    damping: 40,
    mass: 0.8,
  };

  // Header animation logic - start transitions after user scrolls to preserve original header
  const SCROLL_THRESHOLD = 120;
  const SCROLL_START = 80; // Start transition much later to preserve normal header
  const [isDocked, setIsDocked] = useState(false);

  // Reuse existing scrollY from useScroll above
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsDocked(latest > SCROLL_START);
  });

  // Enhanced header animations with spring-based smoothing - keep original normal state, dramatic dock state
  const rawHeaderHeight = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["96px", "56px"], // Original normal height, much smaller when docked
  );
  const headerHeight = useSpring(rawHeaderHeight, headerSpringConfig);

  // Improved background colors with better opacity and saturation
  const rawHeaderBgLight = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["hsl(0 0% 100% / 0)", "hsl(0 0% 98% / 0.85)"],
  );
  const headerBgLight = useSpring(rawHeaderBgLight, headerSpringConfig);

  const rawHeaderBgDark = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["hsl(0 0% 3% / 0)", "hsl(0 0% 6% / 0.85)"],
  );
  const headerBgDark = useSpring(rawHeaderBgDark, headerSpringConfig);

  // Enhanced backdrop blur with smoother progression
  const rawHeaderBackdropFilter = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["blur(0px)", "blur(20px)"],
  );
  const headerBackdropFilter = useSpring(
    rawHeaderBackdropFilter,
    headerSpringConfig,
  );

  // Refined border with better opacity curve
  const rawHeaderBorderOpacity = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [0, 0.15],
  );
  const headerBorderOpacity = useSpring(
    rawHeaderBorderOpacity,
    headerSpringConfig,
  );

  // Smooth positioning and sizing to prevent layout shift
  const rawHeaderTranslateY = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [0, 24], // Move down more from the top
  );
  const headerTranslateY = useSpring(rawHeaderTranslateY, headerSpringConfig);

  // Combine header height and translateY so the placeholder always
  // reserves the exact vertical space the header occupies in the viewport.
  const placeholderHeight = useMotionTemplate`calc(${headerHeight} + ${headerTranslateY}px)`;

  const rawHeaderWidth = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["100%", `${headerWidthValue}px`], // Use responsive width
  );
  const headerWidth = useSpring(rawHeaderWidth, headerSpringConfig);

  // Smooth left positioning to prevent layout shift
  const rawHeaderLeft = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["0%", "50%"], // Smooth transition from left edge to center
  );
  const headerLeft = useSpring(rawHeaderLeft, headerSpringConfig);

  // Smooth x transform to prevent layout shift
  const rawHeaderX = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["0%", "-50%"], // Smooth transition to center alignment
  );
  const headerX = useSpring(rawHeaderX, headerSpringConfig);

  const rawHeaderRadius = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["0px", "32px"],
  );
  const headerRadius = useSpring(rawHeaderRadius, headerSpringConfig);

  // Enhanced shadow for better depth perception
  const rawHeaderShadow = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    ["0 0 0 0 rgba(0, 0, 0, 0)", "0 8px 32px -4px rgba(0, 0, 0, 0.12)"],
  );
  const headerShadow = useSpring(rawHeaderShadow, headerSpringConfig);

  // Restore original normal state, dramatic dock state
  const rawInnerPadding = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [24, 8], // Original normal padding, much tighter when docked
  );
  const innerPadding = useSpring(rawInnerPadding, headerSpringConfig);

  const rawLogoScale = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [1, 0.7], // More aggressive scaling
  );
  const logoScale = useSpring(rawLogoScale, headerSpringConfig);

  // Navigation gap animation - restore original normal state
  const rawNavGap = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [48, 16], // Tighter gap when docked
  );
  const navGap = useSpring(rawNavGap, headerSpringConfig);

  // Navigation item scaling for compact dock
  const rawNavScale = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [1, 0.8], // More aggressive scaling
  );
  const navScale = useSpring(rawNavScale, headerSpringConfig);

  // Horizontal padding - restore original normal state
  const rawHorizontalPadding = useTransform(
    scrollY,
    [SCROLL_START, SCROLL_THRESHOLD],
    [16, 12], // Tighter padding when docked
  );
  const horizontalPadding = useSpring(rawHorizontalPadding, headerSpringConfig);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const atTop = latest < SCROLL_START; // Use same threshold as dock animation
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
  const shapeY = useTransform(
    smoothProgress,
    [0, 1],
    shouldReduceMotion ? ["0%", "0%"] : ["0%", "20%"],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;

      mouseX.set(x);
      mouseY.set(y);
    },
    [mouseX, mouseY],
  );

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    if (!useMobileLayout && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobileMenuOpen, useMobileLayout]);

  useEffect(() => {
    if (isModalOpen) {
      mouseX.set(0);
      mouseY.set(0);
    }

    const throttle = (func: (e: MouseEvent) => void, limit: number) => {
      let inThrottle: boolean;
      return function (this: any, e: MouseEvent) {
        const context = this;
        if (!inThrottle) {
          func.apply(context, [e]);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    };

    const throttledMouseMove = throttle(handleMouseMove, 16);

    if (!isTouchDevice && !isModalOpen) {
      window.addEventListener("mousemove", throttledMouseMove);
      return () => {
        window.removeEventListener("mousemove", throttledMouseMove);
      };
    }
  }, [isTouchDevice, handleMouseMove, isModalOpen, mouseX, mouseY]);

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

  const isFooterInView = useInView(endOfPageRef, {
    margin: "0px 0px -50px 0px",
  });

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col bg-stone-50 dark:bg-zinc-950 noselect w-full"
      style={{ minHeight: "var(--app-height)" }}
    >
      <NewGameModal isModalOpen={showNewGame} setIsModalOpen={setShowNewGame} />
      <JoinGameModal
        isModalOpen={showJoinGame}
        setIsModalOpen={setShowJoinGame}
      />
      <OptimizedShapes
        mouseX={mouseX}
        mouseY={mouseY}
        scrollY={shapeY}
        shouldReduceMotion={shouldReduceMotion ?? false}
      />

      {/* Dynamic placeholder to prevent layout shift — always reserve exact header space */}
      <motion.div style={{ height: placeholderHeight }} />

      <motion.header
        style={{
          height: isAtTop ? "96px" : headerHeight,
          width: isAtTop ? "100%" : headerWidth,
          y: isAtTop ? 0 : headerTranslateY,
          x: isAtTop ? 0 : headerX,
          left: isAtTop ? 0 : headerLeft,
          backgroundColor: isAtTop
            ? "hsla(0,0%,100%,0)"
            : "var(--header-theme-bg)",
          backdropFilter: isAtTop ? "blur(0px)" : headerBackdropFilter,
          WebkitBackdropFilter: isAtTop ? "blur(0px)" : headerBackdropFilter,
          borderRadius: isAtTop ? "0px" : headerRadius,
          boxShadow: isAtTop ? "none" : headerShadow,
        }}
        className={cn(
          "fixed top-0 z-50 flex flex-col transition-all duration-300 ease-out",
          isDocked && "ring-1 ring-black/8 dark:ring-white/8",
        )}
      >
        {/* Enhanced border with gradient effect */}
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{
            opacity: headerBorderOpacity,
            background: `linear-gradient(135deg,
              rgba(255, 255, 255, 0.6) 0%,
              rgba(255, 255, 255, 0.2) 50%,
              rgba(255, 255, 255, 0.1) 100%)`,
            padding: "1px",
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "xor",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
          }}
        />

        {/* Dynamic theme background */}
        <style>{`
          :root { --header-theme-bg: ${headerBgLight.get()}; }
          .dark { --header-theme-bg: ${headerBgDark.get()}; }
        `}</style>

        <motion.div
          style={{
            paddingTop: isAtTop ? 24 : innerPadding,
            paddingBottom: isAtTop ? 24 : innerPadding,
            paddingLeft: isAtTop ? 16 : horizontalPadding,
            paddingRight: isAtTop ? 16 : horizontalPadding,
          }}
          className="container mx-auto flex items-center justify-between px-4"
        >
          <motion.a
            style={{ scale: isAtTop ? 1 : logoScale }}
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
            className="flex items-center gap-4 cursor-pointer"
            whileHover={{ scale: (isAtTop ? 1 : logoScale.get()) * 1.05 }}
            whileTap={{ scale: (isAtTop ? 1 : logoScale.get()) * 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 1 }}
            >
              <motion.div
                animate={{
                  rotate: !shouldReduceMotion ? [0, 3, -3, 0] : 0,
                  scale: !shouldReduceMotion ? [1, 1.02, 1] : 1,
                }}
                transition={{
                  duration: 6,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900/5 backdrop-blur-sm dark:bg-stone-100/5"
              >
                <Spade className="h-5 w-5 text-stone-900 dark:text-stone-100" />
              </motion.div>
            </motion.div>
            <motion.span
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 1 }}
              className="text-2xl sm:text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100"
            >
              Check
            </motion.span>
          </motion.a>

          <AnimatePresence>
            <motion.nav
              key="desktop-nav"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={cn(
                "items-center lg:flex transition-[opacity,transform]",
                isAtTop && windowWidth > 1024 ? "gap-12 hidden lg:flex" : "gap-4 flex"
              )}
            >
              {isAtTop && windowWidth > 1024 ? (
                <>
                  {["Rules", "Features", "Leaderboard"].map((item, index) => (
                    <motion.div
                      key={item}
                      whileHover={{ y: -2 }}
                      whileTap={{ y: 0, scale: 0.98 }}
                    >
                      <Link
                        href={`#${item.toLowerCase()}`}
                        className="relative block px-3 py-2 text-sm font-light tracking-wide text-stone-600 transition-all duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100/50 dark:hover:bg-stone-800/50"
                        data-cursor-icon
                      >
                        <motion.span
                          className="relative z-10"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        >
                          {item}
                        </motion.span>
                        <motion.div
                          className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-gradient-to-r from-stone-900 to-stone-600 dark:from-stone-100 dark:to-stone-400 rounded-full"
                          initial={{ scaleX: 0, opacity: 0 }}
                          whileHover={{ scaleX: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                            opacity: { duration: 0.2 },
                          }}
                        />
                        <motion.div
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-700"
                          initial={{ opacity: 0, scale: 0.8 }}
                          whileHover={{ opacity: 0.1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      </Link>
                    </motion.div>
                  ))}
                  <ThemeToggle />
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="relative overflow-hidden rounded-xl hover:bg-stone-100/80 dark:hover:bg-stone-800/80 transition-colors duration-200 lg:hidden"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-600"
                      initial={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1, opacity: 0.1 }}
                      transition={{ duration: 0.2 }}
                    />
                    <Menu className="relative z-10" />
                  </Button>
                </>
              )}
            </motion.nav>
          </AnimatePresence>
        </motion.div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100vw" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100vw" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] bg-stone-50 dark:bg-zinc-950 p-8 flex flex-col overscroll-y-contain"
          >
            <div className="flex justify-between items-center">
              <span className="text-3xl font-light tracking-tight text-stone-900 dark:text-stone-100">
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
            <nav className="flex flex-col items-center justify-center flex-1 gap-12 text-2xl">
              {["Rules", "Features", "Leaderboard"].map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1, duration: 0.6 }}
                >
                  <Link
                    href={`#${item.toLowerCase()}`}
                    className="relative font-light tracking-wide text-stone-600 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item}
                  </Link>
                </motion.div>
              ))}
              <div className="mt-8">
                <ThemeToggle />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        {!useMobileLayout && (
          <section
            ref={heroRef}
            className="relative flex min-h-screen items-center justify-center pt-24 md:pt-28 lg:items-stretch lg:pt-0"
          >
            <motion.div
              style={{ y: heroY }}
              className="container relative z-10 mx-auto px-6 md:px-8 lg:px-12"
            >
              <div
                className="grid lg:grid-cols-2 min-h-screen items-center lg:items-start lg:pt-32"
                style={{ perspective: "1000px" }}
              >
                <motion.div className="flex flex-col justify-center items-center lg:items-start space-y-12">
                  <motion.div
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 1.2,
                      delay: 1,
                      ease: [0.6, 0.01, 0.05, 0.95],
                    }}
                    className="space-y-8"
                  >
                    <motion.div
                      className="inline-flex items-center gap-3 rounded-full border border-stone-200/60 bg-white/40 px-6 py-3 backdrop-blur-sm dark:border-stone-800/60 dark:bg-stone-900/40 mt-4 md:mt-6 lg:mt-0"
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.7, 1, 0.7],
                        }}
                        transition={{
                          duration: 2.5,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                        className="h-2 w-2 rounded-full bg-emerald-500"
                      />
                      <span className="text-sm font-light tracking-wide text-stone-700 dark:text-stone-300">
                        Multiplayer Card Experience
                      </span>
                    </motion.div>

                    <div className="space-y-10 text-center lg:text-left">
                      <h1 className="inline-block text-left text-5xl font-light leading-none tracking-tight text-stone-900 dark:text-stone-100 sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl">
                        <motion.span
                          className="block"
                          initial={{ opacity: 0, y: 40 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 1, delay: 1.2 }}
                          style={{
                            x: textX1,
                            y: textY1,
                            willChange: "transform",
                          }}
                        >
                          The
                        </motion.span>
                        <motion.span
                          className="relative ml-8 inline-block font-normal italic"
                          initial={{ opacity: 0, x: -60 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 1.2,
                            delay: 1.5,
                            ease: [0.6, 0.01, 0.05, 0.95],
                          }}
                          style={{
                            x: textX2,
                            y: textY2,
                            willChange: "transform",
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
                              delay: 2.2,
                              ease: [0.6, 0.01, 0.05, 0.95],
                            }}
                            className="absolute -bottom-3 left-[52%] h-1 w-[96%] -translate-x-1/2 bg-gradient-to-r from-stone-900 to-stone-600 dark:from-stone-100 dark:to-stone-400"
                          />
                        </motion.span>
                      </h1>

                      <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="max-w-lg text-xl font-light leading-relaxed text-stone-600 dark:text-stone-400"
                      >
                        Outwit your friends in a tense game of memory, strategy,
                        and pure luck. Keep your cards close, your score low,
                        and call "Check" at the perfect moment to snatch
                        victory.
                      </motion.p>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1, delay: 0.8 }}
                      className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start"
                    >
                      {isTouchDevice ? (
                        <>
                          <Button
                            size="lg"
                            onClick={handleCreateGame}
                            className="bg-stone-900 px-8 py-4 text-lg font-light text-white dark:bg-stone-100 dark:text-stone-900"
                          >
                            Create a Lobby
                          </Button>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={handleJoinGame}
                            className="border-2 border-stone-200 bg-white/60 px-8 py-4 text-lg font-light text-stone-900 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100"
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
                              className="group relative z-10 overflow-hidden rounded-full bg-stone-900 px-8 py-4 text-lg font-light text-white dark:bg-stone-100 dark:text-stone-900"
                            >
                              <span className="pointer-events-none relative z-10 flex items-center gap-2">
                                Create a Lobby
                                <motion.div
                                  animate={{
                                    x: !shouldReduceMotion ? [0, 4, 0] : 0,
                                  }}
                                  transition={{
                                    duration: 2,
                                    repeat: Number.POSITIVE_INFINITY,
                                    ease: "easeInOut",
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </motion.div>
                              </span>
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-stone-800 to-stone-700 dark:from-stone-200 dark:to-stone-300"
                                initial={{ x: "-100%" }}
                                whileHover={{ x: "0%" }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                              />
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
                              className="relative z-10 rounded-full border-2 border-stone-200 bg-white/60 px-8 py-4 text-lg font-light text-stone-900 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100"
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
                </motion.div>

                <div className="relative hidden h-full items-center justify-center lg:flex">
                  {!shouldReduceMotion && !isTouchDevice && (
                    <HeroAnimation
                      mouseX={mouseX}
                      mouseY={mouseY}
                      isCheckHovered={isCheckHovered}
                      shouldReduceMotion={shouldReduceMotion ?? false}
                    />
                  )}
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
                className="absolute bottom-12 left-1/2 -translate-x-1/2"
              >
                <motion.div
                  animate={!shouldReduceMotion ? { y: [0, 8, 0] } : {}}
                  transition={{
                    repeat: Number.POSITIVE_INFINITY,
                    duration: 3,
                    ease: "easeInOut",
                  }}
                  className="flex cursor-pointer flex-col items-center gap-2 text-stone-500 transition-colors duration-300 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300"
                  onClick={() => {
                    document
                      .getElementById("game-principles-anchor")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span className="text-sm font-light tracking-wide">
                    Discover more
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </motion.div>
            </motion.div>
          </section>
        )}
        {useMobileLayout && (
          <MobileHeroLayout
            handleCreateGame={handleCreateGame}
            handleJoinGame={handleJoinGame}
          />
        )}

        <Scrollytelling />

        <section id="leaderboard" className="relative py-40">
          <div className="container px-4 mx-auto">
            <AnimateOnView className="mx-auto max-w-4xl text-center">
              <h2 className="mb-8 text-6xl font-light tracking-tighter text-stone-900 dark:text-stone-100">
                Your Turn to Play
              </h2>
              <p className="mb-16 text-xl font-light text-stone-600 dark:text-stone-400">
                The table is set, the cards are shuffled. All that's missing is
                you.
              </p>

              <div className="flex flex-col gap-6 sm:flex-row sm:justify-center">
                {isTouchDevice ? (
                  <>
                    <Button
                      size="lg"
                      onClick={handleCreateGame}
                      className="rounded-full bg-stone-900 px-12 py-4 text-lg font-light text-white dark:bg-stone-100 dark:text-stone-900"
                    >
                      Create a Lobby
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleJoinGame}
                      className="rounded-full border-2 border-stone-200 bg-white/60 px-12 py-4 text-lg font-light backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100"
                    >
                      Join a Lobby
                    </Button>
                  </>
                ) : (
                  <>
                    <motion.div
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        size="lg"
                        onClick={handleCreateGame}
                        className="rounded-full bg-stone-900 px-12 py-4 text-lg font-light text-white dark:bg-stone-100 dark:text-stone-900"
                        data-cursor-link
                      >
                        Create a Lobby
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleJoinGame}
                        className="rounded-full border-2 border-stone-200 bg-white/60 px-12 py-4 text-lg font-light backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-100"
                        data-cursor-link
                      >
                        Join a Lobby
                      </Button>
                    </motion.div>
                  </>
                )}
              </div>
            </AnimateOnView>
          </div>
        </section>
        <div ref={endOfPageRef} className="h-20" />
      </main>

      <motion.footer
        style={{ y: footerY }}
        className="mt-auto border-t border-stone-200/60 bg-white/80 backdrop-blur-sm dark:border-stone-800/60 dark:bg-zinc-950/80"
      >
        <div className="container mx-auto grid grid-cols-1 items-center gap-y-4 px-4 py-4 text-center lg:grid-cols-3 lg:text-left">
          <div className="hidden lg:flex items-center gap-3 justify-self-start">
            <Spade className="h-5 w-5 text-stone-700 dark:text-stone-300" />
            <span className="text-lg font-light text-stone-900 dark:text-stone-100">
              Check
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-y-1 text-sm font-light text-stone-500 dark:text-stone-500">
            <div className="flex flex-row items-center gap-x-2">
              <div className="flex items-center">
                <span>© {new Date().getFullYear()} Check Card Game.</span>
              </div>
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
            <div className="flex items-center" data-cursor-icon>
              <span>Made by&nbsp;</span>
              <div className="relative h-6 min-w-[5rem] ml-2">
                <motion.div
                  key="signature"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Signature isInView={isFooterInView} />
                </motion.div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 lg:justify-self-end">
            <motion.a
              href="https://github.com/vroslmend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">GitHub</span>
              <FaGithub className="h-5 w-5" />
            </motion.a>
            <motion.a
              href="https://open.spotify.com/user/6tf81fs0qm2akdo4yt1wp1akw"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">Spotify</span>
              <FaSpotify className="h-5 w-5" />
            </motion.a>
            <motion.a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 transition-colors duration-300 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              data-cursor-icon
            >
              <span className="sr-only">Discord</span>
              <FaDiscord className="h-5 w-5" />
            </motion.a>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

export default function Home() {
  return <HomePage />;
}
