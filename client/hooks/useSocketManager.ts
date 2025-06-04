'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Define a type for the socket instance, which can be null initially
type SocketInstance = Socket | null;

export interface SocketManager {
  socket: SocketInstance;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emitEvent: (eventName: string, payload?: any) => void;
  // Add other necessary socket management functions here
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

export const useSocketManager = (): SocketManager => {
  const [socket, setSocket] = useState<SocketInstance>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const connect = useCallback(() => {
    if (socket?.connected) return;

    console.log('Attempting to connect to socket server...');
    const newSocket = io(SERVER_URL, {
      // Socket.IO connection options can go here
      // e.g., transports: ['websocket'],
      // autoConnect: false, // We manage connection manually
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      // Optional: attempt to reconnect or clean up
      // if (reason === 'io server disconnect') {
      //   // the disconnection was initiated by the server, you need to reconnect manually
      //   newSocket.connect();
      // }
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      // Optional: handle specific errors or attempt reconnection
    });
    
    // It's good practice to explicitly connect if autoConnect is false or for clarity
    if (!newSocket.connected) {
      newSocket.connect();
    }

    // setSocket(newSocket); // Set socket early if you need to interact before connect event

  }, [socket]); // Add socket to dependency array if using its properties like socket.connected

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('Disconnecting socket...');
      socket.disconnect();
    }
  }, [socket]);

  // Effect to connect on mount and disconnect on unmount
  // Depending on requirements, you might not want to auto-connect on mount
  // Or you might want to provide connect() to be called explicitly by a component
  // For now, let's not auto-connect on mount, but provide the connect function.
  /*
  useEffect(() => {
    // connect(); // Example: connect on mount if desired
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  */

  const emitEvent = useCallback(
    (eventName: string, payload?: any) => {
      if (socket?.connected) {
        socket.emit(eventName, payload);
      } else {
        console.warn('Socket not connected. Cannot emit event:', eventName);
        // Optionally, queue the event or handle the error
      }
    },
    [socket],
  );

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emitEvent,
  };
}; 