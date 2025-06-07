import { ClientPlayerState, ClientCard } from 'shared-types';
import CardDisplay from '../ui/CardDisplay';

interface PlayerPodProps {
  player: ClientPlayerState;
  playerId: string;
}

const PlayerPod = ({ player, playerId }: PlayerPodProps) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="font-mono text-sm text-muted-foreground">{`[ ${player.name} ]`}</h3>
      <div className="flex gap-2">
        {player.hand.map((card: ClientCard, index: number) => (
          <CardDisplay
            key={card.id ?? `player-${playerId}-card-${index}`}
            card={card}
            isFaceUp={false} // Opponent cards are always face down
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerPod; 