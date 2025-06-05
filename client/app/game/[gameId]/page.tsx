'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PlayerHand from '@/components/game/PlayerHand';
import GameBoardArea from '@/components/game/GameBoardArea';
import { useGameStore } from '@/store/gameStore';
import { ClientCard, Card, ClientPlayerState } from 'shared-types'; // Changed to alias
import { useUIMachineRef, useUIMachineSelector } from '@/machines/uiMachineProvider';
import CardDisplay from '@/components/ui/CardDisplay';

// Mock data for initial display - will be replaced by store data
// const mockPlayerHand: ClientCard[] = [
//   { id: 'H_A', suit: Suit.Hearts, rank: Rank.Ace },
//   { id: 'D_K', suit: Suit.Diamonds, rank: Rank.King },
//   { id: 'C_10', suit: Suit.Clubs, rank: Rank.Ten },
//   { id: 'S_7', suit: Suit.Spades, rank: Rank.Seven },
// ];
// const mockDiscardTop: Card = { id: 'H_Q', suit: Suit.Hearts, rank: Rank.Queen };

const GamePage: React.FC = () => {
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
  const showAcknowledgePeekButton = useUIMachineSelector((state) => 
    state.matches({ initialSetup: 'peekingCards' }) && state.can({ type: 'INITIAL_PEEK_ACKNOWLEDGED_CLICKED' })
  );
  const isWaitingForPostPeekGameState = useUIMachineSelector((state) => 
    state.matches({ initialSetup: 'awaitingPostPeekGameState' })
  );
  // This selector can be derived from viewingPlayer directly if needed, but good to have for clarity
  const hasCompletedInitialPeek = useUIMachineSelector((state) => 
    state.context.localPlayerId ? !!state.context.currentGameState?.players[state.context.localPlayerId]?.hasCompletedInitialPeek : false
  );

  const abilityPeekContext = useUIMachineSelector((state) => state.context.abilityContext);

  const isInAbilityPeekingPhase = useUIMachineSelector((state) => 
    !!state.context.abilityContext && (
      (state.context.abilityContext.type === 'king' && (state.context.abilityContext.step === 'peeking1' || state.context.abilityContext.step === 'peeking2')) ||
      (state.context.abilityContext.type === 'queen' && state.context.abilityContext.step === 'peeking')
    )
  );

  const isInAbilitySwappingPhase = useUIMachineSelector((state) => 
    !!state.context.abilityContext && (
      (state.context.abilityContext.type === 'king' && (state.context.abilityContext.step === 'swapping1' || state.context.abilityContext.step === 'swapping2')) ||
      (state.context.abilityContext.type === 'queen' && (state.context.abilityContext.step === 'swapping1' || state.context.abilityContext.step === 'swapping2')) ||
      (state.context.abilityContext.type === 'jack' && (state.context.abilityContext.step === 'swapping1' || state.context.abilityContext.step === 'swapping2'))
    )
  );

  const canConfirmSwapAction = useUIMachineSelector((state) => 
    state.can({ type: 'ABILITY_CONFIRM_ACTION' }) &&
    !!state.context.abilityContext?.swapSlots?.slot1 &&
    !!state.context.abilityContext?.swapSlots?.slot2 &&
    state.context.abilityContext.step === 'confirmingSwap'
  );

  const canSkipPeek = useUIMachineSelector((state) => 
    state.can({ type: 'ABILITY_SKIP_PEEK' })
  );

  const canSkipSwap = useUIMachineSelector((state) => 
    state.can({ type: 'ABILITY_SKIP_SWAP' })
  );

  const canCancelAbility = useUIMachineSelector((state) => 
    state.can({ type: 'ABILITY_CANCEL_ACTION' })
  );

  const [chatInput, setChatInput] = useState('');

  // Effect to initialize the UI machine once gameId and localPlayerId are available
  useEffect(() => {
    if (gameId && localPlayerId) {
      uiMachineActorRef.send({ type: 'INITIALIZE', gameId, localPlayerId });
    }
  }, [gameId, localPlayerId, uiMachineActorRef]);

  const handleCardClick = (targetPlayerId: string, clickedCard: ClientCard, cardIndex: number) => {
    console.log(`Local player hand card clicked: Player ${targetPlayerId}, Card ID ${clickedCard.id} at index ${cardIndex}`);
    uiMachineActorRef.send({ type: 'HAND_CARD_CLICKED', cardIndex });
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

  const handleAbilityConfirm = () => {
    uiMachineActorRef.send({ type: 'ABILITY_CONFIRM_ACTION' });
  };

  const handleAbilityCancel = () => {
    uiMachineActorRef.send({ type: 'ABILITY_CANCEL_ACTION' });
  };

  const handleAbilitySkipPeek = () => {
    uiMachineActorRef.send({ type: 'ABILITY_SKIP_PEEK' });
  };

  const handleAbilitySkipSwap = () => {
    uiMachineActorRef.send({ type: 'ABILITY_SKIP_SWAP' });
  };

  const handlePlayerSlotClick = (targetPlayerId: string, clickedCard: ClientCard, cardIndex: number) => {
    console.log(`Player slot clicked for ability: Player ${targetPlayerId}, Card Index ${cardIndex}`);
    
    // No need to pass the full card object to PLAYER_SLOT_CLICKED_FOR_ABILITY
    // The machine will request details from the server if needed.
    uiMachineActorRef.send({ 
      type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY', 
      targetPlayerId, 
      cardIndex 
    });
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

  // Safe to assume currentGameState.players exists if currentGameState is not null
  const opponentPlayers = Object.entries(currentGameState.players || {})
    .filter(([id, player]) => player && id !== localPlayerId)
    .map(([id, player]) => ({ id, ...player })); // Combine id with player data for easier access

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-800 text-white p-4 space-y-8">
      <header className="w-full max-w-4xl text-center">
        <h1 className="text-3xl font-bold">Check! Game</h1>
        <p className="text-lg">Game ID: {gameId}</p>
        <p className="text-sm">Viewing as: {viewingPlayer?.name || localPlayerId} (Score: {viewingPlayer?.score ?? 0})</p>
      </header>

      <main className="w-full max-w-4xl space-y-6">
        {/* Initial Peek Phase UI */}
        {isInitialSetupPhase && !hasCompletedInitialPeek && (
          <section aria-labelledby="initial-peek-label" className="bg-gray-700 p-4 rounded-lg shadow-lg text-center">
            <h2 id="initial-peek-label" className="text-2xl font-semibold mb-3">Initial Peek Phase</h2>
            {showReadyForPeekButton && (
              <button
                onClick={handleReadyForPeek}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-md transition duration-150 ease-in-out"
              >
                I'm Ready to Peek My Cards
              </button>
            )}
            {isWaitingForPeekConfirmation && (
              <p className="text-lg italic">Waiting for server confirmation to peek cards...</p>
            )}
            {peekableCards && peekableCards.length > 0 && showAcknowledgePeekButton && (
              <div className="my-4">
                <h3 className="text-xl mb-2">These are your initial two cards:</h3>
                <div className="flex justify-center">
                  <PlayerHand 
                    cards={peekableCards as ClientCard[]}
                    playerId={localPlayerId!}
                    localPlayerId={localPlayerId!}
                    initialPeekCardsForDisplay={peekableCards}
                  /> 
                </div>
                <button
                  onClick={handleAcknowledgePeek}
                  className="mt-4 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-md transition duration-150 ease-in-out"
                >
                  Got It! (Hide Cards)
                </button>
              </div>
            )}
            {isWaitingForPostPeekGameState && (
                <p className="text-lg italic">Peek acknowledged. Waiting for game to start...</p>
            )}
            {/* Fallback message if no specific state matches but still in setup and not completed peek */}
            {!showReadyForPeekButton && !isWaitingForPeekConfirmation && !(peekableCards && peekableCards.length > 0 && showAcknowledgePeekButton) && !isWaitingForPostPeekGameState && (
                 viewingPlayer && !viewingPlayer.isReadyForInitialPeek && !viewingPlayer.cardsToPeek && (
                    <p className="text-lg italic">Getting ready for the initial peek...</p>
                 ) 
            )}
             {viewingPlayer && viewingPlayer.isReadyForInitialPeek && !viewingPlayer.cardsToPeek && !isWaitingForPeekConfirmation && !showAcknowledgePeekButton && (
                 <p className="text-lg italic">You are ready. Waiting for other players or server to provide cards for peeking...</p>
            )}
          </section>
        )}

        {/* Ability Control Section */}
        {abilityPeekContext && (
          <section aria-labelledby="ability-control-label" className="bg-purple-700 p-4 rounded-lg shadow-lg text-center mt-4">
            <h2 id="ability-control-label" className="text-2xl font-semibold mb-3 text-white">
              Ability: {abilityPeekContext.type.toUpperCase()}
            </h2>
            <p className="text-purple-200 mb-1">Step: {abilityPeekContext.step}</p>
            
            {/* Dynamic Instructions */}
            <div className="text-purple-100 mb-4 p-2 bg-purple-600 rounded">
              {abilityPeekContext.type === 'king' && abilityPeekContext.step === 'peeking1' && "King: Select the first card to peek."}
              {abilityPeekContext.type === 'king' && abilityPeekContext.step === 'peeking2' && "King: Select the second card to peek."}
              {abilityPeekContext.type === 'king' && abilityPeekContext.step === 'swapping1' && "King: Select the first card for your swap."}
              {abilityPeekContext.type === 'king' && abilityPeekContext.step === 'swapping2' && `King: Select the second card. Slot 1: ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'}`}
              {abilityPeekContext.type === 'king' && abilityPeekContext.step === 'confirmingSwap' && `King: Confirm swap - ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'} with ${abilityPeekContext.swapSlots?.slot2?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot2?.card.suit || '_'}?`}

              {abilityPeekContext.type === 'queen' && abilityPeekContext.step === 'peeking' && "Queen: Select one card anywhere to peek."}
              {abilityPeekContext.type === 'queen' && abilityPeekContext.step === 'swapping1' && `Queen: Select the first card for swap (peeked: ${abilityPeekContext.peekedCardInfo?.card.rank || '_'}$${abilityPeekContext.peekedCardInfo?.card.suit || '_'}).`}
              {abilityPeekContext.type === 'queen' && abilityPeekContext.step === 'swapping2' && `Queen: Select the second card. Slot 1: ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'}`}
              {abilityPeekContext.type === 'queen' && abilityPeekContext.step === 'confirmingSwap' && `Queen: Confirm swap - ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'} with ${abilityPeekContext.swapSlots?.slot2?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot2?.card.suit || '_'}?`}

              {abilityPeekContext.type === 'jack' && abilityPeekContext.step === 'swapping1' && "Jack: Select the first card for swap."}
              {abilityPeekContext.type === 'jack' && abilityPeekContext.step === 'swapping2' && `Jack: Select the second card. Slot 1: ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'}`}
              {abilityPeekContext.type === 'jack' && abilityPeekContext.step === 'confirmingSwap' && `Jack: Confirm swap - ${abilityPeekContext.swapSlots?.slot1?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot1?.card.suit || '_'} with ${abilityPeekContext.swapSlots?.slot2?.card.rank || '_'}$${abilityPeekContext.swapSlots?.slot2?.card.suit || '_'}?`}
            </div>

            {/* Display Selected Cards Info (Simplified) */}
            {abilityPeekContext.swapSlots?.slot1 && (
              <p className="text-sm text-purple-300">Swap Slot 1: {abilityPeekContext.swapSlots.slot1.card.rank}{abilityPeekContext.swapSlots.slot1.card.suit} (P:{abilityPeekContext.swapSlots.slot1.playerId.slice(-4)} Idx:{abilityPeekContext.swapSlots.slot1.cardIndex})</p>
            )}
            {abilityPeekContext.swapSlots?.slot2 && (
              <p className="text-sm text-purple-300">Swap Slot 2: {abilityPeekContext.swapSlots.slot2.card.rank}{abilityPeekContext.swapSlots.slot2.card.suit} (P:{abilityPeekContext.swapSlots.slot2.playerId.slice(-4)} Idx:{abilityPeekContext.swapSlots.slot2.cardIndex})</p>
            )}
            {abilityPeekContext.type === 'king' && abilityPeekContext.peekedCardsInfo && abilityPeekContext.peekedCardsInfo.length > 0 && (
              <div className="text-sm text-purple-300">
                Peeked:
                {abilityPeekContext.peekedCardsInfo.map((peek, index) => (
                  <span key={`king-peek-${index}`} className="ml-2">{peek.card.rank}{peek.card.suit} (P:{peek.playerId.slice(-4)} Idx:{peek.cardIndex})</span>
                ))}
              </div>
            )}
            {abilityPeekContext.type === 'queen' && abilityPeekContext.peekedCardInfo && (
              <p className="text-sm text-purple-300">Peeked: {abilityPeekContext.peekedCardInfo.card.rank}{abilityPeekContext.peekedCardInfo.card.suit} (P:{abilityPeekContext.peekedCardInfo.playerId.slice(-4)} Idx:{abilityPeekContext.peekedCardInfo.cardIndex})</p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {canConfirmSwapAction && (
                <button
                  onClick={handleAbilityConfirm}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow"
                >
                  Confirm Ability
                </button>
              )}
              {canSkipPeek && (
                <button
                  onClick={handleAbilitySkipPeek}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md shadow"
                >
                  Skip Peek
                </button>
              )}
              {canSkipSwap && (
                <button
                  onClick={handleAbilitySkipSwap}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-md shadow"
                >
                  Skip Swap
                </button>
              )}
              {canCancelAbility && (
                <button
                  onClick={handleAbilityCancel}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md shadow"
                >
                  Cancel Ability
                </button>
              )}
            </div>
          </section>
        )}

        {/* Hide main game board and player hand if in initial setup and peek not complete, or show a message */}
        {(!isInitialSetupPhase || hasCompletedInitialPeek) && (
          <>
            <section aria-labelledby="game-board-label">
              <h2 id="game-board-label" className="sr-only">Game Board</h2>
              <GameBoardArea
                deckSize={deckSize}
                discardPileTopCard={discardPileTop as Card | null} // Ensure type compatibility
                onDeckClick={handleDeckClick}
                onDiscardClick={handleDiscardClick}
                canDrawFromDeck={!!canDrawFromDeck}
                canDrawFromDiscard={!!canDrawFromDiscard && !!discardPileTop}
              />
            </section>

            <section aria-labelledby="player-hand-label">
              <h2 id="player-hand-label" className="text-xl font-semibold mb-2">Your Hand ({currentHand.length})</h2>
              {viewingPlayer && localPlayerId && (
                <PlayerHand
                  cards={currentHand}
                  playerId={localPlayerId}
                  localPlayerId={localPlayerId}
                  onCardClick={(isInAbilityPeekingPhase || isInAbilitySwappingPhase) ? handlePlayerSlotClick : handleCardClick}
                  selectedHandCardIndex={selectedHandCardIndex}
                  abilityPeekContext={abilityPeekContext}
                />
              )}
            </section>

            {/* Player Actions Section */}
            <section aria-labelledby="actions-label" className="my-4">
              <h2 id="actions-label" className="sr-only">Player Actions</h2>

              {/* Display Pending Drawn Card */}
              {pendingDrawnCard && (
                <div className="mb-4 flex flex-col items-center">
                  <h3 className="text-lg font-semibold mb-2">You Drew:</h3>
                  <CardDisplay card={pendingDrawnCard as Card} /> 
                  {/* We cast to Card; generatePlayerView ensures it's not HiddenCard for local player */}
                </div>
              )}

              <div className="flex space-x-2 justify-center">
                {canCallCheck && (
                  <button
                    onClick={handleCallCheck}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
                  >
                    Call Check!
                  </button>
                )}
                {/* Actions for pending drawn card */}
                {isPromptingPendingCardDecision && pendingDrawnCard && (
                  <>
                    <button
                      onClick={handleConfirmSwapPendingCard}
                      disabled={selectedHandCardIndex === null}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Swap with Selected in Hand
                    </button>
                    {pendingDrawnCardSource === 'deck' && (
                      <button
                        onClick={handleConfirmDiscardPendingDrawnCard}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
                      >
                        Discard Drawn Card
                      </button>
                    )}
                  </>
                )}
                {/* Actions for matching stage */}
                {isPromptingMatchDecision && (
                  <>
                    <button
                      onClick={handleAttemptMatch}
                      disabled={selectedHandCardIndex === null}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Attempt Match with Selected
                    </button>
                    <button
                      onClick={handlePassMatch}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
                    >
                      Pass Match
                    </button>
                  </>
                )}
                {/* More action buttons will go here */}
              </div>
            </section>

            {/* Opponent Hands */}
            <section aria-labelledby="opponent-hands-label">
              <h2 id="opponent-hands-label" className="text-xl font-semibold mb-2">Opponents</h2>
              <div className="space-y-4">
                {opponentPlayers.map((opponent) => (
                  <div key={opponent.id}>
                    <h3 className="text-lg mb-1">{opponent.name || opponent.id} ({opponent.hand.length} cards)</h3>
                    <PlayerHand
                      cards={opponent.hand}
                      playerId={opponent.id}
                      localPlayerId={localPlayerId}
                      onCardClick={(isInAbilityPeekingPhase || isInAbilitySwappingPhase) ? handlePlayerSlotClick : undefined}
                      abilityPeekContext={abilityPeekContext}
                      // selectedHandCardIndex is not applicable for opponent hands from local player's direct view
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700 p-4 rounded-lg shadow max-h-96 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-gray-700 py-1">Game Log</h3>
                {gameLog.length > 0 ? (
                  <ul>
                    {gameLog.map((log) => (
                      <li key={log.logId} className="text-xs mb-1 border-b border-gray-600 pb-1">
                        <span className="font-mono text-gray-400">[{new Date(log.timestamp!).toLocaleTimeString()}]</span> {log.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic">No game log entries yet.</p>
                )}
              </div>
              <div className="bg-gray-700 p-4 rounded-lg shadow max-h-96 flex flex-col">
                <h3 className="text-lg font-semibold mb-2 sticky top-0 bg-gray-700 py-1">Chat</h3>
                <div className="overflow-y-auto flex-grow mb-2">
                  {chatMessages.length > 0 ? (
                    <ul>
                      {chatMessages.map((msg) => (
                        <li key={msg.id} className="text-sm mb-1">
                          <span className="font-semibold">{msg.senderName}:</span> {msg.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic">No chat messages yet.</p>
                  )}
                </div>
                <form onSubmit={handleSendChatMessage} className="mt-auto">
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="w-full p-2 rounded bg-gray-600 text-white text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </form>
              </div>
            </section>
          </>
        )}

        {/* Adding a more specific message for when player has completed peek but still in setup */}
        {isInitialSetupPhase && hasCompletedInitialPeek && (
             <section aria-labelledby="initial-peek-waiting-label" className="bg-gray-700 p-4 rounded-lg shadow-lg text-center">
                <h2 id="initial-peek-waiting-label" className="text-2xl font-semibold mb-3">Initial Peek Completed</h2>
                <p className="text-lg italic">You have completed your initial peek. Waiting for other players and for the game to officially start...</p>
            </section>
        )}
      </main>

      <footer className="w-full max-w-4xl text-center mt-auto pt-4">
        <p className="text-xs text-gray-400">Check! The Card Game - New Frontend</p>
      </footer>
    </div>
  );
};

export default GamePage; 