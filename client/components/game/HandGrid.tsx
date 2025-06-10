"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useUI } from "../providers/UIMachineProvider"
import { PlayingCard } from "../cards/PlayingCard"
import type { Card, PlayerId, PeekAbilityPayload, SwapAbilityPayload } from "shared-types"

interface HandGridProps {
  ownerId: PlayerId
  hand: (Card | { facedown: true })[]
  isOpponent?: boolean
  canInteract: boolean
}

export const HandGrid = ({
  ownerId,
  hand,
  isOpponent = false,
  canInteract,
}: HandGridProps) => {
  const [state, send] = useUI()

  return (
    <AnimatePresence>
      {hand.map((card, index) => {
        let isSelected = false;
        let isTarget = false;

        const abilityPayload = state.context.abilityContext?.payload;

        if (abilityPayload) {
            if (abilityPayload.type === 'peek') {
                const peekPayload = abilityPayload as Partial<PeekAbilityPayload>;
                isSelected = peekPayload.targetPlayerId === ownerId && peekPayload.cardIndex === index;
            } else if (abilityPayload.type === 'swap') {
                const swapPayload = abilityPayload as Partial<SwapAbilityPayload>;
                isSelected = (swapPayload.sourcePlayerId === ownerId && swapPayload.sourceCardIndex === index) || (swapPayload.targetPlayerId === ownerId && swapPayload.targetCardIndex === index);
                isTarget = swapPayload.targetPlayerId === ownerId && swapPayload.targetCardIndex === index;
            }
        }


        // Peeked card info is not in the public payload, it's in a separate part of the context
        const isPeeked = state.context.abilityContext?.serverProvidedData?.playerId === ownerId && state.context.abilityContext?.serverProvidedData?.cardIndex === index;

        return (
          <motion.div
            className="relative"
            key={index}
            layoutId={isOpponent ? undefined : `${ownerId}-card-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
            whileHover={{ scale: 1.08, y: -10, zIndex: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <PlayingCard
              card={'suit' in card ? card : undefined}
              isFaceDown={!('suit' in card)}
              isSelected={isSelected}
              isTarget={isTarget}
              canInteract={canInteract}
              isPeeked={isPeeked}
              position={index + 1}
              onClick={() => {
                if (!canInteract) return

                if (state.matches({ inGame: { connected: { ability: 'collectingInput' } } })) {
                  send({
                    type: 'PLAYER_SLOT_CLICKED_FOR_ABILITY',
                    targetPlayerId: ownerId,
                    cardIndex: index,
                  });
                } else {
                  send({
                    type: 'HAND_CARD_CLICKED',
                    cardIndex: index,
                  });
                }
              }}
            />
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
} 