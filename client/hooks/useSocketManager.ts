'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// Define a type for the socket instance, which can be null initially
type SocketInstance = Socket | null;

// Fallback server URL, ideally this comes from an environment variable
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';

// Interface for the methods and properties exposed by the hook
export interface SocketManager {
  socket: SocketInstance;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void; // Ensure disconnect is part of the interface
  emitEvent: (eventName: string, ...args: any[]) => void;
  registerListener: (eventName: string, callback: (...args: any[]) => void) => () => void; // Added registerListener
}

export const useSocketManager = (): SocketManager => {
  const [socket, setSocket] = useState<SocketInstance>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const connect = useCallback(() => {
    if (socket?.connected) {
      console.log('Socket already connected.');
      return;
    }

    console.log('Attempting to connect to socket server at', SERVER_URL);
    const newSocket = io(SERVER_URL, {
      // autoConnect: false, // We manage connection manually
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', (reason: Socket.DisconnectReason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Potentially notify UI or attempt to reconnect if appropriate for the app's logic
        console.log('Disconnection was initiated by the server.');
      }
      // setSocket(null); // Consider nullifying socket on disconnect if it's fully cleaned up
    });

    newSocket.on('connect_error', (error: Error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    // Explicitly connect if not already trying or if autoConnect was set to false
    if (!newSocket.active) {
       newSocket.connect();
    }
    // Set socket immediately if you need to register listeners before 'connect' event
    // However, it's often safer to register listeners on the newSocket instance
    // and then set it to state, or ensure listeners are re-registered if socket instance changes.
    // For simplicity here, we set it once and rely on the instance for listeners.
    // If newSocket was set to state here, connect's dependency array might need adjustment.

  }, [socket]); // socket in dependency array to prevent re-creating newSocket instance if already connected.

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('Disconnecting socket...');
      socket.disconnect();
      // setSocket(null); // Clean up socket instance from state after disconnecting
      // setIsConnected(false);
    }
  }, [socket]);

  const emitEvent = useCallback(
    (eventName: string, ...args: any[]) => {
      if (socket?.connected) {
        console.log(`Emitting event [${eventName}]:`, args);
        socket.emit(eventName, ...args);
      } else {
        console.warn('Socket not connected. Cannot emit event:', eventName, args);
      }
    },
    [socket],
  );

  const registerListener = useCallback(
    (eventName: string, callback: (...args: any[]) => void): (() => void) => {
      if (socket) {
        console.log(`Registering listener for [${eventName}]`);
        socket.on(eventName, callback);
        // Return a cleanup function to remove the listener
        return () => {
          console.log(`Unregistering listener for [${eventName}]`);
          socket.off(eventName, callback);
        };
      }
      // If socket is not yet initialized, return a no-op cleanup function
      // Or, queue listeners to be attached once the socket connects.
      // For simplicity, this example requires socket to be available.
      console.warn(`Socket not available for registering listener: ${eventName}`);
      return () => {}; // No-op cleanup
    },
    [socket],
  );

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emitEvent,
    registerListener, // Expose registerListener
  };
};

// Example usage (conceptual, actual usage would be in components/providers):
/*
useEffect(() => {
  const socketManager = useSocketManager(); // This creates a new instance, careful with multiple calls in different components
                                          // Typically, you initialize once and provide it.
  socketManager.connect();

  const cleanupListener = socketManager.registerListener('some_event', (data) => {
    console.log('Received some_event:', data);
  });

  return () => {
    cleanupListener();
    // socketManager.disconnect(); // Disconnect when component unmounts, if appropriate
  };
}, []);
*/ 