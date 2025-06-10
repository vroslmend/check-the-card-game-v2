"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { socket } from '@/lib/socket';
import { createGame } from '@/lib/api';
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

interface NewGameModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
}

export function NewGameModal({ isModalOpen, setIsModalOpen }: NewGameModalProps) {
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }

    setIsLoading(true);
    const response = await createGame(socket, playerName);

    if (response.success && response.playerId && response.gameId && response.gameState) {
      localStorage.setItem('localPlayerId', response.playerId);
      localStorage.setItem('localPlayerName', playerName);
      sessionStorage.setItem('initialGameState', JSON.stringify(response.gameState));
      toast.success(`Created game ${response.gameId}`);
      router.push(`/game/${response.gameId}`);
    } else {
      toast.error(`Failed to create game: ${response.message ?? 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreateGame();
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Game</DialogTitle>
          <DialogDescription>Enter your name to create a new game lobby.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="col-span-3"
              onKeyDown={onKeyDown}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreateGame} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Game'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}