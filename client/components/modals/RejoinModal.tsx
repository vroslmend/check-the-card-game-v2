import { useState } from "react"
import { useLocalStorage } from "usehooks-ts"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"
import { Loader } from "lucide-react"
import { useUIActorRef, useUISelector, type UIMachineSnapshot } from "@/context/GameUIContext"

const selectRejoinModalProps = (state: UIMachineSnapshot) => {
  return {
    gameId: state.context.gameId,
    // FIX: The modal's visibility and content are now driven by the modal context object
    modalInfo: state.context.modal, 
    // This can be simplified if the loading state is just for the button
    isLoading: state.hasTag('loading'), 
  }
}

export function RejoinModal() {
  const { send } = useUIActorRef();
  const { gameId, modalInfo, isLoading } = useUISelector(selectRejoinModalProps);
  
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    // Tell the hook how to read/write a raw string without JSON parsing
    serializer: (value) => value,
    deserializer: (value) => value,
  });

  // FIX: The check is now simpler and more direct
  if (modalInfo?.type !== 'rejoin') {
    return null;
  }

  const handleJoinGame = () => {
    if (playerName.trim() && gameId) {
      // The machine is already in the 'promptToJoin' state and is listening for this event.
      send({
        type: 'JOIN_GAME_REQUESTED',
        playerName: playerName.trim(),
        gameId,
      })
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && playerName.trim() && !isLoading) {
      handleJoinGame();
    }
  }

  return (
    <Modal
      isOpen={modalInfo?.type === 'rejoin'}
      onClose={() => send({ type: 'DISMISS_MODAL' })}
      title={modalInfo.title}
      description={modalInfo.message}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="player-name">Your Name</Label>
          <Input
            id="player-name"
            placeholder="e.g., Jane Doe"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="text-base"
            onKeyDown={onKeyDown}
          />
        </div>
        <motion.div
          className="flex justify-end pt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <Button
            size="lg"
            onClick={handleJoinGame}
            disabled={isLoading || !playerName.trim()}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Game"
            )}
          </Button>
        </motion.div>
      </div>
    </Modal>
  )
} 