import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useUISelector, useUIActorRef, type UIMachineSnapshot } from '@/context/GameUIContext';
import { type UIMachineEvents } from '@/machines/uiMachine';
import { GameStage, TurnPhase, PlayerActionType, type ClientCheckGameState, type Player, type ClientAbilityContext, type Card, type PlayerId, type AbilityType, CardRank } from 'shared-types';
import ActionBarComponent, { Action } from './ActionBarComponent';
import {
  createDrawDeckAction, createDrawDiscardAction, createCallCheckAction, createDiscardDrawnCardAction,
  createPassMatchAction, createAttemptMatchAction, createConfirmAbilityAction, createSkipAbilityAction,
  createCancelAbilityAction, createReadyForPeekAction, createPlayerReadyAction, createStartGameAction
} from './ActionFactories';
import logger from '@/lib/logger';
import { isDrawnCard } from '@/lib/types';

type ActionControllerContextType = {
  selectedCardIndex: number | null;
  setSelectedCardIndex: React.Dispatch<React.SetStateAction<number | null>>;
  getActions: () => Action[];
  getPromptText: () => string | null;
};

export const ActionControllerContext = createContext<ActionControllerContextType | null>(null);

const selectActionControllerProps = (state: UIMachineSnapshot) => {
  const { localPlayerId, currentGameState, currentAbilityContext, hasPassedMatch } = state.context;
  
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
      canDrawFromDeck: false,
      canDrawFromDiscard: false,
      allPlayersReady: false,
      hasPassedMatch: false,
    };
  }
  
  const localPlayer = currentGameState.players[localPlayerId];
  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;
  const isGameMaster = currentGameState.gameMasterId === localPlayerId;
  const isAbilityPlayer = currentAbilityContext?.playerId === localPlayerId;
  
  const topDiscardCard = currentGameState.discardPile.at(-1);
  const isSpecialCard = !!topDiscardCard && [CardRank.King, CardRank.Queen, CardRank.Jack].includes(topDiscardCard.rank);
  
  const canDrawFromDiscard = isMyTurn && 
                            !localPlayer?.pendingDrawnCard &&
                            !!topDiscardCard && 
                            !isSpecialCard &&
                            !currentGameState.discardPileIsSealed;
  
  const canDrawFromDeck = isMyTurn && !localPlayer?.pendingDrawnCard;
  const allPlayersReady = Object.values(currentGameState.players).every(p => p.isReady);
  
  return {
    localPlayer,
    isMyTurn,
    gameStage: currentGameState.gameStage,
    turnPhase: currentGameState.turnPhase,
    matchingOpportunity: currentGameState.matchingOpportunity,
    abilityContext: currentAbilityContext,
    isAbilityPlayer,
    isGameMaster,
    canDrawFromDeck,
    canDrawFromDiscard,
    allPlayersReady,
    hasPassedMatch,
  };
};

