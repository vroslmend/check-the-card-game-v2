import React from 'react';
import { HandGrid } from './HandGrid';
import { type Player, type PlayerId } from 'shared-types';

interface PlayerHandProps {
  player: Player;
  localPlayerId: PlayerId;
  canInteract: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ player, canInteract }) => {
  return (
    <div className="flex justify-center items-center space-x-2 p-4 min-h-[150px]">
      <HandGrid
        ownerId={player.id}
        hand={player.hand}
        canInteract={canInteract}
      />
    </div>
  );
};

export default PlayerHand;