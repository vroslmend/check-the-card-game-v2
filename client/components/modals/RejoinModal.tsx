import { useState } from "react"
import { useLocalStorage } from "usehooks-ts"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/ui/Modal"
import { Loader } from "lucide-react"
import { useUI } from "@/components/providers/UIMachineProvider"

export function RejoinModal() {
  const [state, send] = useUI()
  const [isLoading, setIsLoading] = useState(false);
  const [playerName, setPlayerName] = useLocalStorage("playerName", "", {
    serializer: v => v,
    deserializer: v => v,
  });

  const gameId = state.context.gameId;
  const modalInfo = state.context.modal;

  if (modalInfo?.type !== 'rejoin') {
    return null;
  }

  const handleJoinGame = () => {
    if (playerName.trim() && gameId) {
      setIsLoading(true); // Visually indicate loading, though machine handles the logic
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
      isOpen={state.context.modal?.type === 'rejoin'}
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
            disabled={state.hasTag('loading') || !playerName.trim()}
            className="w-full sm:w-auto"
          >
            {state.hasTag('loading') ? (
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