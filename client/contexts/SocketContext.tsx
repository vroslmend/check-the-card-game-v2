'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { Socket } from 'socket.io-client'; // Assuming you'll install socket.io-client

interface ISocketContext {
  socket: Socket | null;
  // We can add more specific methods or states here later if needed
  // e.g., isConnected: boolean;
}

const SocketContext = createContext<ISocketContext | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
  // The actual socket instance will be passed from useSocketManager hook or similar
  value: ISocketContext;
}

export const SocketProvider = ({ children, value }: SocketProviderProps) => {
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// Example of how it might be initialized in layout.tsx or a root client component:
// import { io } from 'socket.io-client';
// const socketInstance = io(process.env.NEXT_PUBLIC_SERVER_URL!);
// <SocketProvider value={{ socket: socketInstance }}>
//   {children}
// </SocketProvider> 