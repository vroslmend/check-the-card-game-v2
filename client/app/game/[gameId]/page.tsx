export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <div>
      <h1>Game Room: {params.gameId}</h1>
      <p>Game content will go here.</p>
      {/* 
        Placeholder for components like:
        <CheckGameBoard />
        <PlayerHand />
        <DiscardPile />
        <DrawPile />
        <GameLog />
        <ChatArea /> 
      */}
    </div>
  );
} 