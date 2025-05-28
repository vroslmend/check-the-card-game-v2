'use client'; // Add 'use client' if CheckGameClient or its children use client-side features like hooks

import CheckGameClient from './components/CheckGameClient';

export default function HomePage() {
  // For now, we can hardcode player IDs or allow joining as a spectator.
  // In a real app, you'd have a lobby system or player authentication.
  // Example: <CheckGameClient playerID="0" /> or <CheckGameClient playerID="1" />
  // To join as a spectator, you can omit playerID or pass null/undefined if your client is set up for it.
  
  // This setup will render two clients side-by-side for easy testing of 2 players.
  // You can adjust this to show a single client or a lobby interface.
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8 lg:p-12">
      <h1 className="text-3xl font-bold mb-8">Check! The Card Game</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <div className="border border-gray-200 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">Player 0</h2>
          <CheckGameClient playerID="0" matchID="default-match" />
        </div>
        <div className="border border-gray-200 p-4 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-2">Player 1</h2>
          <CheckGameClient playerID="1" matchID="default-match" />
        </div>
      </div>
      <div className="mt-8 p-4 border border-dashed border-gray-400 rounded-lg bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-2 text-green-500">Spectator View</h2>
          {/* Render a spectator client, ensure your CheckGameClient and Board can handle no playerID */}
          <CheckGameClient matchID="default-match" /> 
        </div>
      </main>
  );
}
