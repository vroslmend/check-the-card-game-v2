import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from '@xstate/react';
import { UIContext, type UIMachineSnapshot } from '@/components/providers/UIMachineProvider';
import { type UIMachineEvents } from '@/machines/uiMachine';
import { GameStage, TurnPhase, type ClientCheckGameState, type Player, type ClientAbilityContext, type Card, type PlayerId, type AbilityType, CardRank } from 'shared-types';
import ActionBarComponent, { Action } from './ActionBarComponent';
import {
  createDrawDeckAction,
  createDrawDiscardAction,
  createCallCheckAction,
  createDiscardDrawnCardAction,
  createPassMatchAction,
  createAttemptMatchAction,
  createConfirmAbilityAction,
  createSkipAbilityAction,
  createCancelAbilityAction,
  createReadyForPeekAction,
  createPlayerReadyAction,
  createStartGameAction
} from './ActionFactories';
import logger from '@/lib/logger';
import { isDrawnCard } from '@/lib/types';

type ActionControllerContextType = {
  selectedCardIndex: number | null;
  setSelectedCardIndex: React.Dispatch<React.SetStateAction<number | null>>;
};

export const ActionControllerContext = createContext<ActionControllerContextType | null>(null);

const selectActionControllerProps = (state: UIMachineSnapshot) => {
  const { localPlayerId, currentGameState, currentAbilityContext } = state.context;
  
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
    };
  }
  
  const localPlayer = currentGameState.players[localPlayerId];
  const isMyTurn = currentGameState.currentPlayerId === localPlayerId;
  const isGameMaster = currentGameState.gameMasterId === localPlayerId;
  const isAbilityPlayer = currentAbilityContext?.playerId === localPlayerId;
  
  const topDiscardCard = currentGameState.discardPile.at(-1);
  const isSpecialCard = topDiscardCard?.rank === 'K' || topDiscardCard?.rank === 'Q' || topDiscardCard?.rank === 'J';
  
  const canDrawFromDiscard = isMyTurn && 
                            currentGameState.turnPhase === TurnPhase.DRAW &&
                            !!topDiscardCard && 
                            !isSpecialCard &&
                            !currentGameState.discardPileIsSealed;
  
  const canDrawFromDeck = isMyTurn && currentGameState.turnPhase === TurnPhase.DRAW;
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
  };
};

