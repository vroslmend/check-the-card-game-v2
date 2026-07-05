"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { GameStage, TurnPhase, PlayerActionType, CardRank } from "shared-types";
import { Action } from "./ActionBarComponent";
import {
  createDrawDeckAction,
  createDrawDiscardAction,
  createCallCheckAction,
  createDiscardDrawnCardAction,
  createPassMatchAction,
  createAttemptMatchAction,
  createConfirmAbilityAction,
  createSkipAbilityAction,
  createReadyForPeekAction,
  createPlayerReadyAction,
  createStartGameAction,
} from "./ActionFactories";
import { isDrawnCard } from "@/lib/types";

const MATCHING_STAGE_DURATION_MS = 5000;
// Must match the server's PEEK_DURATION_MS / ABILITY_PEEK_VIEW_DURATION_MS.
const INITIAL_PEEK_DURATION_MS = 10000;
const ABILITY_PEEK_DURATION_MS = 5000;

type ActionControllerContextType = {
  matchAttempt: { cardIndex: number } | null;
  setMatchAttempt: React.Dispatch<
    React.SetStateAction<{ cardIndex: number } | null>
  >;
  getActions: () => Action[];
  getPromptText: () => string | null;
  /** Deadline of the active timed peek (initial or ability), for countdown UI. */
  getTimedIndicator: () => { expireAt: number; durationMs: number } | null;
};

export const ActionControllerContext =
  createContext<ActionControllerContextType | null>(null);

const selectActionControllerProps = (state: UIMachineSnapshot) => {
  const {
    localPlayerId,
    currentGameState,
    currentAbilityContext,
    hasPassedMatch,
  } = state.context;

  // Latest peek deadline (initial peek or ability peek) as primitives so the
  // selector result stays shallow-comparable.
  let peekExpireAt: number | null = null;
  let peekDurationMs = 0;
  for (const vc of state.context.visibleCards) {
    if (vc.expireAt && (peekExpireAt === null || vc.expireAt > peekExpireAt)) {
      peekExpireAt = vc.expireAt;
      peekDurationMs =
        vc.source === "initial-peek"
          ? INITIAL_PEEK_DURATION_MS
          : ABILITY_PEEK_DURATION_MS;
    }
  }

  if (!currentGameState || !localPlayerId) {
    return {
      localPlayer: null,
      isMyTurn: false,
      gameStage: null,
      turnPhase: null,
      matchingOpportunity: null,
      abilityContext: null,
      isAbilityPlayer: false,
      isGameMaster: false,
      canDrawFromDiscard: false,
      allPlayersReady: false,
      hasPassedMatch: false,
      isAbilitySelecting: false,
      peekExpireAt: null as number | null,
      peekDurationMs: 0,
      turnDeadline: null as number | null,
      turnTimerMs: 0,
      serverClockOffset: 0,
    };
  }

  const localPlayer = currentGameState.players[localPlayerId];
  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;
  const topDiscardCard = currentGameState.discardPile.at(-1);
  const isSpecialCard =
    !!topDiscardCard &&
    [CardRank.King, CardRank.Queen, CardRank.Jack].includes(
      topDiscardCard.rank,
    );

  // Type of deep state path is not covered by xstate typing; cast for compile.
  const isViewingPeek = state.matches({
    inGame: { ability: { resolving: "viewingPeek" } },
  } as any);

  const isAbilitySelecting =
    !!currentAbilityContext &&
    currentAbilityContext.playerId === localPlayerId &&
    currentGameState.turnPhase === TurnPhase.ABILITY &&
    ["peeking", "swapping"].includes(currentAbilityContext?.stage ?? "") &&
    !isViewingPeek;

  return {
    localPlayer,
    isMyTurn,
    gameStage: currentGameState.gameStage,
    turnPhase: currentGameState.turnPhase,
    matchingOpportunity: currentGameState.matchingOpportunity,
    abilityContext: currentAbilityContext,
    isAbilityPlayer: currentAbilityContext?.playerId === localPlayerId,
    isGameMaster: currentGameState.gameMasterId === localPlayerId,
    canDrawFromDiscard:
      isMyTurn &&
      !localPlayer?.pendingDrawnCard &&
      !!topDiscardCard &&
      !isSpecialCard &&
      !currentGameState.discardPileIsSealed,
    allPlayersReady: Object.values(currentGameState.players).every(
      (p) => p.isReady,
    ),
    hasPassedMatch,
    isAbilitySelecting,
    peekExpireAt,
    peekDurationMs,
    turnDeadline: currentGameState.turnDeadline,
    turnTimerMs: currentGameState.turnTimerMs,
    serverClockOffset: state.context.serverClockOffset,
  };
};

