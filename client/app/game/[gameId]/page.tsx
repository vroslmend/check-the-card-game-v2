'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PlayerHand from '@/components/game/PlayerHand';
import GameBoardArea from '@/components/game/GameBoardArea';
import { useGameStore } from '@/store/gameStore';
import { ClientCard, Card } from 'shared-types';
import { useUIMachineRef, useUIMachineSelector } from '@/machines/uiMachineProvider';
import CardDisplay from '@/components/ui/CardDisplay';
import ActionBar from '@/components/game/actionbar/ActionBar';
import PlayerPod from '@/components/game/PlayerPod';

const GamePage = () => {
  const params = useParams();
  const gameId = params.gameId as string;

  const uiMachineActorRef = useUIMachineRef();

  const currentGameState = useGameStore((state) => state.currentGameState);
  const localPlayerId = useGameStore((state) => state.localPlayerId);
  const gameLog = useGameStore((state) => state.gameLog);
  const chatMessages = useGameStore((state) => state.chatMessages);

  const viewingPlayer = localPlayerId ? currentGameState?.players[localPlayerId] : null;
  const currentHand: ClientCard[] = viewingPlayer?.hand || [];
  const deckSize = currentGameState?.deckSize ?? 0;
  const discardPileTop = currentGameState?.discardPile && currentGameState.discardPile.length > 0 
    ? currentGameState.discardPile[0] 
    : null;

  // Selectors for UI machine state
  const canDrawFromDeck = useUIMachineSelector(
    (state) => state.matches('idle') && state.can({ type: 'DRAW_FROM_DECK_CLICKED' })
  );
  const canDrawFromDiscard = useUIMachineSelector(
    (state) => state.matches('idle') && state.can({ type: 'DRAW_FROM_DISCARD_CLICKED' })
  );
  const selectedHandCardIndex = useUIMachineSelector(
    (state) => state.context.selectedHandCardIndex
  );
  const canCallCheck = useUIMachineSelector(
    (state) => state.can({ type: 'CALL_CHECK_CLICKED' })
  );
  const pendingDrawnCard = useUIMachineSelector(
    (state) => state.context.currentGameState?.players[state.context.localPlayerId!]?.pendingDrawnCard
  );
  const pendingDrawnCardSource = useUIMachineSelector(
    (state) => state.context.currentGameState?.players[state.context.localPlayerId!]?.pendingDrawnCardSource
  );
  const isPromptingPendingCardDecision = useUIMachineSelector(
    (state) => state.matches({ playerAction: 'promptPendingCardDecision' })
  );
  const isPromptingMatchDecision = useUIMachineSelector(
    (state) => state.matches({ playerAction: 'promptMatchDecision' })
  );

  // Selectors for Initial Peek Phase
  const isInitialSetupPhase = useUIMachineSelector((state) => state.matches('initialSetup'));
  const showReadyForPeekButton = useUIMachineSelector((state) => 
    state.matches({ initialSetup: 'awaitingPeekReadiness' }) && state.can({ type: 'READY_FOR_INITIAL_PEEK_CLICKED' })
  );
  const isWaitingForPeekConfirmation = useUIMachineSelector((state) => 
    state.matches({ initialSetup: 'awaitingServerConfirmation' })
  );
  const peekableCards = useUIMachineSelector((state) => 
    state.context.localPlayerId ? state.context.currentGameState?.players[state.context.localPlayerId]?.cardsToPeek : null
  );
  const showAcknowledgePeekButton = useUIMachineSelector(state =>
    state.matches({ initialSetup: 'peekingCards' }) && state.can({ type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' })
  );
  const isWaitingForPostPeekGameState = useUIMachineSelector(state => state.matches({ initialSetup: 'awaitingPostPeekGameState' }));

  const isPlayerTurn = useUIMachineSelector(state => state.matches('idle'));

  const [chatInput, setChatInput] = useState('');

  // Effect to initialize the UI machine once gameId and localPlayerId are available
  useEffect(() => {
    if (gameId && localPlayerId) {
      uiMachineActorRef.send({ type: 'INITIALIZE', gameId, localPlayerId });
    }
  }, [gameId, localPlayerId, uiMachineActorRef]);

  const handleCardClick = (card: ClientCard, cardIndex: number) => {
    console.log(`Local player hand card clicked: Card ID ${card.id} at index ${cardIndex}`);
    uiMachineActorRef.send({ type: 'HAND_CARD_CLICKED', cardIndex });
  };

  const handlePlayerSlotClick = (targetPlayerId: string, card: ClientCard, cardIndex: number) => {
    console.log(`Player slot clicked for ability: Player ${targetPlayerId}, Card Index ${cardIndex}`);
    uiMachineActorRef.send({
      type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY',
      targetPlayerId,
      cardIndex
    });
  };

  const handleDeckClick = () => {
    console.log('Deck clicked');
    uiMachineActorRef.send({ type: 'DRAW_FROM_DECK_CLICKED' });
  };

  const handleDiscardClick = () => {
    console.log('Discard pile clicked');
    uiMachineActorRef.send({ type: 'DRAW_FROM_DISCARD_CLICKED' });
  };

  const handleCallCheck = () => {
    if (canCallCheck) {
      uiMachineActorRef.send({ type: 'CALL_CHECK_CLICKED' });
    }
  };

  const handleConfirmSwapPendingCard = () => {
    if (selectedHandCardIndex !== null) {
      uiMachineActorRef.send({ type: 'CONFIRM_SWAP_PENDING_CARD_WITH_HAND', handCardIndex: selectedHandCardIndex });
    }
  };

  const handleConfirmDiscardPendingDrawnCard = () => {
    uiMachineActorRef.send({ type: 'CONFIRM_DISCARD_PENDING_DRAWN_CARD' });
  };

  const handleAttemptMatch = () => {
    if (selectedHandCardIndex !== null && currentHand[selectedHandCardIndex]) {
      uiMachineActorRef.send({ 
        type: 'ATTEMPT_MATCH_WITH_SELECTED_CARD_CLICKED', 
        cardId: currentHand[selectedHandCardIndex].id 
      });
    }
  };

  const handlePassMatch = () => {
    uiMachineActorRef.send({ type: 'PASS_MATCH_CLICKED' });
  };

  const handleReadyForPeek = () => {
    uiMachineActorRef.send({ type: 'READY_FOR_INITIAL_PEEK_CLICKED' });
  };

  const handleAcknowledgePeek = () => {
    uiMachineActorRef.send({ type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' });
  };

  const handleDrawFromDeck = () => {
    console.log('Draw from deck clicked');
    // sendToUIMachine({ type: 'DRAW_FROM_DECK_CLICKED' });
  };

  const handleDrawFromDiscard = () => {
    console.log('Draw from discard clicked');
    // sendToUIMachine({ type: 'DRAW_FROM_DISCARD_CLICKED' });
  };

  const handleSendChatMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (chatInput.trim() && localPlayerId && viewingPlayer?.name && gameId) {
      uiMachineActorRef.send({
        type: 'SUBMIT_CHAT_MESSAGE',
        message: chatInput.trim(),
        senderId: localPlayerId,
        senderName: viewingPlayer.name,
        gameId: gameId,
      });
      setChatInput('');
    }
  };

  if (!currentGameState || !localPlayerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
        <h1 className="text-3xl font-bold">Loading Game...</h1>
        <p>Game ID: {gameId}</p>
        {currentGameState ? null : <p>Waiting for game state...</p>}
        {localPlayerId ? null : <p>Waiting for local player ID...</p>}
      </div>
    );
  }

  const opponentPlayers = Object.entries(currentGameState.players || {})
    .filter(([id, player]) => player && id !== localPlayerId)
    .map(([id, player]) => ({ id, ...player }));

  return (
    <main className="flex flex-col h-screen bg-background text-foreground p-4 gap-4">
      {/* 1. Opponent Area (Top) */}
      <div className="flex-grow flex items-center justify-center gap-8">
        {opponentPlayers.map(player => (
          <PlayerPod key={player.id} player={player} playerId={player.id} />
        ))}
      </div>

      {/* 2. Table Area (Middle) */}
      <div className="flex-shrink-0">
        <GameBoardArea
          deckSize={deckSize}
          discardPileTopCard={discardPileTop}
          onDeckClick={handleDeckClick}
          onDiscardClick={handleDiscardClick}
        />
      </div>

      {/* 3. Local Player Area (Bottom) */}
      <div className="flex-shrink-0">
        <h2 className="text-center text-muted-foreground">[ {viewingPlayer?.name ?? 'You'} ]</h2>
        <div className="grid grid-cols-4 gap-4 mt-4">
          {currentHand.map((card, index) => (
            <CardDisplay
              key={card ? card.id : `empty-${index}`}
              card={card}
              isFaceUp={
                isInitialSetupPhase &&
                peekableCards?.some(c => c.id === card?.id)
              }
            />
          ))}
        </div>
      </div>

      <ActionBar
        isInitialSetupPhase={isInitialSetupPhase}
        showReadyForPeekButton={showReadyForPeekButton}
        isWaitingForPeekConfirmation={isWaitingForPeekConfirmation}
        peekableCards={peekableCards ?? null}
        showAcknowledgePeekButton={showAcknowledgePeekButton}
        isWaitingForPostPeekGameState={isWaitingForPostPeekGameState}
        onReadyForPeek={handleReadyForPeek}
        onAcknowledgePeek={handleAcknowledgePeek}
        
        isPlayerTurn={isPlayerTurn}
        onDrawFromDeck={handleDrawFromDeck}
        onDrawFromDiscard={handleDrawFromDiscard}
      />
    </main>
  );
};

export default GamePage; 