export const ActionController: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { actorRef } = useContext(UIContext)!;
  const props = useSelector(actorRef, selectActionControllerProps);
  
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [hasPassedMatch, setHasPassedMatch] = useState(false);
  const [callCheckProgress, setCallCheckProgress] = useState(0);
  const [isHoldingCallCheck, setIsHoldingCallCheck] = useState(false);
  const callCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setSelectedCardIndex(null);
    setHasPassedMatch(false);
    setCallCheckProgress(0);
    setIsHoldingCallCheck(false);
    clearCallCheckTimers();
  }, [props.gameStage, props.turnPhase]);

  const clearCallCheckTimers = useCallback(() => {
    setIsHoldingCallCheck(false);
    if (callCheckTimeoutRef.current) clearTimeout(callCheckTimeoutRef.current);
    if (callCheckIntervalRef.current) clearInterval(callCheckIntervalRef.current);
    callCheckTimeoutRef.current = null;
    callCheckIntervalRef.current = null;
  }, []);

  const sendEvent = useCallback((event: UIMachineEvents) => {
    logger.debug(`Action: ${event.type}`, 'payload' in event ? event : '');
    actorRef.send(event);
  }, [actorRef]);
  
  const handleStartCallCheckHold = useCallback(() => {
    if (!props.isMyTurn) return;
    setIsHoldingCallCheck(true);
    setCallCheckProgress(0);
    
    callCheckIntervalRef.current = setInterval(() => {
      setCallCheckProgress(prev => {
        const newProgress = prev + 4;
        if (newProgress >= 100) {
          clearCallCheckTimers();
          sendEvent({ type: 'CALL_CHECK' });
          return 100;
        }
        return newProgress;
      });
    }, 40);
  }, [props.isMyTurn, sendEvent, clearCallCheckTimers]);
  
  const getActions = useCallback((): Action[] => {
    const { localPlayer, gameStage, abilityContext, isAbilityPlayer, isGameMaster, allPlayersReady, isMyTurn, turnPhase, canDrawFromDeck, canDrawFromDiscard, matchingOpportunity } = props;
    const actions: Action[] = [];
    if (!localPlayer || !gameStage) return actions;

    if (abilityContext && isAbilityPlayer) {
      const { type, stage, sourceCard, selectedPeekTargets, maxPeekTargets } = abilityContext;
      if (stage === 'peeking') {
        const required = maxPeekTargets ?? 0, selected = selectedPeekTargets?.length ?? 0;
        actions.push(createConfirmAbilityAction(() => sendEvent({type: 'CONFIRM_ABILITY_ACTION'}), type, 'peek', selected, required, selected !== required));
        if (sourceCard.rank === CardRank.King || sourceCard.rank === CardRank.Queen) {
          actions.push(createSkipAbilityAction(() => sendEvent({type: 'SKIP_ABILITY_STAGE'}), type, 'peek'));
        }
      } else if (stage === 'swapping') {
        const required = abilityContext.maxSwapTargets ?? 0;
        const selected = abilityContext.selectedSwapTargets?.length ?? 0;
        actions.push(createConfirmAbilityAction(() => sendEvent({type: 'CONFIRM_ABILITY_ACTION'}), type, 'swap', selected, required, selected !== required));
        actions.push(createSkipAbilityAction(() => sendEvent({type: 'SKIP_ABILITY_STAGE'}), type, 'swap'));
      }
      actions.push(createCancelAbilityAction(() => sendEvent({type: 'CANCEL_ABILITY'})));
      return actions;
    }

    switch (gameStage) {
      case GameStage.WAITING_FOR_PLAYERS:
        if (!localPlayer.isReady) actions.push(createPlayerReadyAction(() => sendEvent({type: 'PLAYER_READY'})));
        if (isGameMaster) actions.push(createStartGameAction(() => sendEvent({type: 'START_GAME'}), !allPlayersReady));
        break;
      case GameStage.INITIAL_PEEK:
        if (!localPlayer.isReady) actions.push(createReadyForPeekAction(() => sendEvent({type: 'DECLARE_READY_FOR_PEEK_CLICKED'})));
        break;
      case GameStage.PLAYING:
      case GameStage.FINAL_TURNS:
        if (isMyTurn) {
          if (turnPhase === TurnPhase.DRAW) {
            if (canDrawFromDeck) actions.push(createDrawDeckAction(() => sendEvent({type: 'DRAW_FROM_DECK'})));
            if (canDrawFromDiscard) actions.push(createDrawDiscardAction(() => sendEvent({type: 'DRAW_FROM_DISCARD'})));
          }
          if (turnPhase === TurnPhase.DISCARD && isDrawnCard(localPlayer.pendingDrawnCard)) {
            actions.push(createDiscardDrawnCardAction(() => sendEvent({type: 'DISCARD_DRAWN_CARD'})));
          }
          if (gameStage === GameStage.PLAYING) {
            actions.push(createCallCheckAction(handleStartCallCheckHold, callCheckProgress, false, isHoldingCallCheck));
          }
        }
        if (turnPhase === TurnPhase.MATCHING && matchingOpportunity && !hasPassedMatch && matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id)) {
          actions.push(createPassMatchAction(() => { setHasPassedMatch(true); sendEvent({type: 'PASS_ON_MATCH'}); }));
          if (selectedCardIndex !== null) {
            actions.push(createAttemptMatchAction(() => { sendEvent({type: 'ATTEMPT_MATCH', handCardIndex: selectedCardIndex }); setSelectedCardIndex(null); }, false, true));
          }
        }
        break;
    }
    return actions;
  }, [props, selectedCardIndex, hasPassedMatch, callCheckProgress, isHoldingCallCheck, sendEvent, handleStartCallCheckHold]);

  const getPromptText = useCallback((): string | null => {
    const { localPlayer, isMyTurn, turnPhase, matchingOpportunity, abilityContext, isAbilityPlayer } = props;
    if (!localPlayer) return null;

    if (abilityContext && isAbilityPlayer) {
      if (abilityContext.stage === 'peeking') return `PEEK: Select ${abilityContext.maxPeekTargets} card(s).`;
      if (abilityContext.stage === 'swapping') return `SWAP: Select 2 cards to swap.`;
    }
    if (isMyTurn && turnPhase === TurnPhase.DISCARD && isDrawnCard(localPlayer.pendingDrawnCard)) {
      return 'Swap with a card in your hand or discard the drawn card.';
    }
    if (turnPhase === TurnPhase.MATCHING && matchingOpportunity && !hasPassedMatch && matchingOpportunity.remainingPlayerIDs.includes(localPlayer.id)) {
      return 'Select a card from your hand to attempt a match, or pass.';
    }
    return null;
  }, [props]);
  
  return (
    <ActionControllerContext.Provider value={{ selectedCardIndex, setSelectedCardIndex }}>
      {children}
      <ActionBarComponent actions={getActions()}>
        {getPromptText() && (
          <p className="text-xs text-center text-neutral-300 px-2">
            {getPromptText()}
          </p>
        )}
      </ActionBarComponent>
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