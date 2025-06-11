import { useState, useContext } from "react"
import { useLocalStorage } from "usehooks-ts"
import { motion } from "framer-motion"
import { useSelector } from "@xstate/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"
import { Loader } from "lucide-react"
import { UIContext, type UIMachineSnapshot } from "@/components/providers/UIMachineProvider"

const selectRejoinModalProps = (state: UIMachineSnapshot) => {
  return {
    gameId: state.context.gameId,
    modalInfo: state.context.modal,
    isLoading: state.hasTag('loading'),
  }
}

export function RejoinModal() {
  const { actorRef } = useContext(UIContext)!;
  const { gameId, modalInfo, isLoading } = useSelector(actorRef, selectRejoinModalProps);
  
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    serializer: v => v,
    deserializer: v => v,
  });

  if (modalInfo?.type !== 'rejoin') {
    return null;
  }

  const handleJoinGame = () => {
    if (playerName.trim() && gameId) {
      actorRef.send({
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
      onClose={() => actorRef.send({ type: 'DISMISS_MODAL' })}
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