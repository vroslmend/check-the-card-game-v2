import React, { useState, useEffect } from 'react';
import type { ClientPlayerState } from 'shared-types';
import { motion, AnimatePresence } from 'motion/react';

interface PlayerStatusDisplayProps {
  playerID: string;
  playerState: ClientPlayerState | null;
  isCurrentPlayer: boolean;
  turnTimerExpiresAt?: number | null;
  disconnectGraceTimerExpiresAt?: number | null;
  isViewingPlayer: boolean;
  turnSegmentIdentifier?: string | number;
}

const PlayerStatusDisplay: React.FC<PlayerStatusDisplayProps> = ({
  playerID,
  playerState,
  isCurrentPlayer,
  turnTimerExpiresAt,
  disconnectGraceTimerExpiresAt,
  isViewingPlayer,
  turnSegmentIdentifier,
}) => {
  const [remainingTurnTime, setRemainingTurnTime] = useState<number | null>(null);
  const [remainingGraceTime, setRemainingGraceTime] = useState<number | null>(null);

  // console.log(`[PlayerStatusDisplay-PROP_CHECK] P:${playerID.slice(-4)}, Received turnSegmentIdentifier:`, turnSegmentIdentifier, typeof turnSegmentIdentifier);

  // Effect for Turn Timer
  useEffect(() => {
    if (isCurrentPlayer && turnTimerExpiresAt && turnTimerExpiresAt > Date.now()) {
      const updateTimer = () => {
        const timeLeft = Math.max(0, turnTimerExpiresAt - Date.now());
        setRemainingTurnTime(timeLeft);
        // No need for client-side stop, animation duration handles it
      };
      updateTimer(); // Initial call
      const intervalId = setInterval(updateTimer, 1000); // Update remainingTurnTime state
      return () => clearInterval(intervalId);
    } else if (isCurrentPlayer && turnTimerExpiresAt && turnTimerExpiresAt <= Date.now()) {
      setRemainingTurnTime(0); // Ensure it's 0 if expired on load
    } else {
      setRemainingTurnTime(null);
    }
  }, [isCurrentPlayer, turnTimerExpiresAt]);

  // Effect for Disconnect Grace Timer
  useEffect(() => {
    if (!playerState?.isConnected && disconnectGraceTimerExpiresAt && disconnectGraceTimerExpiresAt > Date.now()) {
      const updateGraceTimer = () => {
        const timeLeft = Math.max(0, disconnectGraceTimerExpiresAt - Date.now());
        setRemainingGraceTime(timeLeft);
      };
      updateGraceTimer();
      const intervalId = setInterval(updateGraceTimer, 1000);
      return () => clearInterval(intervalId);
    } else {
      setRemainingGraceTime(null);
    }
  }, [playerState?.isConnected, disconnectGraceTimerExpiresAt]);

  if (!playerState) {
    return <div className="h-10 text-xs text-gray-400 dark:text-gray-500">Loading...</div>; // Placeholder for loading
  }

  const playerNameFontSize = isViewingPlayer ? 'text-sm font-semibold md:text-base' : 'text-xs font-medium';
  const nameColor = playerState.forfeited ? 'text-gray-500 dark:text-gray-600 italic' : 
                    !playerState.isConnected ? 'text-orange-500 dark:text-orange-400' : 
                    'text-gray-700 dark:text-neutral-300';

  const statusBadge = (
    <AnimatePresence mode="wait">
      {playerState.isLocked ? (
        <motion.span /* Locked Badge */
          key="locked-badge"
          className="ml-1 text-gray-400 dark:text-gray-500 text-[0.6rem] align-middle"
          title="Locked" aria-label="Locked"
          initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
        >🔒</motion.span>
      ) : playerState.hasCalledCheck ? (
        <motion.span /* Called Check Badge */
          key="check-badge"
          className="ml-1 text-amber-600 dark:text-amber-400 text-[0.6rem] align-middle"
          title="Called Check" aria-label="Called Check"
          initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
        >✔️</motion.span>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="flex flex-col items-center justify-center py-1 w-full min-h-[60px] md:min-h-[70px]">
      {/* Player Name and Basic Status */}
      <div className={`flex items-center justify-center mb-0.5`}>
        <h4 className={`text-center font-sans ${playerNameFontSize} ${nameColor} truncate max-w-[120px] md:max-w-[150px]`}>
          {playerState.name || playerID.slice(-6)}
          {isViewingPlayer && !playerState.forfeited && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 font-normal">(You)</span>}
        </h4>
        {!playerState.forfeited && statusBadge}
      </div>

      {/* Forfeit Status */}
      {playerState.forfeited && (
        <motion.div 
          className="text-center text-xs text-red-500 dark:text-red-400 font-semibold uppercase tracking-wider"
          initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
        >
          Forfeited
        </motion.div>
      )}

      {/* Disconnect Grace Period Message */}
      {!playerState.isConnected && !playerState.forfeited && remainingGraceTime !== null && (
        <motion.div 
          className="text-center text-xs text-orange-500 dark:text-orange-400 animate-pulse"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          Reconnecting ({Math.ceil(remainingGraceTime / 1000)}s)
        </motion.div>
      )}
      
      {/* Turn Timer Display */}
      {isCurrentPlayer && !playerState.forfeited && remainingTurnTime !== null && (
        <div className="w-full max-w-[100px] md:max-w-[120px] mt-1">
          <div className="h-1.5 md:h-2 bg-sky-200 dark:bg-sky-700 rounded-full overflow-hidden">
            {(() => {
              const initialWidthPercent = Math.max(0, (remainingTurnTime / TURN_DURATION_MS_CLIENT_REF)) * 100;
              const transitionDurationSeconds = Math.max(0.1, remainingTurnTime / 1000);
              // console.log(`[PlayerStatusDisplay-TimerRender] P:${playerID.slice(-4)}, Key:'${turnSegmentIdentifier}', RTT:${remainingTurnTime}, InitWidth:${initialWidthPercent.toFixed(2)}%, TransDur:${transitionDurationSeconds.toFixed(2)}s`);
              return (
                <motion.div
                  key={turnSegmentIdentifier} // Resets animation on new segment/turn
                  className="h-full bg-sky-500 dark:bg-sky-400"
                  initial={{ width: `${initialWidthPercent}%` }}
                  animate={{ width: '0%' }}
                  transition={{
                    duration: transitionDurationSeconds,
                    ease: 'linear',
                  }}
                />
              );
            })()}
          </div>
          {/* Optional: Show text countdown */}
          {/* <p className="text-center text-[0.6rem] text-sky-600 dark:text-sky-300 mt-0.5">
            {Math.ceil(remainingTurnTime / 1000)}s
          </p> */}
        </div>
      )}
    </div>
  );
};

// Add a client-side reference for TURN_DURATION_MS, as it's used for the animation percentage.
// This should match the server's TURN_DURATION_MS.
const TURN_DURATION_MS_CLIENT_REF = 60 * 1000; // Back to 60s to match server

export default PlayerStatusDisplay; 