export const ActionController: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const props = useUISelector(selectActionControllerProps);
  const { send } = useUIActorRef();

  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [callCheckProgress, setCallCheckProgress] = useState(0);
  const [isHoldingCallCheck, setIsHoldingCallCheck] = useState(false);
  const callCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setSelectedCardIndex(null);
    setCallCheckProgress(0);
    setIsHoldingCallCheck(false);
    clearCallCheckTimers();
  }, [props.gameStage, props.isMyTurn]);

  const clearCallCheckTimers = useCallback(() => {
    setIsHoldingCallCheck(false);
    if (callCheckIntervalRef.current) clearInterval(callCheckIntervalRef.current);
    callCheckIntervalRef.current = null;
  }, []);

  const sendEvent = send;
  
  const handleStartCallCheckHold = useCallback(() => {
    if (!props.isMyTurn) return;
    setIsHoldingCallCheck(true);
    setCallCheckProgress(0);
    
    callCheckIntervalRef.current = setInterval(() => {
      setCallCheckProgress(prev => {
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
  
  const getActions = useCallback((): Action[] => {
    const { localPlayer, gameStage, abilityContext, isAbilityPlayer, isGameMaster, allPlayersReady, isMyTurn, matchingOpportunity, hasPassedMatch } = props;
    const actions: Action[] = [];
    if (!localPlayer || !gameStage) return actions;

    if (abilityContext && isAbilityPlayer) {
      const { type, stage, sourceCard, selectedPeekTargets, maxPeekTargets, selectedSwapTargets, maxSwapTargets } = abilityContext;
      if (stage === 'peeking') {
        const required = maxPeekTargets ?? 0, selected = selectedPeekTargets?.length ?? 0;
        actions.push(createConfirmAbilityAction(() => sendEvent({type: 'CONFIRM_ABILITY_ACTION'}), type, 'peek', selected, required, selected !== required));
        if (sourceCard.rank === CardRank.King || sourceCard.rank === CardRank.Queen) {
          actions.push(createSkipAbilityAction(() => sendEvent({type: 'SKIP_ABILITY_STAGE'}), type, 'peek'));
        }
      } else if (stage === 'swapping') {
        const required = maxSwapTargets ?? 0;
        const selected = selectedSwapTargets?.length ?? 0;
        actions.push(createConfirmAbilityAction(() => sendEvent({type: 'CONFIRM_ABILITY_ACTION'}), type, 'swap', selected, required, selected !== required));
        actions.push(createSkipAbilityAction(() => sendEvent({type: 'SKIP_ABILITY_STAGE'}), type, 'swap'));
      }
      return actions;
    }

    switch (gameStage) {
      case GameStage.WAITING_FOR_PLAYERS:
        if (!localPlayer.isReady) actions.push(createPlayerReadyAction(() => sendEvent({type: PlayerActionType.DECLARE_LOBBY_READY})));
        if (isGameMaster) actions.push(createStartGameAction(() => sendEvent({type: PlayerActionType.START_GAME}), !allPlayersReady));
        break;
      case GameStage.PLAYING:
      case GameStage.FINAL_TURNS:
        if (isMyTurn) {
          const isDrawPhase = props.turnPhase === TurnPhase.DRAW;

          if (isDrawPhase && !localPlayer.pendingDrawnCard) {
            actions.push(createDrawDeckAction(() => sendEvent({type: PlayerActionType.DRAW_FROM_DECK})));
            if (props.canDrawFromDiscard) actions.push(createDrawDiscardAction(() => sendEvent({type: PlayerActionType.DRAW_FROM_DISCARD})));
          }
          if (isDrawnCard(localPlayer.pendingDrawnCard) && (localPlayer.pendingDrawnCard as any).source === 'deck') {
            actions.push(createDiscardDrawnCardAction(() => sendEvent({type: PlayerActionType.DISCARD_DRAWN_CARD})));
          }
          if (isDrawPhase && gameStage === GameStage.PLAYING && !localPlayer.pendingDrawnCard) {
            actions.push(createCallCheckAction(handleStartCallCheckHold, callCheckProgress, false, isHoldingCallCheck));
          }
        }
        if (matchingOpportunity && matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id) && !hasPassedMatch) {
          if (selectedCardIndex !== null) {
            actions.push(createAttemptMatchAction(() => sendEvent({type: PlayerActionType.ATTEMPT_MATCH, payload: { handCardIndex: selectedCardIndex }})));
          }
          actions.push(createPassMatchAction(() => sendEvent({type: PlayerActionType.PASS_ON_MATCH_ATTEMPT})));
        }
        break;
      case GameStage.INITIAL_PEEK:
        if (!localPlayer.isReady) {
          actions.push(createReadyForPeekAction(() => sendEvent({ type: PlayerActionType.DECLARE_READY_FOR_PEEK }))); 
        }
        break;
    }
    return actions;
  }, [props, selectedCardIndex, callCheckProgress, isHoldingCallCheck, sendEvent, handleStartCallCheckHold]);

  const getPromptText = useCallback((): string | null => {
    const { localPlayer, isMyTurn, matchingOpportunity, abilityContext, isAbilityPlayer } = props;
    if (!localPlayer) return null;

    if (abilityContext && isAbilityPlayer) {
      if (abilityContext.stage === 'peeking') return `PEEK: Select ${abilityContext.selectedPeekTargets.length}/${abilityContext.maxPeekTargets} card(s).`;
      if (abilityContext.stage === 'swapping') return `SWAP: Select ${abilityContext.selectedSwapTargets.length}/2 cards.`;
    }
    if (isMyTurn && isDrawnCard(localPlayer.pendingDrawnCard)) {
      return 'Swap with a card in your hand or discard the drawn card.';
    }
    if (matchingOpportunity && matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id)) {
      return 'Select a card from your hand to attempt a match, or pass.';
    }
    if (props.gameStage === GameStage.INITIAL_PEEK && !localPlayer.isReady) {
      return 'Memorize your bottom two cards, then press Ready.';
    }
    return null;
  }, [props]);

  return (
    <ActionControllerContext.Provider value={{ selectedCardIndex, setSelectedCardIndex, getActions, getPromptText }}>
      {children}
    </ActionControllerContext.Provider>
  );
};

export const useActionController = () => {
  const context = useContext(ActionControllerContext);
  if (!context) {
    throw new Error('useActionController must be used within an ActionController.');
  }
  return context;
};