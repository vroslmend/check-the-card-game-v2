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
  matchAttempt: { cardIndex: number } | null;
  setMatchAttempt: React.Dispatch<
    React.SetStateAction<{ cardIndex: number } | null>
  >;
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
  };
};

export const ActionController: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  const props = useUISelector(selectActionControllerProps);

  const actorRef = useUIActorRef();
  const { send } = actorRef;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const snapshot = actorRef.getSnapshot();
    logger.debug({
      component: "ActionController",
      stateValue: snapshot.value,
      statePaths:
        (snapshot as unknown as { toStrings?: () => string[] }).toStrings?.() ??
        [],
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
  const [matchAttempt, setMatchAttempt] = useState<{
    cardIndex: number;
  } | null>(null);
  const [callCheckProgress, setCallCheckProgress] = useState(0);
  const [isHoldingCallCheck, setIsHoldingCallCheck] = useState(false);
  const callCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [matchProgress, setMatchProgress] = useState(0);
  const matchRafRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedCardIndex(null);
    setMatchAttempt(null);
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
    selectedCardIndex,
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
      if (localPlayer.pendingDrawnCard.source === "deck") {
        return "Swap with a card in your hand or discard the drawn card.";
      } else {
        return "You must swap the card from the discard pile with a card in your hand.";
      }
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
    return null;
  }, [props]);

  return (
    <ActionControllerContext.Provider
      value={{
        selectedCardIndex,
        setSelectedCardIndex,
        matchAttempt,
        setMatchAttempt,
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
