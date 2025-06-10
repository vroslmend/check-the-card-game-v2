'use client';

import React, { useEffect } from 'react';
import { socket } from '@/lib/socket';

export const SocketConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useEffect(() => {
    if (socket.disconnected) {
      socket.connect();
    }
    
    // We only want to disconnect when the entire app is closed.
    // This provider will be in the root layout, so it will only
    // unmount when the user navigates away from the site entirely.
    return () => {
      socket.disconnect();
    };
  }, []);

  return <>{children}</>;
}; 