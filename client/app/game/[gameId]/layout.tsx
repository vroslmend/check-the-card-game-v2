import React from 'react';

export default function GameLayout({ children, params }: {
  children: React.ReactNode;
  params: { gameId: string };
}) {
  return (
    <section>
      {/* Game-specific layout, e.g., header/footer or context providers */}
      {/* Access to params.gameId if needed for providers */}
      {children}
    </section>
  );
} 