export const ActionController: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const props = useUISelector(selectActionControllerProps);

  const actorRef = useUIActorRef();
  const { send } = actorRef;

  const [matchAttempt, setMatchAttempt] = useState<{
    cardIndex: number;
  } | null>(null);
  const [callCheckProgress, setCallCheckProgress] = useState(0);
  const [isHoldingCallCheck, setIsHoldingCallCheck] = useState(false);
  const callCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMatchAttempt(null);
    setCallCheckProgress(0);
    setIsHoldingCallCheck(false);
    if (callCheckIntervalRef.current)
      clearInterval(callCheckIntervalRef.current);
  }, [props.gameStage, props.isMyTurn]);

  const clearCallCheckTimers = useCallback(() => {
    setIsHoldingCallCheck(false);
    if (callCheckIntervalRef.current)
      clearInterval(callCheckIntervalRef.current);
    callCheckIntervalRef.current = null;
  }, []);

  const sendEvent = send;

  const handleStartCallCheckHold = useCallback<
    React.PointerEventHandler<HTMLButtonElement>
  >(
    (e) => {
      if (!props.isMyTurn) return;
      setIsHoldingCallCheck(true);
      setCallCheckProgress(0);

      callCheckIntervalRef.current = setInterval(() => {
        setCallCheckProgress((prev) => {
          const newProgress = prev + 4;
          if (newProgress >= 100) {
            clearCallCheckTimers();
            sendEvent({ type: PlayerActionType.CALL_CHECK });
            return 100;
          }
          return newProgress;
        });
      }, 40);
    },
    [props.isMyTurn, sendEvent, clearCallCheckTimers],
  );

  const handleEndCallCheckHold = useCallback<
    React.PointerEventHandler<HTMLButtonElement>
  >(() => {
    clearCallCheckTimers();
  }, [clearCallCheckTimers]);

  const getActions = useCallback((): Action[] => {
    const {
      localPlayer,
      gameStage,
      turnPhase,
      abilityContext,
      isAbilityPlayer,
      isGameMaster,
      allPlayersReady,
      isMyTurn,
      matchingOpportunity,
      hasPassedMatch,
      canDrawFromDiscard,
      isAbilitySelecting,
    } = props;
    const actions: Action[] = [];
    if (!localPlayer || !gameStage) return actions;

    if (
      matchingOpportunity &&
      matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id) &&
      !hasPassedMatch
    ) {
      if (matchAttempt) {
        actions.push(
          createAttemptMatchAction(() => {
            sendEvent({
              type: PlayerActionType.ATTEMPT_MATCH,
              payload: { handCardIndex: matchAttempt.cardIndex },
            });
            setMatchAttempt(null);
          }),
        );
      }
      // The progress button animates the countdown itself; here we only need
      // the starting point and remaining duration. startTimestamp is on the
      // SERVER's clock — convert through the tracked offset so every client
      // counts down from the same instant regardless of device clock skew.
      const serverNowEst = Date.now() + props.serverClockOffset;
      const elapsedMs =
        serverNowEst - (matchingOpportunity.startTimestamp ?? serverNowEst);
      const remainingMs = Math.max(0, MATCHING_STAGE_DURATION_MS - elapsedMs);
      const progressPercent = Math.min(
        (elapsedMs / MATCHING_STAGE_DURATION_MS) * 100,
        100,
      );
      actions.push(
        createPassMatchAction(
          () => sendEvent({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }),
          progressPercent,
          remainingMs,
          false,
          hasPassedMatch,
        ),
      );
      return actions;
    }

    if (abilityContext && isAbilityPlayer && isAbilitySelecting) {
      const {
        type,
        stage,
        sourceCard,
        selectedPeekTargets,
        maxPeekTargets,
        selectedSwapTargets,
      } = abilityContext;

      if (stage === "peeking") {
        const required = maxPeekTargets ?? 0;
        const selected = selectedPeekTargets?.length ?? 0;
        const isDisabled = selected !== required;

        actions.push(
          createConfirmAbilityAction(
            () => sendEvent({ type: "CONFIRM_ABILITY_ACTION" }),
            "Confirm Peek",
            isDisabled,
          ),
        );

        if (sourceCard.rank === "K" || sourceCard.rank === "Q") {
          actions.push(
            createSkipAbilityAction(
              () => sendEvent({ type: "SKIP_ABILITY_STAGE" }),
              "Skip Peek",
            ),
          );
        }
      } else if (stage === "swapping") {
        const required = 2;
        const selected = selectedSwapTargets?.length ?? 0;
        const isDisabled = selected !== required;

        actions.push(
          createConfirmAbilityAction(
            () => sendEvent({ type: "CONFIRM_ABILITY_ACTION" }),
            "Confirm Swap",
            isDisabled,
          ),
        );
        actions.push(
          createSkipAbilityAction(
            () => sendEvent({ type: "SKIP_ABILITY_STAGE" }),
            "Skip Swap",
          ),
        );
      }
      return actions;
    }

    switch (gameStage) {
      case GameStage.WAITING_FOR_PLAYERS:
        if (!localPlayer.isReady)
          actions.push(
            createPlayerReadyAction(() =>
              sendEvent({ type: PlayerActionType.DECLARE_LOBBY_READY }),
            ),
          );
        if (isGameMaster)
          actions.push(
            createStartGameAction(
              () => sendEvent({ type: PlayerActionType.START_GAME }),
              !allPlayersReady,
            ),
          );
        break;
      case GameStage.PLAYING:
      case GameStage.FINAL_TURNS:
        if (isMyTurn) {
          const drawnCardInfo = localPlayer.pendingDrawnCard;
          if (turnPhase === TurnPhase.DRAW && !drawnCardInfo) {
            actions.push(
              createDrawDeckAction(() =>
                sendEvent({ type: PlayerActionType.DRAW_FROM_DECK }),
              ),
            );
            if (canDrawFromDiscard)
              actions.push(
                createDrawDiscardAction(() =>
                  sendEvent({ type: PlayerActionType.DRAW_FROM_DISCARD }),
                ),
              );
          }

          if (isDrawnCard(drawnCardInfo) && drawnCardInfo.source === "deck") {
            actions.push(
              createDiscardDrawnCardAction(() =>
                sendEvent({ type: PlayerActionType.DISCARD_DRAWN_CARD }),
              ),
            );
          }
          if (
            turnPhase === TurnPhase.DRAW &&
            gameStage === GameStage.PLAYING &&
            !drawnCardInfo
          ) {
            actions.push(
              createCallCheckAction(
                handleStartCallCheckHold,
                handleEndCallCheckHold,
                handleEndCallCheckHold,
                callCheckProgress,
                0,
                false,
                isHoldingCallCheck,
              ),
            );
          }
        }
        break;
      case GameStage.INITIAL_PEEK:
        if (!localPlayer.isReady) {
          actions.push(
            createReadyForPeekAction(() =>
              sendEvent({ type: PlayerActionType.DECLARE_READY_FOR_PEEK }),
            ),
          );
        }
        break;
    }
    return actions;
  }, [
    props,
    matchAttempt,
    callCheckProgress,
    isHoldingCallCheck,
    sendEvent,
    handleStartCallCheckHold,
    handleEndCallCheckHold,
  ]);

  const getPromptText = useCallback((): string | null => {
    const {
      localPlayer,
      isMyTurn,
      matchingOpportunity,
      abilityContext,
      isAbilityPlayer,
      hasPassedMatch,
      isAbilitySelecting,
    } = props;
    if (!localPlayer) return null;

    if (matchingOpportunity) {
      if (
        matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id) &&
        !hasPassedMatch
      ) {
        return "Select a card from your hand to attempt a match, or pass.";
      }
      return "Waiting for the matching window to close…";
    }
    if (abilityContext && isAbilityPlayer && isAbilitySelecting) {
      const {
        stage,
        type,
        selectedPeekTargets,
        maxPeekTargets,
        selectedSwapTargets,
      } = abilityContext;
      if (stage === "peeking") {
        const selected = selectedPeekTargets?.length ?? 0;
        const required = maxPeekTargets ?? 0;
        return `PEEK: Select ${selected}/${required} card(s).`;
      }
      if (stage === "swapping") {
        const selected = selectedSwapTargets?.length ?? 0;
        return `SWAP: Select ${selected}/2 cards to swap.`;
      }
    }
    if (isMyTurn && isDrawnCard(localPlayer.pendingDrawnCard)) {
      if (localPlayer.pendingDrawnCard.source === "deck") {
        return "Swap with a card in your hand or discard the drawn card.";
      } else {
        return "You must swap the card from the discard pile with a card in your hand.";
      }
    }
  
    if (props.gameStage === GameStage.INITIAL_PEEK) {
      // The bottom-two faces only appear once the peek window opens;
      // peekExpireAt is set exactly while those initial-peek cards are
      // visible. Before that there is nothing to memorize yet.
      if (props.peekExpireAt) {
        return "Memorize your bottom two cards!";
      }
      if (!localPlayer.isReady) {
        return "Press Ready — cards are revealed once everyone is ready.";
      }
      return "Waiting for other players to get ready…";
    }
    return null;
  }, [props]);

  const getTimedIndicator = useCallback(() => {
    const {
      peekExpireAt,
      peekDurationMs,
      turnDeadline,
      turnTimerMs,
      matchingOpportunity,
      gameStage,
      turnPhase,
      isMyTurn,
      isAbilityPlayer,
      serverClockOffset,
    } = props;
    const now = Date.now();
    if (peekExpireAt && peekExpireAt > now) {
      return { expireAt: peekExpireAt, durationMs: peekDurationMs };
    }
    // Turn-timer countdown, shown only to whoever must act on it: the current
    // player during draw/discard, the ability owner during abilities, and
    // everyone during the initial peek (that deadline is shared). Spectators
    // get the status chips instead. The matching window renders its own
    // countdown on the Pass button, so it is excluded here.
    // turnDeadline is a SERVER timestamp — convert it to this client's clock
    // so skewed devices neither hide the bar nor stretch it.
    const clientDeadline =
      typeof turnDeadline === "number"
        ? turnDeadline - serverClockOffset
        : null;
    const isMyDeadline =
      gameStage === GameStage.INITIAL_PEEK ||
      (turnPhase === TurnPhase.ABILITY ? isAbilityPlayer : isMyTurn);
    if (
      clientDeadline &&
      clientDeadline > now &&
      turnTimerMs > 0 &&
      !matchingOpportunity &&
      isMyDeadline &&
      (gameStage === GameStage.PLAYING ||
        gameStage === GameStage.FINAL_TURNS ||
        gameStage === GameStage.INITIAL_PEEK)
    ) {
      return { expireAt: clientDeadline, durationMs: turnTimerMs };
    }
    return null;
  }, [props]);

  const contextValue = useMemo(
    () => ({
      matchAttempt,
      setMatchAttempt,
      getActions,
      getPromptText,
      getTimedIndicator,
    }),
    [matchAttempt, getActions, getPromptText, getTimedIndicator],
  );

  return (
    <ActionControllerContext.Provider value={contextValue}>
      {children}
    </ActionControllerContext.Provider>
  );
};

export const useActionController = () => {
  const context = useContext(ActionControllerContext);
  if (!context) {
    throw new Error(
      "useActionController must be used within an ActionController.",
    );
  }
  return context;
};
