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
import { play } from "@/lib/sounds";

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
      decidingPlayerName: null as string | null,
      peekExpireAt: null as number | null,
      peekDurationMs: 0,
      turnDeadline: null as number | null,
      turnTimerMs: 0,
      serverClockOffset: 0,
      isSidePanelOpen: false,
      hasModal: false,
    };
  }

  const localPlayer = currentGameState.players[localPlayerId];
  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;
  // Another player holding a drawn card = the "deciding" window spectators
  // see; a primitive string keeps the selector shallow-comparable.
  const decidingPlayerName =
    Object.values(currentGameState.players).find(
      (p) => p.pendingDrawnCard && p.id !== localPlayerId,
    )?.name ?? null;
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
      !currentGameState.discardPileIsSealed &&
      !currentGameState.discardTopIsLocked,
    allPlayersReady: Object.values(currentGameState.players).every(
      (p) => p.isReady,
    ),
    hasPassedMatch,
    isAbilitySelecting,
    decidingPlayerName,
    peekExpireAt,
    peekDurationMs,
    turnDeadline: currentGameState.turnDeadline,
    turnTimerMs: currentGameState.turnTimerMs,
    serverClockOffset: state.context.serverClockOffset,
    isSidePanelOpen: state.context.isSidePanelOpen,
    hasModal: !!state.context.modal,
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

  // Event-free core so the keyboard path (hold Space) can drive the same
  // hold the pointer does.
  const beginCallCheckHold = useCallback(() => {
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
  }, [props.isMyTurn, sendEvent, clearCallCheckTimers]);

  const handleStartCallCheckHold = useCallback<
    React.PointerEventHandler<HTMLButtonElement>
  >(() => beginCallCheckHold(), [beginCallCheckHold]);

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
      // Prefer the server-shipped window length; fall back to the local
      // constant only for older payloads. This is what keeps the bar from
      // ending early when the server's env-configured duration differs.
      const windowMs = matchingOpportunity.durationMs ?? MATCHING_STAGE_DURATION_MS;
      const remainingMs = Math.max(0, windowMs - elapsedMs);
      const progressPercent = Math.min((elapsedMs / windowMs) * 100, 100);
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
            createSkipAbilityAction(() => {
              play("skip");
              sendEvent({ type: "SKIP_ABILITY_STAGE" });
            }, "Skip Peek"),
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
          createSkipAbilityAction(() => {
            play("skip");
            sendEvent({ type: "SKIP_ABILITY_STAGE" });
          }, "Skip Swap"),
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
        // Only offer "Ready" while the pre-peek window is still open. Once the
        // peek has started (peekExpireAt set — all-ready or the auto-advance
        // timer fired), the server ignores a late ready, so a lingering button
        // just strands the action bar as pending. Mirrors the prompt at the
        // GameStage.INITIAL_PEEK branch of getPromptText.
        if (!localPlayer.isReady && !props.peekExpireAt) {
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
      decidingPlayerName,
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

    // Another player holds a drawn card: the spectator prompt slot carries
    // the status line (the old chip floated unanchored under the slot).
    if (!isMyTurn && decidingPlayerName) {
      return `${decidingPlayerName} is deciding…`;
    }

    if (props.gameStage === GameStage.INITIAL_PEEK) {
      // The bottom-two faces only appear once the peek window opens;
      // peekExpireAt is set exactly while those initial-peek cards are
      // visible. Before that there is nothing to memorize yet.
      if (props.peekExpireAt) {
        return "Memorize your bottom two cards!";
      }
      if (!localPlayer.isReady) {
        return "Press Ready. Cards are revealed when everyone is ready.";
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

  // Keyboard play: keys map onto the exact handlers the pointer UI uses, so
  // eligibility rules stay single-sourced (an action you can't click, you
  // can't key). Skipped while typing or while a modal is up.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      );
    };
    const clickByLabel = (label: string) => {
      const a = getActions().find((x) => x.label === label);
      if (a && !a.disabled) a.onClick?.();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || props.hasModal) return;
      if (e.key === " ") {
        // Hold-to-check: keydown starts the same hold the pointer path uses,
        // keyup releases. preventDefault also stops a focused button from
        // double-firing on space.
        e.preventDefault();
        if (e.repeat) return;
        const offered = getActions().some(
          (x) => x.label === "Hold to Check!" && !x.disabled,
        );
        if (offered) beginCallCheckHold();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "d") return clickByLabel("Draw from Deck");
      if (key === "f") return clickByLabel("Draw from Discard");
      if (key === "x") return clickByLabel("Discard Card");
      if (key === "p") return clickByLabel("Pass Match");
      if (key === "s") {
        const a = getActions().find(
          (x) => x.label.startsWith("Skip") && !x.disabled,
        );
        a?.onClick?.();
        return;
      }
      if (e.key === "Enter") {
        const a = getActions().find(
          (x) => x.variant === "primary" && !x.disabled,
        );
        a?.onClick?.();
        return;
      }
      if (key === "c") {
        sendEvent({ type: "TOGGLE_SIDE_PANEL" });
        return;
      }
      if (e.key === "Escape") {
        if (matchAttempt) setMatchAttempt(null);
        else if (props.isSidePanelOpen)
          sendEvent({ type: "TOGGLE_SIDE_PANEL" });
        return;
      }
      if (/^[1-8]$/.test(e.key)) {
        const index = Number(e.key) - 1;
        const hand = props.localPlayer?.hand;
        if (!props.localPlayer || !hand || index >= hand.length) return;
        // Same routing as clicking your own card: matching first, then
        // ability targeting, then the discard-phase swap.
        const canMatchNow =
          !!props.matchingOpportunity &&
          props.matchingOpportunity.remainingPlayerIDs.includes(
            props.localPlayer.id,
          ) &&
          !props.hasPassedMatch;
        if (canMatchNow) {
          setMatchAttempt({ cardIndex: index });
          return;
        }
        if (
          props.abilityContext &&
          props.isAbilityPlayer &&
          props.isAbilitySelecting
        ) {
          sendEvent({
            type: "PLAYER_SLOT_CLICKED_FOR_ABILITY",
            playerId: props.localPlayer.id,
            cardIndex: index,
          });
          return;
        }
        if (
          props.isMyTurn &&
          props.turnPhase === TurnPhase.DISCARD &&
          props.localPlayer.pendingDrawnCard
        ) {
          sendEvent({
            type: PlayerActionType.SWAP_AND_DISCARD,
            payload: { handCardIndex: index },
          });
        }
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") clearCallCheckTimers();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    getActions,
    props,
    matchAttempt,
    beginCallCheckHold,
    clearCallCheckTimers,
    sendEvent,
  ]);

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
