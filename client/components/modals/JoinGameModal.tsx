"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';
import { joinGame } from '@/lib/api';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JoinGameModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export function JoinGameModal({ isModalOpen, setIsModalOpen }: JoinGameModalProps) {
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleJoinGame = async () => {
    if (!gameId.trim() || !playerName.trim()) {
      toast.error('Please enter a game ID and your name.');
      return;
    }

    setIsLoading(true);
    const response = await joinGame(socket, gameId, playerName);

    if (response.success && response.playerId && response.gameId && response.gameState) {
      localStorage.setItem('localPlayerId', response.playerId);
      localStorage.setItem('localPlayerName', playerName);
      sessionStorage.setItem('initialGameState', JSON.stringify(response.gameState));
      toast.success(`Joined game ${gameId}`);
      router.push(`/game/${response.gameId}`);
    } else {
      toast.error(`Failed to join game: ${response.message ?? 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJoinGame();
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a Game</DialogTitle>
          <DialogDescription>Enter a game ID and your name to join an existing game.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="player-name" className="text-right">
              Your Name
            </Label>
            <Input
              id="player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="col-span-3"
              onKeyDown={onKeyDown}
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="game-id" className="text-right">
              Game ID
            </Label>
            <Input
              id="game-id"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Enter the game ID"
              className="col-span-3"
              onKeyDown={onKeyDown}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleJoinGame} disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}