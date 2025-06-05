'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useSocketManager } from '@/hooks/useSocketManager';

interface SocketContextType {
  socket: Socket | null;
  emitEvent: (eventName: string, payload: any) => void;
  isConnected: boolean;
  registerListener: ((eventName: string, callback: (...args: any[]) => void) => () => void) | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { socket, emitEvent, isConnected, registerListener, connect, disconnect } = useSocketManager();

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);


  const contextValue: SocketContextType = {
    socket,
    emitEvent: emitEvent || ((eventName, payload) => { 
      console.warn('Socket not ready, emitEvent called for', eventName, payload);
    }),
    isConnected,
    registerListener,
  };

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}; 