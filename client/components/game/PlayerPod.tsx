"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ShieldCheck,
  CheckCircle,
  WifiOff,
  Clock,
  UserCheck,
} from "lucide-react";
import { type Player, type ClientAbilityContext } from "shared-types";
import { cn } from "@/lib/utils";
import PlayerHand from "./PlayerHand";
import React from "react";

export interface PlayerPodProps {
  player: Player;
  isLocalPlayer: boolean;
  isCurrentTurn: boolean;
  onCardClick: (cardIndex: number) => void;
  isTargetable?: boolean;
  abilityContext?: ClientAbilityContext;
  className?: string;
  selectedCardIndex?: number | null;
}

const StatusIndicator = ({
  icon: Icon,
  text,
  colorClass,
}: {
  icon: React.ElementType;
  text: string;
  colorClass: string;
}) => (
  <div
    className={cn("flex items-center gap-1.5 text-xs font-light", colorClass)}
  >
    <Icon className="h-3 w-3" />
    <p>{text}</p>
  </div>
);

export const PlayerPod = ({
  player,
  isLocalPlayer,
  isCurrentTurn,
  onCardClick,
  isTargetable,
  abilityContext,
  className,
  selectedCardIndex,
}: PlayerPodProps) => {
  const getStatus = () => {
    if (player.hasCalledCheck)
      return (
        <StatusIndicator
          icon={ShieldCheck}
          text="Check Called"
          colorClass="text-blue-500"
        />
      );
    if (!player.isConnected)
      return (
        <StatusIndicator
          icon={WifiOff}
          text="Disconnected"
          colorClass="text-red-500"
        />
      );
    if (player.isReady)
      return (
        <StatusIndicator
          icon={CheckCircle}
          text="Ready"
          colorClass="text-emerald-500"
        />
      );
    return (
      <StatusIndicator
        icon={Clock}
        text="Waiting"
        colorClass="text-stone-500 dark:text-stone-400"
      />
    );
  };

  const podVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    },
    exit: { opacity: 0, y: 50 },
  };

  if (isLocalPlayer) {
    return null;
  }

  return (
    <motion.div
      layout
      variants={podVariants}
      initial="hidden"
      animate={{
        ...podVariants.visible,
        scale: isCurrentTurn ? 1.03 : 1,
        y: isCurrentTurn ? -3 : 0,
      }}
      exit="exit"
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border transition-all duration-300",
        isCurrentTurn
          ? "border-emerald-500"
          : "border-stone-200 dark:border-zinc-800",
        isTargetable &&
          "ring-2 ring-offset-2 ring-offset-stone-100 dark:ring-offset-zinc-900 ring-purple-500",
        className,
      )}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <AnimatePresence>
        {isTargetable && (
          <motion.div
            className="absolute inset-0 rounded-xl border border-purple-500 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-full",
              isCurrentTurn
                ? "bg-emerald-100 dark:bg-emerald-900/50"
                : "bg-stone-100 dark:bg-zinc-800",
            )}
          >
            <User
              className={cn(
                "h-4 w-4",
                isCurrentTurn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-stone-500 dark:text-stone-400",
              )}
            />
          </div>
          <span className="font-serif text-base text-stone-800 dark:text-stone-200">
            {player.name}
          </span>
        </div>
        <div className="mt-1 h-4">{getStatus()}</div>
      </div>
      <div className="mt-1 w-full">
        <PlayerHand
          player={player}
          isLocalPlayer={false}
          onCardClick={onCardClick}
          canInteract={!!isTargetable}
          selectedCardIndex={selectedCardIndex}
        />
      </div>
    </motion.div>
  );
};
