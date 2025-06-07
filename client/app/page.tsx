'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const LandingPage = () => {
  const [playerName, setPlayerName] = useState('');
  const [gameIdToJoin, setGameIdToJoin] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedPlayerName = localStorage.getItem('playerName');
    if (savedPlayerName) {
      setPlayerName(savedPlayerName);
    }
  }, []);

  const handleCreateGame = () => {
    if (!playerName.trim()) return;
    localStorage.setItem('playerName', playerName);
    // Note: In a real app, this would be a call to a server to create a game
    // and get a proper ID, not a client-side generated one.
    const newGameId = Math.random().toString(36).substr(2, 9);
    router.push(`/game/${newGameId}`);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !gameIdToJoin.trim()) return;
    localStorage.setItem('playerName', playerName);
    router.push(`/game/${gameIdToJoin}`);
  };

  const hasPlayerName = playerName.trim() !== '';

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans p-4 sm:p-6">
      <header className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tighter">CHECK!</h1>
        <Button variant="ghost" size="sm">[Info]</Button>
      </header>

      <main className="flex flex-grow items-center justify-center">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          
          <Input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full h-16 text-3xl text-center bg-transparent border-0 border-b-2 border-foreground/20 focus-visible:ring-offset-0 focus-visible:ring-0 focus:border-primary transition-colors duration-300"
          />
          
          <div className={cn(
            "transition-all duration-500 ease-in-out mt-8 w-full",
            hasPlayerName ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}>
            {!isJoining ? (
              <div className="flex items-center justify-center space-x-6">
                <Button variant="ghost" onClick={handleCreateGame}>
                  [Create New Game]
                </Button>
                <Button variant="ghost" onClick={() => setIsJoining(true)}>
                  [Join Game]
                </Button>
              </div>
            ) : (
              <form onSubmit={handleJoinGame} className="flex flex-col items-center w-full animate-in fade-in duration-500">
                <Input
                  type="text"
                  placeholder="Enter Game ID"
                  value={gameIdToJoin}
                  onChange={(e) => setGameIdToJoin(e.target.value)}
                  className="w-full h-16 text-3xl text-center bg-transparent border-0 border-b-2 border-foreground/20 focus-visible:ring-offset-0 focus-visible:ring-0 focus:border-primary transition-colors duration-300"
                  autoFocus
                />
                <Button variant="ghost" type="submit" disabled={!gameIdToJoin.trim()} className="mt-8">
                  [Join]
                </Button>
                <Button variant="link" size="sm" onClick={() => setIsJoining(false)} className="mt-4 text-muted-foreground">
                  ...or create a new game
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="flex justify-between items-center py-4 text-sm text-muted-foreground w-full max-w-7xl mx-auto">
        <span>© {new Date().getFullYear()}</span>
        <div className="flex space-x-4">
          <Button variant="link" size="sm" className="text-muted-foreground">[How to Play]</Button>
          <Button variant="link" size="sm" className="text-muted-foreground">[Source]</Button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
