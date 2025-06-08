"use client"

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const connect = useGameStore((state) => state.connect);

  useEffect(() => {
    connect();
  }, [connect]);

  return <>{children}</>;
} 