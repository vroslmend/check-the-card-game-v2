import moduleAlias from 'module-alias';
import path from 'path';

// Correct path for runtime: from server/dist to shared-types/dist/index.js
const sharedTypesPath = path.resolve(__dirname, '../../shared-types/dist/index.js');

moduleAlias.addAlias('shared-types', sharedTypesPath);
// Ensure this is done before any other imports that might use the alias

import { Server } from 'boardgame.io/server';
import { CheckGame } from './game-definition'; 

console.log('Server starting...');

const server = Server({ 
  games: [CheckGame],
  origins: ['http://localhost:3000'] // Allow frontend dev server to connect
});

const PORT = parseInt(process.env.PORT || '8000', 10);

server.run(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
