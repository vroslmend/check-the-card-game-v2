"use client"

import { useState } from "react"
import { motion, LayoutGroup } from "framer-motion"
import { OpponentArea } from "./OpponentArea"
import { TableArea } from "./TableArea"
import { LocalPlayerArea } from "./LocalPlayerArea"
import { SidePanel } from "./SidePanel"
import { GameHeader } from "./GameHeader"
import { InitialPeekOverlay } from "./InitialPeekOverlay"
import { MatchingOpportunityOverlay } from "./MatchingOpportunityOverlay"
import { SpecialAbilityOverlay } from "./SpecialAbilityOverlay"

interface GameScreenProps {
  gameId: string
}

// Enhanced mock data reflecting actual game rules
const mockGameState = {
  phase: "playPhase", // playPhase | finalTurnsPhase | scoringPhase | initialPeek | matchingStage | abilityResolutionStage
  currentPlayer: "player1",
  playerWhoCalledCheck: null,
  finalTurnsTaken: 0,
  discardPileIsSealed: false,
  matchingOpportunityInfo: null,
  players: [
    {
      id: "player1",
      name: "Alice",
      handSize: 4,
      isActive: true,
      status: "playing" as const,
      hasCalledCheck: false,
      isLocked: false,
      score: null,
    },
    {
      id: "player2",
      name: "Bob",
      handSize: 4,
      isActive: false,
      status: "waiting" as const,
      hasCalledCheck: false,
      isLocked: false,
      score: null,
    },
    {
      id: "player3",
      name: "Charlie",
      handSize: 4,
      isActive: false,
      status: "waiting" as const,
      hasCalledCheck: false,
      isLocked: false,
      score: null,
    },
  ],
  localPlayer: {
    id: "local",
    name: "You",
    hand: [
      { id: "card1", rank: "A", suit: "spades", value: -1, position: 0, isFaceDown: true, isPeeked: true },
      { id: "card2", rank: "K", suit: "hearts", value: 13, position: 1, isFaceDown: true, isPeeked: false },
      { id: "card3", rank: "Q", suit: "diamonds", value: 12, position: 2, isFaceDown: true, isPeeked: true },
      { id: "card4", rank: "J", suit: "clubs", value: 11, position: 3, isFaceDown: true, isPeeked: false },
    ],
    canPlay: true,
    isLocked: false,
    hasCalledCheck: false,
    pendingSpecialAbility: null,
  },
  deck: { count: 44 }, // 52 - 4*2 players = 44
  discardPile: [{ id: "discard1", rank: "9", suit: "hearts", value: 9 }],
}

const mockLog = [
  { id: "1", timestamp: "14:32", type: "game", message: "Game started - Initial peek phase", player: "System" },
  { id: "2", timestamp: "14:33", type: "player", message: "Alice peeked at bottom cards", player: "Alice" },
  { id: "3", timestamp: "14:34", type: "game", message: "Play phase begins", player: "System" },
]

const mockChat = [
  { id: "1", timestamp: "14:30", player: "Alice", message: "Good luck everyone!" },
  { id: "2", timestamp: "14:31", player: "Bob", message: "Ready to play Check!" },
  { id: "3", timestamp: "14:35", player: "Charlie", message: "Let's see those cards" },
]

