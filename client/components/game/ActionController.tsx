"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  useUISelector,
  useUIActorRef,
  type UIMachineSnapshot,
} from "@/context/GameUIContext";
import { GameStage, TurnPhase, PlayerActionType, CardRank } from "shared-types";
import ActionBarComponent, { Action } from "./ActionBarComponent";
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
import logger from "@/lib/logger";

type ActionControllerContextType = {
  selectedCardIndex: number | null;
  setSelectedCardIndex: React.Dispatch<React.SetStateAction<number | null>>;
  getActions: () => Action[];
  getPromptText: () => string | null;
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

  // Determine if we should show ability action buttons:
  // 1. Client owns the ability
  // 2. Ability stage requires input (peeking or swapping)
  // 3. We are NOT currently in the automatic peek-reveal sub-state

  const isViewingPeek = state.matches(
    "inGame.ability.resolving.viewingPeek" as any,
  );

  const isAbilitySelecting =
    !!currentAbilityContext &&
    currentAbilityContext.playerId === localPlayerId &&
    currentGameState.turnPhase === TurnPhase.ABILITY &&
    ["peeking", "swapping"].includes(
      (currentAbilityContext as any).stage ?? "",
    ) &&
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
  };
};

export const ActionController: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const props = useUISelector(selectActionControllerProps);

  // Access the underlying actor(ref) so we can inspect the raw XState snapshot
  const actorRef = useUIActorRef();
  const { send } = actorRef;

  // Emit a debug-level log whenever the ability-flow related flags change.
  useEffect(() => {
    // Only log during development to avoid noisy production logs
    if (process.env.NODE_ENV === "production") return;

    const snapshot = actorRef.getSnapshot();
    logger.debug({
      component: "ActionController",
      stateValue: snapshot.value,
      statePaths: (snapshot as any).toStrings?.() ?? [],
      abilityContext: props.abilityContext,
      isAbilityPlayer: props.isAbilityPlayer,
      isAbilitySelecting: props.isAbilitySelecting,
    });
  }, [
    actorRef,
    props.abilityContext,
    props.isAbilityPlayer,
    props.isAbilitySelecting,
  ]);

  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(
    null,
  );
  const [callCheckProgress, setCallCheckProgress] = useState(0);
  const [isHoldingCallCheck, setIsHoldingCallCheck] = useState(false);
  const callCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [matchProgress, setMatchProgress] = useState(0);
  const matchRafRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedCardIndex(null);
    setCallCheckProgress(0);
    setIsHoldingCallCheck(false);
    if (callCheckIntervalRef.current)
      clearInterval(callCheckIntervalRef.current);
    setMatchProgress(0);
    if (matchRafRef.current !== null) cancelAnimationFrame(matchRafRef.current);
  }, [props.gameStage, props.isMyTurn]);

  useEffect(() => {
    const DURATION = 5000;

    const update = () => {
      if (!props.matchingOpportunity || props.hasPassedMatch) {
        setMatchProgress(0);
        return;
      }
      const startTs = props.matchingOpportunity.startTimestamp ?? Date.now();
      const elapsed = Date.now() - startTs;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setMatchProgress(pct);
      if (pct < 100) {
        matchRafRef.current = requestAnimationFrame(update);
      }
    };

    // kick off
    update();

    return () => {
      if (matchRafRef.current !== null)
        cancelAnimationFrame(matchRafRef.current);
    };
  }, [props.matchingOpportunity, props.hasPassedMatch]);

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

    // PRIORITY 1: MATCHING STAGE
    if (
      matchingOpportunity &&
      matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id) &&
      !hasPassedMatch
    ) {
      if (selectedCardIndex !== null) {
        actions.push(
          createAttemptMatchAction(() =>
            sendEvent({
              type: PlayerActionType.ATTEMPT_MATCH,
              payload: { handCardIndex: selectedCardIndex },
            }),
          ),
        );
      }
      const remainingMs = props.matchingOpportunity
        ? Math.max(
            0,
            5000 - (Date.now() - props.matchingOpportunity.startTimestamp!),
          )
        : 0;
      actions.push(
        createPassMatchAction(
          () => sendEvent({ type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }),
          matchProgress,
          remainingMs,
          false,
          props.hasPassedMatch,
        ),
      );
      return actions;
    }

    // PRIORITY 2: ABILITY RESOLUTION
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

        // ✨ FIX: Pass explicit labels to the factories
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

    // PRIORITY 3: REGULAR TURN/GAME ACTIONS
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
          // ✨ FIX: Check if a card is pending, regardless of source. The server validates the action.
          if (drawnCardInfo) {
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
    selectedCardIndex,
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

    if (
      matchingOpportunity &&
      matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id) &&
      !hasPassedMatch
    ) {
      return "Select a card from your hand to attempt a match, or pass.";
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
      return "Swap with a card in your hand or discard the drawn card.";
    }
    if (props.gameStage === GameStage.INITIAL_PEEK && !localPlayer.isReady) {
      return "Memorize your bottom two cards, then press Ready.";
    }
    if (
      props.gameStage === GameStage.INITIAL_PEEK &&
      localPlayer.isReady &&
      !props.allPlayersReady
    ) {
      return "Waiting for other players to get ready…";
    }
    if (matchingOpportunity && !hasPassedMatch) {
      return `MATCH: A ${matchingOpportunity.cardToMatch.rank} was played. Match it from your hand.`;
    }
    return null;
  }, [props]);

  return (
    <ActionControllerContext.Provider
      value={{
        selectedCardIndex,
        setSelectedCardIndex,
        getActions,
        getPromptText,
      }}
    >
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