export function GameScreen({ gameId }: GameScreenProps) {
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [uiState, setUiState] = useState({
    phase: "idle",
    action: null,
    showInitialPeek: false,
    showMatchingOpportunity: false,
    showSpecialAbility: false,
    abilityType: null,
    abilityStage: null,
  })

  const handleCardSelect = (cardId: string) => {
    setSelectedCards((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]))
  }

  const handleTargetSelect = (targetId: string) => {
    setSelectedTargets((prev) => (prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]))
  }

  const handleAction = (action: any) => {
    console.log("UI Action:", action)
    setUiState({ ...uiState, phase: "processing", action: action.type })

    // Simulate different UI flows based on action
    setTimeout(() => {
      if (action.type === "INITIAL_PEEK") {
        setUiState({ ...uiState, showInitialPeek: true, phase: "idle" })
      } else if (action.type === "ATTEMPT_MATCH") {
        setUiState({ ...uiState, showMatchingOpportunity: true, phase: "idle" })
      } else if (action.type === "KING_ABILITY" || action.type === "QUEEN_ABILITY" || action.type === "JACK_ABILITY") {
        setUiState({
          ...uiState,
          showSpecialAbility: true,
          abilityType: action.type,
          abilityStage: "peek",
          phase: "idle",
        })
      } else {
        setUiState({ ...uiState, phase: "idle", action: null })
        if (action.type === "PLAY" || action.type === "CHECK") {
          setSelectedCards([])
        }
      }
    }, 1000)
  }

  return (
    <LayoutGroup>
      <div className="flex h-screen flex-col bg-stone-50 text-stone-900 dark:bg-zinc-950 dark:text-stone-100">
        <GameHeader
          gameId={gameId}
          onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
          sidePanelOpen={sidePanelOpen}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col">
            {/* Opponent Area - Top */}
            <motion.div
              className="flex-grow p-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <OpponentArea
                players={mockGameState.players}
                currentPlayerId={mockGameState.currentPlayer}
                gamePhase={mockGameState.phase}
                playerWhoCalledCheck={mockGameState.playerWhoCalledCheck}
              />
            </motion.div>

            {/* Table Area - Middle */}
            <motion.div
              className="flex-shrink-0 border-y border-stone-200/50 bg-stone-100/20 p-6 dark:border-stone-800/50 dark:bg-stone-900/20"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <TableArea
                deck={mockGameState.deck}
                discardPile={mockGameState.discardPile}
                currentPlayer={mockGameState.currentPlayer}
                gamePhase={mockGameState.phase}
                discardPileIsSealed={mockGameState.discardPileIsSealed}
                matchingOpportunityInfo={mockGameState.matchingOpportunityInfo}
              />
            </motion.div>

            {/* Local Player Area - Bottom */}
            <motion.div
              className="flex-shrink-0 p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <LocalPlayerArea
                player={mockGameState.localPlayer}
                gamePhase={mockGameState.phase}
                selectedCards={selectedCards}
                selectedTargets={selectedTargets}
                onCardSelect={handleCardSelect}
                onTargetSelect={handleTargetSelect}
                onAction={handleAction}
                uiState={uiState}
              />
            </motion.div>
          </div>

          {/* Side Panel */}
          <SidePanel
            isOpen={sidePanelOpen}
            onClose={() => setSidePanelOpen(false)}
            gameLog={mockLog}
            chatMessages={mockChat}
          />
        </div>

        {/* Game Phase Overlays */}
        {uiState.showInitialPeek && (
          <InitialPeekOverlay
            cards={mockGameState.localPlayer.hand.filter((card) => card.isPeeked)}
            onComplete={() => setUiState({ ...uiState, showInitialPeek: false })}
          />
        )}

        {uiState.showMatchingOpportunity && (
          <MatchingOpportunityOverlay
            discardedCard={mockGameState.discardPile[mockGameState.discardPile.length - 1]}
            playerHand={mockGameState.localPlayer.hand}
            onMatch={(cardId) => {
              console.log("Matching with card:", cardId)
              setUiState({ ...uiState, showMatchingOpportunity: false })
            }}
            onPass={() => setUiState({ ...uiState, showMatchingOpportunity: false })}
          />
        )}

        {uiState.showSpecialAbility && (
          <SpecialAbilityOverlay
            abilityType={uiState.abilityType}
            abilityStage={uiState.abilityStage}
            allPlayers={[mockGameState.localPlayer, ...mockGameState.players]}
            onStageComplete={(nextStage) => {
              if (nextStage) {
                setUiState({ ...uiState, abilityStage: nextStage })
              } else {
                setUiState({ ...uiState, showSpecialAbility: false, abilityType: null, abilityStage: null })
              }
            }}
          />
        )}
      </div>
    </LayoutGroup>
  )
}
