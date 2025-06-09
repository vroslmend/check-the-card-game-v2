import { setup, assign, sendParent, sendTo, ActorRefFrom, raise, enqueueActions, fromPromise, emit, and, assertEvent } from 'xstate';
import {
  CheckGameState,
  PlayerState,
  Card,
  Suit,
  Rank,
  GamePhase,
  PlayerActionType,
  InitialPlayerSetupData,
  cardValues,
  HiddenCard,
  ClientCard,
  ClientPlayerState,
  ClientCheckGameState,
  SpecialAbilityInfo,
  PendingSpecialAbility,
  GameOverData,
  MatchResolvedDetails,
  RichGameLogMessage,
  PlayerActivityStatus,
  SocketEventName,
  TurnSegment,
  GameMachineContext,
  GameMachineEvent,
  GameMachineInput,
  GameMachineEmittedEvents
} from 'shared-types';
import { createDeckWithIds, shuffleDeck } from './lib/deck-utils.js';
import 'xstate/guards';

const PEEK_TOTAL_DURATION_MS = parseInt(process.env.PEEK_DURATION_MS || '10000', 10);
const TURN_DURATION_MS = parseInt(process.env.TURN_DURATION_MS || '60000', 10);
const MATCHING_STAGE_DURATION_MS = parseInt(process.env.MATCHING_STAGE_DURATION_MS || '20000', 10);
const DISCONNECT_GRACE_PERIOD_MS = parseInt(process.env.DISCONNECT_GRACE_PERIOD_MS || '30000', 10);

const getPlayerNameForLog = (playerId: string, context: GameMachineContext): string => {
    return context.players[playerId]?.name || 'P-' + playerId.slice(-4);
};

export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
    emitted: {} as GameMachineEmittedEvents,
    input: {} as GameMachineInput,
  },
  actions: {
    handlePlayerJoin: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'PLAYER_JOIN_REQUEST');
      const { playerSetupData } = event;
      const { id: playerId, name, socketId } = playerSetupData;

      const newDeck = [...context.deck];
      // Each player gets 4 cards initially
      const newPlayerHand = newDeck.splice(0, 4);

      const newPlayer: PlayerState = {
        name: name || `P-${playerId.slice(-4)}`,
        socketId: socketId!,
        hand: newPlayerHand.map(card => ({...card, isFaceDownToOwner: true})),
        isReadyForInitialPeek: false,
        hasAcknowledgedPeek: false,
        hasCalledCheck: false,
        score: 0,
        isConnected: true,
        pendingDrawnCard: null,
        cardsToPeek: null,
        forfeited: false,
        hasCompletedInitialPeek: false,
        hasUsedInitialPeek: false,
        isLocked: false,
        numMatches: 0,
        numPenalties: 0,
        peekAcknowledgeDeadline: null,
        pendingDrawnCardSource: null,
        pendingSpecialAbility: null,
      };

      const isFirstPlayer = Object.keys(context.players).length === 0;

      enqueue.assign({
        deck: newDeck,
        players: {
          ...context.players,
          [playerId]: newPlayer,
        },
        turnOrder: [...context.turnOrder, playerId],
        gameMasterId: isFirstPlayer ? playerId : context.gameMasterId,
      });

      const nextContext = {
        ...context,
        players: { ...context.players, [playerId]: newPlayer },
      };
      const playerNameForLog = getPlayerNameForLog(playerId, nextContext);

      enqueue.emit({
        type: 'EMIT_LOG_PUBLIC',
        gameId: context.gameId,
        publicLogData: {
          message: `${playerNameForLog} joined the game.`,
          type: 'system',
          actorId: playerId,
        },
      });

      enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });

      console.log(`[GameMachine] Player ${playerNameForLog} (${playerId}) joined game ${context.gameId}`);
    }),
    handlePlayerDisconnect: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'PLAYER_DISCONNECTED');
      const { playerId } = event;

      if (!context.players[playerId]?.isConnected) {
        return;
      }

      const playerName = getPlayerNameForLog(playerId, context);
      console.log(`[GameMachine] Player ${playerName} disconnected.`);

      enqueue.assign({
        players: ({ context: currentContext }) => {
          const player = currentContext.players[playerId];
          return {
            ...currentContext.players,
            [playerId]: { ...player!, isConnected: false },
          };
        },
      });

      enqueue.emit({
        type: 'EMIT_LOG_PUBLIC',
        gameId: context.gameId,
        publicLogData: {
          message: `${playerName} disconnected.`,
          type: 'system',
          actorId: playerId,
        },
      });

      enqueue.spawnChild('disconnectGraceTimerActor', {
        id: `graceTimer_${playerId}`,
        input: {
          playerId: playerId,
          duration: DISCONNECT_GRACE_PERIOD_MS,
        },
      });
    }),
    handlePlayerReconnect: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'PLAYER_RECONNECTED');
      const { playerId, newSocketId } = event;

      if (!context.players[playerId]) {
        console.warn(`[GameMachine] Player ${playerId} reconnected but not found in state.`);
        return;
      }

      const playerName = getPlayerNameForLog(playerId, context);
      console.log(`[GameMachine] Player ${playerName} reconnected.`);

      enqueue.assign({
        players: ({ context: currentContext }) => {
          const player = currentContext.players[playerId];
          return {
            ...currentContext.players,
            [playerId]: { ...player!, isConnected: true, socketId: newSocketId },
          };
        },
      });

      enqueue.stopChild(`graceTimer_${playerId}`);

      enqueue.emit({
        type: 'EMIT_LOG_PUBLIC',
        gameId: context.gameId,
        publicLogData: {
          message: `${playerName} reconnected.`,
          type: 'system',
          actorId: playerId,
        },
      });
    }),
    handleGraceTimerExpired: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'DISCONNECT_GRACE_TIMER_EXPIRED');
      const { timedOutGracePlayerId: playerId } = event;
      const player = context.players[playerId];

      if (!player || player.isConnected) {
        if (player?.isConnected) {
          console.log(`[GameMachine] Grace timer expired for ${getPlayerNameForLog(playerId, context)}, but player already reconnected.`);
        }
        return;
      }

      const playerName = getPlayerNameForLog(playerId, context);
      console.log(`[GameMachine] Grace period expired for ${playerName}. Player forfeited.`);

      enqueue.assign({
        turnOrder: context.turnOrder.filter((pId) => pId !== playerId),
        players: {
          ...context.players,
          [playerId]: {
            ...player,
            forfeited: true,
            isConnected: false,
            pendingDrawnCard: null,
            pendingDrawnCardSource: null,
          },
        },
      });

      enqueue.emit({
        type: 'EMIT_LOG_PUBLIC',
        gameId: context.gameId,
        publicLogData: {
          message: `${playerName}'s disconnection grace period expired. Player has forfeited.`,
          type: 'system',
          actorId: playerId,
        },
      });

      enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
      enqueue.raise({ type: '_HANDLE_FORFEITURE_CONSEQUENCES', forfeitedPlayerId: playerId });
    }),
  },
  guards: {
    canPlayerJoin: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== 'PLAYER_JOIN_REQUEST') return false;
      const { playerSetupData } = event;
      if (context.players[playerSetupData.id]) {
        console.warn(`[GameMachine] Player ${playerSetupData.id} already joined.`);
        return false;
      }
      if (Object.keys(context.players).length >= 4) {
        console.warn(`[GameMachine] Game is full. Cannot add player ${playerSetupData.id}.`);
        return false;
      }
      return true;
    },
    playerCanDeclareReadyForPeek: ({ context, event }: { context: GameMachineContext; event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.DECLARE_READY_FOR_PEEK) return false;
      const player = context.players[event.playerId];
      return player ? !player.isReadyForInitialPeek : false;
    },
    allJoinedPlayersReadyAndMinPlayersMet: ({ context }: { context: GameMachineContext }) => {
      const numPlayers = context.turnOrder.length;
      if (numPlayers < 1) return false;
      return context.turnOrder.every((pid: string) => context.players[pid]?.isReadyForInitialPeek);
    },
    allPlayersReadyAndPeekNotYetStarted: ({ context }: { context: GameMachineContext }) => {
      if (context.turnOrder.length === 0) return false;
      return context.turnOrder.every((pid: string) => context.players[pid]?.isReadyForInitialPeek) && !context.initialPeekAllReadyTimestamp;
    },
    isPlayersTurn: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (!('playerId' in event)) return false;
      return event.playerId === context.currentPlayerId;
    },
    deckIsNotEmpty: ({ context }: { context: GameMachineContext }) => {
      return context.deck.length > 0;
    },
    discardIsDrawable: ({ context }: { context: GameMachineContext }) => {
      if (!context.discardPile.length || context.discardPileIsSealed) return false;
      const topCard = context.discardPile[0];
      return !(topCard && (topCard.rank === Rank.King || topCard.rank === Rank.Queen || topCard.rank === Rank.Jack));
    },
    hasNoPendingCard: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (!('playerId' in event)) return false;
      const player = context.players[event.playerId];
      return player ? !player.pendingDrawnCard : false;
    },
    canPerformInitialDrawAction: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (!('playerId' in event)) return false;
      if (event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      return player ? !player.pendingDrawnCard : false;
    },
    isValidSwapAndDiscard: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.SWAP_AND_DISCARD) return false;
      if (event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || !player.pendingDrawnCard || event.handIndex < 0 || event.handIndex >= player.hand.length) return false;
      return true;
    },
    isValidDiscardDrawnCard: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.DISCARD_DRAWN_CARD) return false;
      if (event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || !player.pendingDrawnCard || player.pendingDrawnCardSource !== 'deck') return false;
      return true;
    },
    isValidCallCheck: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.CALL_CHECK) return false;
      if (!('playerId' in event) || event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || player.hasCalledCheck || player.pendingDrawnCard) return false;
      if (context.pendingAbilities && context.pendingAbilities.some(ab => ab.playerId === event.playerId)) return false;
      return !context.playerWhoCalledCheck;
    },
    isValidMatchAttempt: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.ATTEMPT_MATCH) return false;
      const player = context.players[event.playerId];
      if (!player) return false;
      if (event.handIndex < 0 || event.handIndex >= player.hand.length) return false;
      if (context.currentPhase !== 'matchingStage') return false;
      if (!context.matchingOpportunityInfo) return false;
      if (!context.activePlayers || context.activePlayers[event.playerId] !== PlayerActivityStatus.AWAITING_MATCH_ACTION) return false;
      if (!context.matchingOpportunityInfo.potentialMatchers.includes(event.playerId)) return false;
      return true;
    }
  },
  actors: {
    turnTimerActor: fromPromise(async ({ input }: { input: { playerId: string, duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      return { timedOutPlayerId: input.playerId };
    }),
    matchingStageTimerActor: fromPromise(async ({ input }: { input: { duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      return {};
    }),
    disconnectGraceTimerActor: fromPromise(async ({ input }: { input: { playerId: string, duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      return { timedOutGracePlayerId: input.playerId };
    })
  }
}).createMachine(
  {
  id: 'checkGame',
    context: ({ input }: { input: GameMachineInput }): GameMachineContext => ({
      gameId: input.gameId,
      deck: shuffleDeck(createDeckWithIds()),
    players: {},
    discardPile: [],
    discardPileIsSealed: false,
    matchingOpportunityInfo: null,
    playerWhoCalledCheck: null,
    roundWinner: null,
    finalTurnsTaken: 0,
      lastResolvedAbilitySource: null,
    initialPeekAllReadyTimestamp: null,
    lastPlayerToResolveAbility: null,
    lastResolvedAbilityCardForCleanup: null,
    matchResolvedDetails: null,
      pendingAbilities: [],
    gameover: null,
    globalAbilityTargets: null,
      currentPhase: 'awaitingPlayers' as GamePhase,
      currentPlayerId: '',
      turnOrder: [],
      gameMasterId: '',
      activePlayers: {},
      totalTurnsInRound: 0,
    lastRegularSwapInfo: null,
    playerTimers: {},
    currentTurnSegment: null,
    logHistory: [],
      disconnectGraceTimerExpiresAt: undefined,
      matchingStageTimerExpiresAt: undefined,
    }),
    initial: 'awaitingPlayers',
    on: {
      PLAYER_DISCONNECTED: {
        actions: 'handlePlayerDisconnect',
      },
      PLAYER_RECONNECTED: {
        actions: 'handlePlayerReconnect',
      },
      DISCONNECT_GRACE_TIMER_EXPIRED: {
        actions: 'handleGraceTimerExpired',
      },
      [PlayerActionType.REQUEST_PEEK_REVEAL]: {
        actions: enqueueActions(({
          context, event, enqueue
        }: {
          context: GameMachineContext;
          event: Extract<GameMachineEvent, { type: PlayerActionType.REQUEST_PEEK_REVEAL }>;
          enqueue: any;
        }) => {
          const pendingAbility = context.pendingAbilities.find(pa => pa.playerId === event.playerId && (pa.card.rank === Rank.King || pa.card.rank === Rank.Queen) && pa.currentAbilityStage === 'peek');
          if (!pendingAbility) {
            console.warn('[GameMachine] REQUEST_PEEK_REVEAL received but no matching pending peek ability found for player.');
            return;
          }

          for (const target of event.peekTargets) {
            const targetPlayer = context.players[target.playerID];
            if (targetPlayer && targetPlayer.isLocked) {
              const requestingPlayerName = getPlayerNameForLog(event.playerId, context);
              const targetPlayerName = getPlayerNameForLog(target.playerID, context);
              console.warn(`[GameMachine] REQUEST_PEEK_REVEAL: Player ${requestingPlayerName} attempted to peek at a card of locked player ${targetPlayerName}. Action denied.`);
              return;
            }
          }

          const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, cardContext?: string, targetName?: string }> = [];
          const requestingPlayerName = getPlayerNameForLog(event.playerId, context);
          const abilityCardRank = pendingAbility.card.rank;
          const peekTargetSummary: { [playerName: string]: number } = {};
          event.peekTargets.forEach((target: { playerID: string; cardIndex: number }) => {
            const targetPlayerName = getPlayerNameForLog(target.playerID, context);
            peekTargetSummary[targetPlayerName] = (peekTargetSummary[targetPlayerName] || 0) + 1;
          });
          const summaryParts: string[] = [];
          for (const [playerName, count] of Object.entries(peekTargetSummary)) {
            summaryParts.push(`${count} card${count > 1 ? 's' : ''} from ${playerName}`);
          }
          const peekDetails = summaryParts.join(' and ');
          const logMessage = `${requestingPlayerName} used ${abilityCardRank} to peek at ${peekDetails}.`;

          logEventsToEmit.push({
            message: logMessage, type: 'player_action',
            actorId: event.playerId,
            cardContext: `${abilityCardRank} peek`
          });

          console.log(`[GameMachine] Player ${requestingPlayerName} revealed peek targets:`, event.peekTargets);

          enqueue.assign({
            globalAbilityTargets: event.peekTargets.map((t: { playerID: string; cardIndex: number }) => ({ ...t, type: 'peek' as 'peek' | 'swap' })),
          });

          for (const logData of logEventsToEmit) {
            enqueue.emit({
              type: 'EMIT_LOG_PUBLIC',
              gameId: context.gameId,
              publicLogData: logData
            });
          }
        })
      },
      [PlayerActionType.RESOLVE_SPECIAL_ABILITY]: {
        actions: enqueueActions(({
          context, event, enqueue
        }: {
          context: GameMachineContext;
          event: Extract<GameMachineEvent, { type: PlayerActionType.RESOLVE_SPECIAL_ABILITY, abilityResolutionArgs?: any }>;
          enqueue: any;
        }) => {
          console.log(`[GameMachine] Event: RESOLVE_SPECIAL_ABILITY, Player: ${event.playerId}, Args:`, event.abilityResolutionArgs);

          const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, cardContext?: string, targetName?: string }> = [];

          let playersToAssign = { ...context.players };
          let pendingAbilitiesToAssign = [...context.pendingAbilities];
          let globalAbilityTargetsToAssign = context.globalAbilityTargets;
          let lastResolvedAbilityCardToAssign: Card | null = context.lastResolvedAbilityCardForCleanup;
          let lastResolvedAbilitySourceToAssign: SpecialAbilityInfo['source'] | null = context.lastResolvedAbilitySource;
          let lastPlayerToResolveAbilityToAssign = context.lastPlayerToResolveAbility;
          let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo;

          if (pendingAbilitiesToAssign.length === 0) {
            console.warn('[GameMachine-ResolveAbility] No pending abilities to resolve despite event call.');
            let resolvedNextPhase: GamePhase;
            let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
            let resolvedMatchDetails = context.matchResolvedDetails;
            if (resolvedMatchDetails?.isAutoCheck) {
              resolvedNextPhase = 'finalTurnsPhase';
              if (!resolvedPlayerWhoCalledCheck) { resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId; }
            } else if (resolvedPlayerWhoCalledCheck) {
              resolvedNextPhase = 'finalTurnsPhase';
            } else {
              resolvedNextPhase = 'playPhase';
            }
            enqueue.assign({
                currentPhase: resolvedNextPhase,
                playerWhoCalledCheck: resolvedPlayerWhoCalledCheck,
                matchResolvedDetails: null,
                globalAbilityTargets: null,
            });
            return;
          }

          let pendingAbility = pendingAbilitiesToAssign[0];
          if (pendingAbility.playerId !== event.playerId) {
            console.warn(`[GameMachine-ResolveAbility] Player ${event.playerId} trying to resolve, but ability is for ${pendingAbility.playerId}.`);
            return;
          }

          const player = playersToAssign[event.playerId];
          if (!player) {
            console.error('[GameMachine-ResolveAbility] Player not found in context!');
            pendingAbilitiesToAssign.shift();
            let resolvedNextPhase: GamePhase;
            let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
            let resolvedMatchDetails = context.matchResolvedDetails;
            if (pendingAbilitiesToAssign.length > 0) { resolvedNextPhase = 'abilityResolutionPhase'; }
            else if (resolvedMatchDetails?.isAutoCheck) { resolvedNextPhase = 'finalTurnsPhase'; if (!resolvedPlayerWhoCalledCheck) { resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId; } resolvedMatchDetails = null;}
            else if (resolvedPlayerWhoCalledCheck) { resolvedNextPhase = 'finalTurnsPhase'; resolvedMatchDetails = null; }
            else { resolvedNextPhase = 'playPhase'; resolvedMatchDetails = null; }
            enqueue.assign({ pendingAbilities: pendingAbilitiesToAssign, currentPhase: resolvedNextPhase, playerWhoCalledCheck: resolvedPlayerWhoCalledCheck, matchResolvedDetails: resolvedMatchDetails, globalAbilityTargets: null });
            return;
          }

          if (player.isLocked) {
            const fizzleMsg = `${getPlayerNameForLog(event.playerId, context)}'s ${pendingAbility.card.rank} ability fizzled (player locked).`;
            logEventsToEmit.push({ message: fizzleMsg, type: 'game_event', actorId: event.playerId });

            lastResolvedAbilityCardToAssign = pendingAbility.card;
            lastResolvedAbilitySourceToAssign = pendingAbility.source;
            lastPlayerToResolveAbilityToAssign = pendingAbility.playerId;
            pendingAbilitiesToAssign.shift();
            globalAbilityTargetsToAssign = null;

            let resolvedNextPhase: GamePhase;
            let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
            let resolvedMatchDetails = context.matchResolvedDetails;
            if (pendingAbilitiesToAssign.length > 0) { resolvedNextPhase = 'abilityResolutionPhase'; }
            else if (resolvedMatchDetails?.isAutoCheck) { resolvedNextPhase = 'finalTurnsPhase'; if (!resolvedPlayerWhoCalledCheck) { resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId; } resolvedMatchDetails = null;}
            else if (resolvedPlayerWhoCalledCheck) { resolvedNextPhase = 'finalTurnsPhase'; resolvedMatchDetails = null; }
            else { resolvedNextPhase = 'playPhase'; resolvedMatchDetails = null; }

            enqueue.assign({
              pendingAbilities: pendingAbilitiesToAssign,
              currentPhase: resolvedNextPhase,
              globalAbilityTargets: globalAbilityTargetsToAssign,
              lastResolvedAbilityCardForCleanup: lastResolvedAbilityCardToAssign,
              lastResolvedAbilitySource: lastResolvedAbilitySourceToAssign,
              lastPlayerToResolveAbility: lastPlayerToResolveAbilityToAssign,
              playerWhoCalledCheck: resolvedPlayerWhoCalledCheck,
              matchResolvedDetails: resolvedMatchDetails,
            });
            for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
            return;
          }

          const args = event.abilityResolutionArgs || {};
          const abilityRank = pendingAbility.card.rank;

          if (args.skipAbility) {
            const skipType = args.skipType || 'full';
            let skipMsg = `${getPlayerNameForLog(event.playerId, context)} skipped ${abilityRank} ability stage: ${skipType}.`;
            logEventsToEmit.push({ message: skipMsg, type: 'player_action', actorId: event.playerId });

            if (skipType === 'peek' && (abilityRank === Rank.King || abilityRank === Rank.Queen) && pendingAbility.currentAbilityStage === 'peek') {
              pendingAbilitiesToAssign[0].currentAbilityStage = 'swap';
              globalAbilityTargetsToAssign = null;
              enqueue.assign({
                  pendingAbilities: pendingAbilitiesToAssign,
                  currentPhase: 'abilityResolutionPhase',
                  globalAbilityTargets: globalAbilityTargetsToAssign,
              });
            } else {
              lastResolvedAbilityCardToAssign = pendingAbility.card;
              lastResolvedAbilitySourceToAssign = pendingAbility.source;
              lastPlayerToResolveAbilityToAssign = pendingAbility.playerId;
              const skippedAbilitySource = pendingAbility.source;
              pendingAbilitiesToAssign.shift();
              globalAbilityTargetsToAssign = null;
              if (skippedAbilitySource === 'discard' || skippedAbilitySource === 'stackSecondOfPair') {
                if (matchingOpportunityInfoToAssign && matchingOpportunityInfoToAssign.cardToMatch.id === lastResolvedAbilityCardToAssign?.id) {
                   matchingOpportunityInfoToAssign = null;
                }
              }
              let resolvedNextPhase: GamePhase;
              let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
              let resolvedMatchDetails = context.matchResolvedDetails;
              if (pendingAbilitiesToAssign.length > 0) { resolvedNextPhase = 'abilityResolutionPhase'; }
              else if (resolvedMatchDetails?.isAutoCheck) { resolvedNextPhase = 'finalTurnsPhase'; if (!resolvedPlayerWhoCalledCheck) { resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId; } resolvedMatchDetails = null;}
              else if (resolvedPlayerWhoCalledCheck) { resolvedNextPhase = 'finalTurnsPhase'; resolvedMatchDetails = null; }
              else { resolvedNextPhase = 'playPhase'; resolvedMatchDetails = null; }

              enqueue.assign({
                  pendingAbilities: pendingAbilitiesToAssign,
                  currentPhase: resolvedNextPhase,
                  globalAbilityTargets: globalAbilityTargetsToAssign,
                  lastResolvedAbilityCardForCleanup: lastResolvedAbilityCardToAssign,
                  lastResolvedAbilitySource: lastResolvedAbilitySourceToAssign,
                  lastPlayerToResolveAbility: lastPlayerToResolveAbilityToAssign,
                  matchingOpportunityInfo: matchingOpportunityInfoToAssign,
                  playerWhoCalledCheck: resolvedPlayerWhoCalledCheck,
                  matchResolvedDetails: resolvedMatchDetails,
              });
            }
            for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
            return;
          }

          if ((abilityRank === Rank.King || abilityRank === Rank.Queen) && pendingAbility.currentAbilityStage === 'peek') {
            pendingAbilitiesToAssign[0].currentAbilityStage = 'swap';
            const logMsg = `${getPlayerNameForLog(event.playerId, context)} confirmed ${abilityRank} peek. Ready for swap.`;
            logEventsToEmit.push({ message: logMsg, type: 'game_event', actorId: event.playerId });

            enqueue.assign({
                pendingAbilities: pendingAbilitiesToAssign,
                currentPhase: 'abilityResolutionPhase',
            });
            for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
            return;
          }

          if (pendingAbility.currentAbilityStage === 'swap' || abilityRank === Rank.Jack) {
            if (!args.swapTargets || !Array.isArray(args.swapTargets) || args.swapTargets.length !== 2) {
                console.warn('[GameMachine-ResolveAbility] Swap targets issue: Missing, not an array, or incorrect number of targets.');
                return;
            }

            for (const target of args.swapTargets) {
              if (typeof target.playerID !== 'string' || typeof target.cardIndex !== 'number' || target.cardIndex < 0) {
                console.warn(`[GameMachine-ResolveAbility] Swap target invalid: Malformed target object ${JSON.stringify(target)}.`);
                return;
              }
              const targetPlayer = playersToAssign[target.playerID];
              if (!targetPlayer) {
                  console.warn(`[GameMachine-ResolveAbility] Swap target invalid: Player ${target.playerID} not found.`);
                  return;
              }
              if (target.cardIndex >= targetPlayer.hand.length) {
                  console.warn(`[GameMachine-ResolveAbility] Swap target invalid: cardIndex ${target.cardIndex} out of bounds for player ${target.playerID} (hand length: ${targetPlayer.hand.length}).`);
                  return;
              }
              if (targetPlayer.isLocked) {
                const instigatingPlayerName = getPlayerNameForLog(event.playerId, context);
                const lockedPlayerName = getPlayerNameForLog(target.playerID, context);
                console.warn(`[GameMachine-ResolveAbility] Player ${instigatingPlayerName} attempted to swap with a locked player ${lockedPlayerName}. Action denied.`);
                return;
              }
            }
            if (args.swapTargets[0].playerID === args.swapTargets[1].playerID && args.swapTargets[0].cardIndex === args.swapTargets[1].cardIndex) {
              console.warn('[GameMachine-ResolveAbility] Swap targets issue: Targets must be two different cards.');
              return;
            }

            const t1Name = getPlayerNameForLog(args.swapTargets[0].playerID, context);
            const t2Name = getPlayerNameForLog(args.swapTargets[1].playerID, context);
            const swapMsg = `${getPlayerNameForLog(event.playerId, context)} used ${abilityRank} to swap ${t1Name}'s card (idx ${args.swapTargets[0].cardIndex}) with ${t2Name}'s card (idx ${args.swapTargets[1].cardIndex}).`;
            logEventsToEmit.push({ message: swapMsg, type: 'player_action', actorId: event.playerId });

            lastResolvedAbilityCardToAssign = pendingAbility.card;
            lastResolvedAbilitySourceToAssign = pendingAbility.source;
            lastPlayerToResolveAbilityToAssign = pendingAbility.playerId;
            const resolvedAbilitySource = pendingAbility.source;
            pendingAbilitiesToAssign.shift();

            if (resolvedAbilitySource === 'discard' || resolvedAbilitySource === 'stackSecondOfPair') {
              if (matchingOpportunityInfoToAssign && matchingOpportunityInfoToAssign.cardToMatch.id === lastResolvedAbilityCardToAssign?.id) {
                 matchingOpportunityInfoToAssign = null;
              }
            }

            let finalNextPhaseToAssign: GamePhase;
            let finalPlayerWhoCalledCheckToAssign = context.playerWhoCalledCheck;
            let finalMatchDetailsToAssign = context.matchResolvedDetails;
            const logEventsForPhaseTransition: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string }> = [];

            if (pendingAbilitiesToAssign.length > 0) {
                finalNextPhaseToAssign = 'abilityResolutionPhase';
            } else {
                if (finalMatchDetailsToAssign?.isAutoCheck) {
                    finalNextPhaseToAssign = 'finalTurnsPhase';
                    if (!finalPlayerWhoCalledCheckToAssign) {
                        finalPlayerWhoCalledCheckToAssign = finalMatchDetailsToAssign.byPlayerId;
                    }
                    logEventsForPhaseTransition.push({ message: `Auto-check by ${getPlayerNameForLog(finalMatchDetailsToAssign.byPlayerId, context)} processed after abilities. Transitioning to final turns.`, type: 'game_event' });
                } else if (finalPlayerWhoCalledCheckToAssign) {
                    finalNextPhaseToAssign = 'finalTurnsPhase';
                    logEventsForPhaseTransition.push({ message: `Abilities resolved. Continuing final turns.`, type: 'game_event' });
                } else {
                    finalNextPhaseToAssign = 'playPhase';
                    logEventsForPhaseTransition.push({ message: `Abilities resolved. Transitioning to play phase.`, type: 'game_event' });
                }
                finalMatchDetailsToAssign = null;
                globalAbilityTargetsToAssign = null;
            }

            enqueue.assign({
              players: playersToAssign,
              pendingAbilities: pendingAbilitiesToAssign,
              currentPhase: finalNextPhaseToAssign,
              globalAbilityTargets: globalAbilityTargetsToAssign,
              lastResolvedAbilityCardForCleanup: lastResolvedAbilityCardToAssign,
              lastResolvedAbilitySource: lastResolvedAbilitySourceToAssign,
              lastPlayerToResolveAbility: lastPlayerToResolveAbilityToAssign,
              matchingOpportunityInfo: matchingOpportunityInfoToAssign,
              playerWhoCalledCheck: finalPlayerWhoCalledCheckToAssign,
              matchResolvedDetails: finalMatchDetailsToAssign,
            });

            for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
            for (const logData of logEventsForPhaseTransition) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });}
            return;
          }

          console.warn(`[GameMachine-ResolveAbility] Unhandled ability or stage: ${abilityRank}, stage: ${pendingAbility.currentAbilityStage}`);
          pendingAbilitiesToAssign.shift();
          let fallbackNextPhase: GamePhase;
          let fallbackPlayerWhoCalledCheck = context.playerWhoCalledCheck;
          let fallbackMatchDetails = context.matchResolvedDetails;
          let fallbackGlobalAbilityTargets = null;
          const fallbackLogEvents: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'>> = [];

          if (pendingAbilitiesToAssign.length > 0) {
            fallbackNextPhase = 'abilityResolutionPhase';
          } else {
            if (fallbackMatchDetails?.isAutoCheck) {
                fallbackNextPhase = 'finalTurnsPhase';
                if (!fallbackPlayerWhoCalledCheck) { fallbackPlayerWhoCalledCheck = fallbackMatchDetails.byPlayerId; }
                fallbackLogEvents.push({ message: `Auto-check by ${getPlayerNameForLog(fallbackMatchDetails.byPlayerId, context)} (after fallback ability handling) processed. Transitioning to final turns.`, type: 'game_event' });
            } else if (fallbackPlayerWhoCalledCheck) {
                fallbackNextPhase = 'finalTurnsPhase';
                fallbackLogEvents.push({ message: `Abilities resolved (after fallback ability handling). Continuing final turns.`, type: 'game_event' });
            } else {
                fallbackNextPhase = 'playPhase';
                fallbackLogEvents.push({ message: `Abilities resolved (after fallback ability handling). Transitioning to play phase.`, type: 'game_event' });
            }
            fallbackMatchDetails = null;
          }
          enqueue.assign({
              pendingAbilities: pendingAbilitiesToAssign,
              currentPhase: fallbackNextPhase,
              globalAbilityTargets: fallbackGlobalAbilityTargets,
              playerWhoCalledCheck: fallbackPlayerWhoCalledCheck,
              matchResolvedDetails: fallbackMatchDetails,
          });
          for (const logData of fallbackLogEvents) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });}
          return;
        })
      },
      _HANDLE_FORFEITURE_CONSEQUENCES: {
        actions: enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
          const { forfeitedPlayerId } = event as Extract<GameMachineEvent, { type: '_HANDLE_FORFEITURE_CONSEQUENCES' }>;
          const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string }> = [];
          let changesMade = false;

          let newContextValues = {
            currentPhase: context.currentPhase,
            currentPlayerId: context.currentPlayerId,
            activePlayers: { ...context.activePlayers },
            pendingAbilities: [...context.pendingAbilities],
            currentTurnSegment: context.currentTurnSegment,
            playerWhoCalledCheck: context.playerWhoCalledCheck,
            matchResolvedDetails: context.matchResolvedDetails,
          };

          const forfeitedPlayerName = getPlayerNameForLog(forfeitedPlayerId, context);
          const activeNonForfeitedPlayers = Object.values(context.players).filter(p => p && !p.forfeited).length;

          if (activeNonForfeitedPlayers < 2 && newContextValues.currentPhase !== 'scoringPhase' && newContextValues.currentPhase !== 'gameOver') {
            logEventsToEmit.push({ message: `Game ends: only ${activeNonForfeitedPlayers} player(s) remain after ${forfeitedPlayerName} forfeited.`, type: 'game_event' });
            newContextValues.currentPhase = 'scoringPhase';
            newContextValues.currentPlayerId = '';
            newContextValues.activePlayers = {};
            newContextValues.currentTurnSegment = null;
            changesMade = true;
          } else if (newContextValues.currentPhase !== 'scoringPhase' && newContextValues.currentPhase !== 'gameOver') {
            if (newContextValues.currentPlayerId === forfeitedPlayerId && (newContextValues.currentPhase === 'playPhase' || newContextValues.currentPhase === 'finalTurnsPhase')) {
              logEventsToEmit.push({ message: `${forfeitedPlayerName} forfeited during their turn. Turn skipped.`, type: 'game_event' });
              newContextValues.currentPlayerId = '';
              newContextValues.activePlayers = {};
              newContextValues.currentTurnSegment = null;
              changesMade = true;
            } else if (newContextValues.currentPhase === 'matchingStage' && newContextValues.activePlayers[forfeitedPlayerId] === PlayerActivityStatus.AWAITING_MATCH_ACTION) {
              logEventsToEmit.push({ message: `${forfeitedPlayerName} forfeited during matching stage. Auto-passed.`, type: 'game_event' });
              delete newContextValues.activePlayers[forfeitedPlayerId];
              changesMade = true;
            } else if (newContextValues.currentPhase === 'abilityResolutionPhase' && newContextValues.pendingAbilities.length > 0 && newContextValues.pendingAbilities[0].playerId === forfeitedPlayerId) {
              const skippedAbility = newContextValues.pendingAbilities[0];
              logEventsToEmit.push({ message: `${forfeitedPlayerName} forfeited. Their ${skippedAbility.card.rank} ability is skipped.`, type: 'game_event' });
              newContextValues.pendingAbilities.shift();
              newContextValues.activePlayers = {};
              newContextValues.currentPlayerId = '';
              newContextValues.currentTurnSegment = null;
              changesMade = true;
              newContextValues.currentPhase = 'abilityResolutionPhase';
            }
          }

          if (changesMade) {
            const assignments: Partial<GameMachineContext> = {};
            if (newContextValues.currentPhase !== context.currentPhase) assignments.currentPhase = newContextValues.currentPhase;
            if (newContextValues.currentPlayerId !== context.currentPlayerId) assignments.currentPlayerId = newContextValues.currentPlayerId;
            if (JSON.stringify(newContextValues.activePlayers) !== JSON.stringify(context.activePlayers)) assignments.activePlayers = newContextValues.activePlayers;
            if (JSON.stringify(newContextValues.pendingAbilities) !== JSON.stringify(context.pendingAbilities)) assignments.pendingAbilities = newContextValues.pendingAbilities;
            if (newContextValues.currentTurnSegment !== context.currentTurnSegment) assignments.currentTurnSegment = newContextValues.currentTurnSegment;
            if (newContextValues.playerWhoCalledCheck !== context.playerWhoCalledCheck) assignments.playerWhoCalledCheck = newContextValues.playerWhoCalledCheck;
            if (newContextValues.matchResolvedDetails !== context.matchResolvedDetails) assignments.matchResolvedDetails = newContextValues.matchResolvedDetails;

            if (Object.keys(assignments).length > 0) {
              enqueue.assign(assignments);
            }

            for (const logData of logEventsToEmit) {
              enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });
            }
            enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
          } else {
            for (const logData of logEventsToEmit) {
                 enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });
            }
          }
        })
      }
    },
  states: {
    awaitingPlayers: {
      tags: ['INITIALIZATION_COMPLETED'],
      on: {
        PLAYER_JOIN_REQUEST: {
          guard: 'canPlayerJoin',
          actions: 'handlePlayerJoin',
        },
        [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
          target: 'updateAndCheckReady',
          guard: 'playerCanDeclareReadyForPeek',
        },
      },
    },
    updateAndCheckReady: {
      entry: [
            assign(
              ({ context, event }: {
                context: GameMachineContext;
            event: GameMachineEvent;
              }) => {
            if (event.type !== PlayerActionType.DECLARE_READY_FOR_PEEK) return {};
                const player = context.players[event.playerId];
                if (!player || player.isReadyForInitialPeek) return {};

                return {
                  players: {
                    ...context.players,
                    [event.playerId]: { ...player, isReadyForInitialPeek: true }
                  },
                };
              }
            ),
            enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
          if (event.type !== PlayerActionType.DECLARE_READY_FOR_PEEK) return;
          const playerName = getPlayerNameForLog(event.playerId, context);
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `${playerName} is ready for the initial peek.`,
                  type: 'player_action',
              actorId: event.playerId
                }
              });
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
            })
      ],
      always: [
        {
          target: 'initialPeekPhase',
          guard: 'allJoinedPlayersReadyAndMinPlayersMet'
        },
        {
          target: 'awaitingPlayers'
        }
      ]
    },
    initialPeekPhase: {
      entry: [
        assign(
          ({ context }: {
            context: GameMachineContext;
          }) => {
            const peekDeadline = Date.now() + PEEK_TOTAL_DURATION_MS;
            const playersWithPeekInfo = { ...context.players };
            context.turnOrder.forEach(pid => {
              const p = playersWithPeekInfo[pid];
              if (p) {
                const cardsToPeekSource = p.hand.length >= 4 ? [p.hand[2], p.hand[3]] : p.hand.slice(-2);
                playersWithPeekInfo[pid] = {
                  ...p,
                  cardsToPeek: cardsToPeekSource,
                  peekAcknowledgeDeadline: peekDeadline,
                };
              }
            });
              return {
              players: playersWithPeekInfo,
                  initialPeekAllReadyTimestamp: Date.now(),
              currentPhase: 'initialPeekPhase' as GamePhase,
              currentPlayerId: context.turnOrder[0] || '',
            };
          }
        ),
        enqueueActions(({ context, enqueue }: { context: GameMachineContext, enqueue: any }) => {
          enqueue.emit({
            type: 'EMIT_LOG_PUBLIC',
            gameId: context.gameId,
            publicLogData: {
              message: 'All players ready. Initial peek starting!',
              type: 'game_event',
            }
          });
          enqueue(raise({ type: 'PEEK_TIMER_EXPIRED' }, { delay: PEEK_TOTAL_DURATION_MS }));
          enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
        })
      ],
      on: {
        PEEK_TIMER_EXPIRED: {
          target: 'playPhase',
          actions: [
            assign(({ context }: { context: GameMachineContext; }) => {
            const newPlayers = { ...context.players };
              context.turnOrder.forEach((pid: string) => {
                if (newPlayers[pid]) {
                    newPlayers[pid].cardsToPeek = null;
                  newPlayers[pid].hasCompletedInitialPeek = true;
                    newPlayers[pid].peekAcknowledgeDeadline = null;
                }
            });
            return {
                initialPeekAllReadyTimestamp: null,
                players: newPlayers,
            };
          }),
            enqueueActions(({ context, enqueue }: { context: GameMachineContext, enqueue: any }) => {
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: 'Initial peek has ended. Starting play phase.',
                  type: 'game_event',
                }
              });
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
            })
          ]
        },
        [PlayerActionType.ACKNOWLEDGE_PEEK]: {
          actions: assign({
            players: ({ context, event }) => {
              const player = context.players[event.playerId];
              if (!player) return context.players;
              return {
                ...context.players,
                [event.playerId]: {
                  ...player,
                  hasAcknowledgedPeek: true,
                },
              };
            },
          }),
        },
      },
      always: {
        guard: ({ context }) => {
          return context.turnOrder.every(
            (pid) => context.players[pid]?.forfeited || context.players[pid]?.hasAcknowledgedPeek
          );
        },
        target: 'playPhase',
      },
    },
    playPhase: {
          initial: 'determiningPlayer',
          states: {
            determiningPlayer: {
              entry: assign(( { context }: { context: GameMachineContext } ) => {
                let nextPlayerId = '';
                let currentPlayerIndex = context.turnOrder.indexOf(context.currentPlayerId);
                let attempts = 0;

                if (context.turnOrder.length === 0) {
                  return {
                    currentPlayerId: '',
                    globalAbilityTargets: null,
                    lastRegularSwapInfo: null,
                    matchResolvedDetails: null,
                    lastResolvedAbilityCardForCleanup: null,
                    lastResolvedAbilitySource: null,
                    lastPlayerToResolveAbility: null,
                  };
                }

                const playerIsInvalidOrPhaseChanging =
                  !context.currentPlayerId ||
                  !context.players[context.currentPlayerId] ||
                  context.players[context.currentPlayerId].isLocked ||
                  context.players[context.currentPlayerId].forfeited ||
                  context.currentPhase !== 'playPhase';

                if (playerIsInvalidOrPhaseChanging) {
                   currentPlayerIndex = -1;
                }

                do {
                  currentPlayerIndex = (currentPlayerIndex + 1) % context.turnOrder.length;
                  const potentialNextPlayerId = context.turnOrder[currentPlayerIndex];
                  const potentialPlayer = context.players[potentialNextPlayerId];
                  if (potentialPlayer && !potentialPlayer.isLocked && !potentialPlayer.forfeited) {
                    nextPlayerId = potentialNextPlayerId;
                    break;
                  }
                  attempts++;
                } while (attempts < context.turnOrder.length);

                if (!nextPlayerId) {
                  return {
                    currentPlayerId: '',
                    globalAbilityTargets: null,
                    lastRegularSwapInfo: null,
                    matchResolvedDetails: null,
                    lastResolvedAbilityCardForCleanup: null,
                    lastResolvedAbilitySource: null,
                    lastPlayerToResolveAbility: null,
                  };
                }

                let newTotalTurnsInRound = context.totalTurnsInRound;
                if (context.currentPlayerId !== nextPlayerId && !context.playerWhoCalledCheck) {
                    newTotalTurnsInRound++;
                }

                return {
                  currentPlayerId: nextPlayerId,
                  currentTurnSegment: 'initialAction' as TurnSegment,
                  discardPileIsSealed: false,
                  totalTurnsInRound: newTotalTurnsInRound,
                  activePlayers: { [nextPlayerId]: PlayerActivityStatus.PLAY_PHASE_ACTIVE },
                  globalAbilityTargets: null,
                  lastRegularSwapInfo: null,
                  matchResolvedDetails: null,
                  lastResolvedAbilityCardForCleanup: null,
                  lastResolvedAbilitySource: null,
                  lastPlayerToResolveAbility: null,
                };
              }),
              always: [
                {
                  target: 'playerTurn',
                  guard: ({context}: { context: GameMachineContext }) => context.currentPlayerId !== '',
                  actions: assign({ currentPhase: 'playPhase' as GamePhase })
                },
                {
                  target: '#checkGame.scoringPhase',
                  actions: [
                    assign({ currentPhase: 'scoringPhase' as GamePhase }),
                    enqueueActions(({ context, enqueue }: { context: GameMachineContext, enqueue: any }) => {
                      enqueue.emit({
                        type: 'EMIT_LOG_PUBLIC',
                        gameId: context.gameId,
                        publicLogData: {
                          message: "Stalemate: No valid player available. Proceeding to scoring.",
                          type: 'game_event'
                        }
                      });
                    })
                  ]
                }
              ]
            },
            playerTurn: {
              invoke: {
                id: 'turnTimer',
                src: 'turnTimerActor',
                input: ({ context }: { context: GameMachineContext }) => ({
                    playerId: context.currentPlayerId,
                    duration: TURN_DURATION_MS
                }),
                onDone: {
                  target: '.handleTimeout'
                }
              },
              initial: 'awaitingInitialAction',
              states: {
                awaitingInitialAction: {
                  entry: assign({ currentTurnSegment: 'initialAction' as TurnSegment }),
                  on: {
                    [PlayerActionType.DRAW_FROM_DECK]: {
                      target: 'awaitingPostDrawAction',
                      guard: and([
                          { type: 'canPerformInitialDrawAction' },
                          { type: 'deckIsNotEmpty' }
                      ]),
                      actions: [
                        assign(
                          ({ context, event }: {
                            context: GameMachineContext;
                            event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK }>;
                          }) => {
                        const player = context.players[event.playerId];
                            const newDeck = [...context.deck];
                            const cardDrawn = newDeck.pop()!;
                            const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'deck' as const };


                            return {
                              players: { ...context.players, [event.playerId]: updatedPlayer },
                              deck: newDeck
                            };
                          }
                        ),
                        enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                          const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK }>;
                          const player = context.players[drawEvent.playerId];
                          const cardDrawn = player?.pendingDrawnCard;

                          if (player && cardDrawn) {
                            const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                            enqueue.emit({
                              type: 'EMIT_LOG_PUBLIC',
                              gameId: context.gameId,
                              publicLogData: {
                                message: `${playerName} drew a card from the deck.`,
                                type: 'player_action',
                                actorId: drawEvent.playerId
                              }
                            });
                            enqueue.emit({
                              type: 'EMIT_LOG_PRIVATE',
                              gameId: context.gameId,
                              recipientPlayerId: drawEvent.playerId,
                              privateLogData: {
                                message: `You drew ${cardDrawn.rank}${cardDrawn.suit} from the deck.`,
                                type: 'player_action',
                                actorId: drawEvent.playerId,
                                cardContext: `${cardDrawn.rank}${cardDrawn.suit}`
                              }
                            });
                          }
                        })
                      ]
                    },
                    [PlayerActionType.DRAW_FROM_DISCARD]: {
                      target: 'awaitingPostDrawAction',
                      guard: and([
                          { type: 'canPerformInitialDrawAction' },
                          { type: 'discardIsDrawable' }
                      ]),
                      actions: [
                        assign((
                          { context, event }: {
                            context: GameMachineContext;
                            event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD }>;
                          }) => {
                            const player = context.players[event.playerId];
                            const newDiscardPile = [...context.discardPile];
                            const cardDrawn = newDiscardPile.shift()!;
                            const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'discard' as const };


                            return {
                              players: { ...context.players, [event.playerId]: updatedPlayer },
                              discardPile: newDiscardPile
                            };
                          }
                        ),
                        enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                          const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD }>;
                          const player = context.players[drawEvent.playerId];
                          const cardDrawn = player?.pendingDrawnCard;

                          if (player && cardDrawn) {
                            const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                            enqueue.emit({
                              type: 'EMIT_LOG_PUBLIC',
                              gameId: context.gameId,
                              publicLogData: {
                                message: `${playerName} drew ${cardDrawn.rank}${cardDrawn.suit} from the discard pile.`,
                                type: 'player_action',
                                actorId: drawEvent.playerId,
                                cardContext: `${cardDrawn.rank}${cardDrawn.suit}`
                              }
                            });
                          }
                        })
                      ]
                    },
                    [PlayerActionType.CALL_CHECK]: {
                        target: '#checkGame.finalTurnsPhase',
                        guard: { type: 'isValidCallCheck' },
                        actions: [
                          assign(
                            ({ context, event }: {
                              context: GameMachineContext;
                              event: Extract<GameMachineEvent, { type: PlayerActionType.CALL_CHECK }>;
                            }) => {
                            const player = context.players[event.playerId];
                            const updatedPlayer = { ...player!, hasCalledCheck: true, isLocked: true };
                            let newPlayerWhoCalledCheck = context.playerWhoCalledCheck;
                            if (!context.playerWhoCalledCheck) {
                                newPlayerWhoCalledCheck = event.playerId;
                            }


                            return {
                              players: { ...context.players, [event.playerId]: updatedPlayer },
                              playerWhoCalledCheck: newPlayerWhoCalledCheck,
                              finalTurnsTaken: 0,
                              currentPhase: 'finalTurnsPhase' as GamePhase
                            };
                          }),
                          enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                            const callCheckEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.CALL_CHECK }>;
                            const playerName = getPlayerNameForLog(callCheckEvent.playerId, context);
                            enqueue.emit({
                              type: 'EMIT_LOG_PUBLIC',
                              gameId: context.gameId,
                              publicLogData: {
                                message: `${playerName} called Check!`,
                                type: 'player_action',
                                actorId: callCheckEvent.playerId
                              }
                            });
                          })
                        ]
                    }
                  }
                },
                awaitingPostDrawAction: {
                  entry: assign({ currentTurnSegment: 'postDrawAction' as TurnSegment }),
                  on: {
                    [PlayerActionType.SWAP_AND_DISCARD]: {
                        target: '#checkGame.matchingStage',
                        guard: { type: 'isValidSwapAndDiscard' },
                        actions: [
                          assign(
                            ({ context, event }: {
                              context: GameMachineContext;
                              event: Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                            }) => {
                    const player = context.players[event.playerId];
                            const newHand = [...player!.hand];
                            const cardToPlaceInHand: Card = { ...player!.pendingDrawnCard!, isFaceDownToOwner: true };
                            const cardFromHand = newHand.splice(event.handIndex, 1, cardToPlaceInHand)[0];
                            const updatedPlayer = { ...player!, hand: newHand, pendingDrawnCard: null, pendingDrawnCardSource: null };

                            const newDiscardPile = [cardFromHand, ...context.discardPile];
                            const newLastRegularSwapInfo = { playerId: event.playerId, handIndex: event.handIndex, timestamp: Date.now() };

                            const potentialMatchers = Object.keys(context.players).filter((pId: string) => {
                        const p = context.players[pId];
                        return p && !p.isLocked && !p.hasCalledCheck;
                    });
                            const newMatchingOpportunityInfo = { cardToMatch: cardFromHand, originalPlayerID: event.playerId, potentialMatchers };
                            const newActivePlayers = potentialMatchers.reduce((acc, pId) => {
                        acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                        return acc;
                    }, {} as { [playerID: string]: PlayerActivityStatus });

                            return {
                                players: { ...context.players, [event.playerId]: updatedPlayer },
                                discardPile: newDiscardPile,
                                discardPileIsSealed: false,
                                lastRegularSwapInfo: newLastRegularSwapInfo,
                                matchingOpportunityInfo: newMatchingOpportunityInfo,
                                activePlayers: newActivePlayers,
                                currentPhase: 'matchingStage' as GamePhase,
                                currentTurnSegment: null
                            };
                          }),
                          enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                            const swapEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                            const player = context.players[swapEvent.playerId];
                            const playerName = getPlayerNameForLog(swapEvent.playerId, context);

                            const discardedCard = context.discardPile[0];
                            const keptCard = player?.hand[swapEvent.handIndex];

                            if (player && discardedCard && keptCard) {
                              const discardedCardStr = `${discardedCard.rank}${discardedCard.suit}`;
                              const keptCardStr = `${keptCard.rank}${keptCard.suit}`;

                              enqueue.emit({
                                type: 'EMIT_LOG_PUBLIC',
                                gameId: context.gameId,
                                publicLogData: {
                                  message: `${playerName} discarded ${discardedCardStr} and kept their drawn card.`,
                                  type: 'player_action',
                                  actorId: swapEvent.playerId,
                                  cardContext: `Discarded ${discardedCardStr}`
                                }
                              });

                              enqueue.emit({
                                type: 'EMIT_LOG_PRIVATE',
                                gameId: context.gameId,
                                recipientPlayerId: swapEvent.playerId,
                                privateLogData: {
                                  message: `You discarded ${discardedCardStr} and kept ${keptCardStr}.`,
                                  type: 'player_action',
                                  actorId: swapEvent.playerId,
                                  cardContext: `Discarded: ${discardedCardStr}, Kept: ${keptCardStr}`
                                }
                              });
                            }
                          })
                        ]
                    },
                    [PlayerActionType.DISCARD_DRAWN_CARD]: {
                        target: '#checkGame.matchingStage',
                        guard: { type: 'isValidDiscardDrawnCard' },
                        actions: [
                          assign((
                            { context, event }: {
                              context: GameMachineContext;
                              event: Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                            }) => {
                    const player = context.players[event.playerId];
                            const drawnCardToDiscard = player.pendingDrawnCard!;
                            const updatedPlayer = { ...player, pendingDrawnCard: null, pendingDrawnCardSource: null };
                            const newDiscardPile = [drawnCardToDiscard, ...context.discardPile];


                            const potentialMatchers = Object.keys(context.players).filter((pId: string) => {
                        const p = context.players[pId];
                        return p && !p.isLocked && !p.hasCalledCheck;
                    });
                            const newMatchingOpportunityInfo = { cardToMatch: drawnCardToDiscard, originalPlayerID: event.playerId, potentialMatchers };
                            const newActivePlayers = potentialMatchers.reduce((acc, pId) => {
                        acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                        return acc;
                    }, {} as { [playerID: string]: PlayerActivityStatus });

                            return {
                                players: { ...context.players, [event.playerId]: updatedPlayer },
                                discardPile: newDiscardPile,
                                discardPileIsSealed: false,
                                matchingOpportunityInfo: newMatchingOpportunityInfo,
                                activePlayers: newActivePlayers,
                                currentPhase: 'matchingStage' as GamePhase,
                                currentTurnSegment: null
                            };
                          }),
                          enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                            const discardEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                            const playerName = getPlayerNameForLog(discardEvent.playerId, context);
                            const discardedCard = context.discardPile[0];

                            if (discardedCard) {
                              const discardedCardStr = `${discardedCard.rank}${discardedCard.suit}`;
                              enqueue.emit({
                                type: 'EMIT_LOG_PUBLIC',
                                gameId: context.gameId,
                                publicLogData: {
                                  message: `${playerName} discarded their drawn card ${discardedCardStr}.`,
                                  type: 'player_action',
                                  actorId: discardEvent.playerId,
                                  cardContext: discardedCardStr
                                }
                              });
                            }
                          })
                        ]
                    }
                  }
                },
                handleTimeout: {
                  entry: enqueueActions(( { context, event, enqueue }: { context: GameMachineContext, event: any, enqueue: any } ) => {
                      const timedOutPlayerId = event.output?.timedOutPlayerId || context.currentPlayerId;
                      const player = context.players[timedOutPlayerId];
                      const actorNameForLog = getPlayerNameForLog(timedOutPlayerId, context);

                      const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, cardContext?: string, targetName?: string }> = [];

                      let playersToAssign = { ...context.players };
                      let deckToAssign = [...context.deck];
                      let discardPileToAssign = [...context.discardPile];
                      let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo;
                      let activePlayersToAssign = { ...context.activePlayers };
                      let nextPhaseToAssign: GamePhase = context.currentPhase;
                      let nextTurnSegmentToAssign: TurnSegment | null = null;
                      let discardPileIsSealedToAssign = context.discardPileIsSealed;
                      let pendingAbilitiesToAssign = [...context.pendingAbilities];
                      let globalAbilityTargetsToAssign = context.globalAbilityTargets;
                      let lastResolvedAbilityCardToAssign = context.lastResolvedAbilityCardForCleanup;
                      let lastResolvedAbilitySourceToAssign = context.lastResolvedAbilitySource;
                      let lastPlayerToResolveAbilityToAssign = context.lastPlayerToResolveAbility;

                      let generalTimeoutMessage = `Player ${actorNameForLog} timed out`;

                      if (!player && context.currentPhase !== 'abilityResolutionPhase') {
                        logEventsToEmit.push({
                          message: `Critical Error: Timed out player ${timedOutPlayerId} not found.`,
                          type: 'error',
                        });
                        enqueue.assign({ currentPhase: 'error' as GamePhase });
                        for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
                        return;
                      }

                      if (context.currentPhase === 'abilityResolutionPhase' && pendingAbilitiesToAssign.length > 0) {
                          const pendingAbility = pendingAbilitiesToAssign[0];
                          if (pendingAbility.playerId === timedOutPlayerId) {
                              generalTimeoutMessage = `${actorNameForLog} timed out during ${pendingAbility.card.rank} ability resolution. Ability skipped.`;

                              lastResolvedAbilityCardToAssign = pendingAbility.card;
                              lastResolvedAbilitySourceToAssign = pendingAbility.source;
                              lastPlayerToResolveAbilityToAssign = pendingAbility.playerId;
                              const skippedAbilitySource = pendingAbility.source;
                              pendingAbilitiesToAssign.shift();
                              globalAbilityTargetsToAssign = null;

                              if (skippedAbilitySource === 'discard' || skippedAbilitySource === 'stackSecondOfPair') {
                                  if (matchingOpportunityInfoToAssign && matchingOpportunityInfoToAssign.cardToMatch.id === lastResolvedAbilityCardToAssign?.id) {
                                      matchingOpportunityInfoToAssign = null;
                                  }
                              }
                              nextPhaseToAssign = pendingAbilitiesToAssign.length > 0 ? 'abilityResolutionPhase'
                                          : (context.playerWhoCalledCheck ? 'finalTurnsPhase' : 'playPhase');
                              nextTurnSegmentToAssign = null;
                          } else {
                              generalTimeoutMessage += ` during ability resolution, but was not the active ability player. Turn advances.`;
                              nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' : 'playPhase';
                              nextTurnSegmentToAssign = null;
                          }
                      } else if (context.currentTurnSegment === 'initialAction') {
                        generalTimeoutMessage += ' during their initial action. Turn advances.';
                        nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' : 'playPhase';
                        nextTurnSegmentToAssign = null;
                      } else if (context.currentTurnSegment === 'postDrawAction') {
                        generalTimeoutMessage += ' after drawing a card.';
                        if (playersToAssign[timedOutPlayerId] && playersToAssign[timedOutPlayerId].pendingDrawnCard) {
                          const timedOutPlayerState = playersToAssign[timedOutPlayerId];
                          const drawnCard = timedOutPlayerState.pendingDrawnCard!;
                          const drawnCardStr = drawnCard.rank + drawnCard.suit;
                          if (timedOutPlayerState.pendingDrawnCardSource === 'deck') {
                            logEventsToEmit.push({
                                message: `${actorNameForLog} timed out and their drawn card ${drawnCardStr} was auto-discarded.`,
                                type: 'game_event', actorId: timedOutPlayerId, cardContext: drawnCardStr
                            });
                            discardPileToAssign.unshift(drawnCard);
                            playersToAssign[timedOutPlayerId] = { ...timedOutPlayerState, pendingDrawnCard: null, pendingDrawnCardSource: null };

                            if (context.currentPhase === 'finalTurnsPhase') {
                              nextPhaseToAssign = 'matchingStage' as GamePhase;
                              discardPileIsSealedToAssign = false;
                              const potentialMatchers = Object.keys(playersToAssign).filter(pId => {
                                const p = playersToAssign[pId];
                                return p && !p.isLocked && !p.hasCalledCheck && pId !== context.playerWhoCalledCheck;
                              });
                              matchingOpportunityInfoToAssign = { cardToMatch: drawnCard, originalPlayerID: timedOutPlayerId, potentialMatchers };
                              activePlayersToAssign = potentialMatchers.reduce((acc, pId) => {
                                  acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                                  return acc;
                              }, {} as { [playerID: string]: PlayerActivityStatus });
                            } else {
                              nextPhaseToAssign = 'matchingStage' as GamePhase;
                              discardPileIsSealedToAssign = false;
                              const potentialMatchers = Object.keys(playersToAssign).filter(pId => {
                                  const p = playersToAssign[pId];
                                  return p && !p.isLocked && !p.hasCalledCheck;
                              });
                              matchingOpportunityInfoToAssign = { cardToMatch: drawnCard, originalPlayerID: timedOutPlayerId, potentialMatchers };
                              activePlayersToAssign = potentialMatchers.reduce((acc, pId) => {
                                  acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                                  return acc;
                              }, {} as { [playerID: string]: PlayerActivityStatus });
                            }
                          } else if (timedOutPlayerState.pendingDrawnCardSource === 'discard') {
                            let cardToUseForMatchingAndAbilities: Card | null = null;
                            if (timedOutPlayerState.hand.length > 0) {
                              const cardFromHand = timedOutPlayerState.hand[0];
                              cardToUseForMatchingAndAbilities = cardFromHand;
                              const cardFromHandStr = cardFromHand.rank + cardFromHand.suit;
                              const newHand = [...timedOutPlayerState.hand];
                              newHand.splice(0, 1, drawnCard);
                              discardPileToAssign.unshift(cardFromHand);
                              playersToAssign[timedOutPlayerId] = { ...timedOutPlayerState, hand: newHand, pendingDrawnCard: null, pendingDrawnCardSource: null };
                              logEventsToEmit.push({
                                  message: `${actorNameForLog} timed out. Card ${drawnCardStr} (from discard) kept, ${cardFromHandStr} from hand auto-discarded.`,
                                  type: 'game_event', actorId: timedOutPlayerId, cardContext: `Kept ${drawnCardStr}, Discarded ${cardFromHandStr}`
                              });
                            } else {
                              cardToUseForMatchingAndAbilities = drawnCard;
                              logEventsToEmit.push({
                                  message: `${actorNameForLog} timed out. Card ${drawnCardStr} (from discard) auto-discarded (hand empty).`,
                                  type: 'game_event', actorId: timedOutPlayerId, cardContext: drawnCardStr
                              });
                              discardPileToAssign.unshift(drawnCard);
                              playersToAssign[timedOutPlayerId] = { ...timedOutPlayerState, pendingDrawnCard: null, pendingDrawnCardSource: null };
                            }

                            if (context.currentPhase === 'finalTurnsPhase') {
                              nextPhaseToAssign = 'matchingStage' as GamePhase;
                              discardPileIsSealedToAssign = false;
                              const potentialMatchers = Object.keys(playersToAssign).filter(pId => {
                                  const p = playersToAssign[pId];
                                  return p && !p.isLocked && !p.hasCalledCheck && pId !== context.playerWhoCalledCheck;
                              });
                              matchingOpportunityInfoToAssign = { cardToMatch: cardToUseForMatchingAndAbilities!, originalPlayerID: timedOutPlayerId, potentialMatchers };
                              activePlayersToAssign = potentialMatchers.reduce((acc, pId) => {
                                  acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                                  return acc;
                              }, {} as { [playerID: string]: PlayerActivityStatus });
                            } else {
                              nextPhaseToAssign = 'matchingStage' as GamePhase;
                              discardPileIsSealedToAssign = false;
                              const potentialMatchers = Object.keys(playersToAssign).filter(pId => {
                                  const p = playersToAssign[pId];
                                  return p && !p.isLocked && !p.hasCalledCheck;
                              });
                              matchingOpportunityInfoToAssign = { cardToMatch: cardToUseForMatchingAndAbilities!, originalPlayerID: timedOutPlayerId, potentialMatchers };
                              activePlayersToAssign = potentialMatchers.reduce((acc, pId) => {
                                  acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                                  return acc;
                              }, {} as { [playerID: string]: PlayerActivityStatus });
                            }
                          }
                        } else {
                          generalTimeoutMessage += ' but had no pending card. Turn advances.';
                          nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' : 'playPhase';
                        }
                        nextTurnSegmentToAssign = null;
                      } else {
                        generalTimeoutMessage += ` during an unexpected segment (${context.currentTurnSegment || 'none'}). Turn advances.`;
                        nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' : (pendingAbilitiesToAssign.length > 0 ? 'abilityResolutionPhase': 'playPhase');
                        nextTurnSegmentToAssign = null;
                      }

                      logEventsToEmit.push({
                        message: generalTimeoutMessage, type: 'game_event', actorId: timedOutPlayerId
                      });

                      if (nextPhaseToAssign !== 'matchingStage' && nextPhaseToAssign !== 'abilityResolutionPhase') {
                          activePlayersToAssign = {};
                      }

                      enqueue.assign({
                        players: playersToAssign,
                        deck: deckToAssign,
                        discardPile: discardPileToAssign,
                        matchingOpportunityInfo: matchingOpportunityInfoToAssign,
                        activePlayers: activePlayersToAssign,
                        currentPhase: nextPhaseToAssign,
                        currentTurnSegment: nextTurnSegmentToAssign,
                        discardPileIsSealed: discardPileIsSealedToAssign,
                        pendingAbilities: pendingAbilitiesToAssign,
                        globalAbilityTargets: globalAbilityTargetsToAssign,
                        lastResolvedAbilityCardForCleanup: lastResolvedAbilityCardToAssign,
                        lastResolvedAbilitySource: lastResolvedAbilitySourceToAssign,
                        lastPlayerToResolveAbility: lastPlayerToResolveAbilityToAssign,
                        playerTimers: {
                          ...context.playerTimers,
                          [timedOutPlayerId]: {
                            ...(context.playerTimers?.[timedOutPlayerId]),
                            turnTimerExpiresAt: undefined
                          }
                        },
                      });

                      for (const logData of logEventsToEmit) {
                          enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });
                      }
                  }),
                  always: [
                    { target: '#checkGame.matchingStage', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'matchingStage' },
                    { target: '#checkGame.abilityResolutionPhase', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'abilityResolutionPhase' },
                    { target: '#checkGame.finalTurnsPhase', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'finalTurnsPhase' },
                    { target: '#checkGame.playPhase.determiningPlayer', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'playPhase' },
                    { target: '#checkGame.playPhase.determiningPlayer' }
                  ]
                }
              }
            }
          }
    },
    matchingStage: {
        entry: [
          assign(({
            context,
            event
          }: { context: GameMachineContext, event: GameMachineEvent }) => {
            return {
              matchingStageTimerExpiresAt: Date.now() + MATCHING_STAGE_DURATION_MS,
            };
          }),
          enqueueActions(({ context, enqueue }: { context: GameMachineContext, enqueue: any }) => {
            enqueue.emit({
              type: 'EMIT_LOG_PUBLIC',
              gameId: context.gameId,
              publicLogData: {
                message: "Matching stage has begun!",
                type: 'game_event'
              }
            });
          })
        ],
        invoke: {
          id: 'matchingStageTimer',
          src: 'matchingStageTimerActor',
          input: { duration: MATCHING_STAGE_DURATION_MS },
          onDone: {
            target: '#checkGame.matchingStage',
            actions: raise({ type: 'MATCHING_STAGE_TIMER_EXPIRED' })
          }
        },
      on: {
        [PlayerActionType.ATTEMPT_MATCH]: {
            guard: { type: 'isValidMatchAttempt' },
            actions: enqueueActions((
              { context, event, enqueue }: {
                context: GameMachineContext;
                event: Extract<GameMachineEvent, { type: PlayerActionType.ATTEMPT_MATCH; handIndex: number }>;
                enqueue: any;
              }) => {
              const player = context.players[event.playerId];
              const cardToMatch = context.matchingOpportunityInfo!.cardToMatch;
              const cardFromHand = player.hand[event.handIndex];

              let playersToAssign = { ...context.players };
              let deckToAssign = [...context.deck];
              let discardPileToAssign = [...context.discardPile];
              let pendingAbilitiesToAssign = [...context.pendingAbilities];
              let activePlayersToAssign = { ...context.activePlayers };
              let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo;
              let nextPhaseToAssign: GamePhase = 'matchingStage';
              let matchResolvedDetailsToAssign: MatchResolvedDetails | null = null;
              let playerWhoCalledCheckToAssign = context.playerWhoCalledCheck;
              let finalTurnsTakenToAssign = context.finalTurnsTaken;
              let discardPileIsSealedToAssign = context.discardPileIsSealed;

              const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, targetName?: string, cardContext?: string }> = [];


              if (cardFromHand.rank === cardToMatch.rank) {
                const updatedHand = player.hand.filter((_, index) => index !== event.handIndex);
                playersToAssign[event.playerId] = {
                  ...player,
                  hand: updatedHand,
                  numMatches: player.numMatches + 1
                };
                discardPileToAssign.unshift(cardFromHand);
                discardPileIsSealedToAssign = true;

                const originalPlayerName = getPlayerNameForLog(matchingOpportunityInfoToAssign!.originalPlayerID, context);
                const cardXStr = `${cardToMatch.rank}${cardToMatch.suit}`;
                const cardYStr = `${cardFromHand.rank}${cardFromHand.suit}`;
                const successMsg = `${getPlayerNameForLog(event.playerId, context)} matched ${originalPlayerName}'s ${cardXStr} with their ${cardYStr}.`;
                logEventsToEmit.push({
                  message: successMsg, type: 'player_action',
                  actorId: event.playerId,
                  targetName: originalPlayerName,
                  cardContext: `${cardYStr} matches ${cardXStr}`
                });

                let abilityResolutionRequired = false;
                const isCardXSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardToMatch.rank);
                const isCardYSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardFromHand.rank);

                if (isCardXSpecial && isCardYSpecial) {
                  let stageForCardY: 'peek' | 'swap' | undefined = undefined;
                  if (cardFromHand.rank === Rank.King || cardFromHand.rank === Rank.Queen) stageForCardY = 'peek';
                  else if (cardFromHand.rank === Rank.Jack) stageForCardY = 'swap';
                  pendingAbilitiesToAssign.push({ playerId: event.playerId, card: cardFromHand, source: 'stack', pairTargetId: matchingOpportunityInfoToAssign!.originalPlayerID, currentAbilityStage: stageForCardY });

                  let stageForCardX: 'peek' | 'swap' | undefined = undefined;
                  if (cardToMatch.rank === Rank.King || cardToMatch.rank === Rank.Queen) stageForCardX = 'peek';
                  else if (cardToMatch.rank === Rank.Jack) stageForCardX = 'swap';
                  pendingAbilitiesToAssign.push({ playerId: matchingOpportunityInfoToAssign!.originalPlayerID, card: cardToMatch, source: 'stackSecondOfPair', pairTargetId: event.playerId, currentAbilityStage: stageForCardX });

                  abilityResolutionRequired = true;
                }

                let autoCheckOccurred = false;
                if (updatedHand.length === 0) {
                  playersToAssign[event.playerId] = {
                    ...playersToAssign[event.playerId],
                    hasCalledCheck: true,
                    isLocked: true
                  };
                  if (!playerWhoCalledCheckToAssign) {
                    playerWhoCalledCheckToAssign = event.playerId;
                    finalTurnsTakenToAssign = 0;
                  }
                  autoCheckOccurred = true;
                  logEventsToEmit.push({
                    message: `${getPlayerNameForLog(event.playerId, context)} emptied hand on match. Auto-Check!`,
                    type: 'game_event',
                    actorId: event.playerId
                  });
                }

                matchResolvedDetailsToAssign = { byPlayerId: event.playerId, isAutoCheck: autoCheckOccurred, abilityResolutionRequired };
                matchingOpportunityInfoToAssign = null;
                activePlayersToAssign = {};

                if (abilityResolutionRequired) {
                  nextPhaseToAssign = 'abilityResolutionPhase' as GamePhase;
                } else if (autoCheckOccurred) {
                  nextPhaseToAssign = 'finalTurnsPhase' as GamePhase;
                } else {
                  nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;
                }

              } else {
                const originalPlayerName = getPlayerNameForLog(matchingOpportunityInfoToAssign!.originalPlayerID, context);
                const cardXStr = `${cardToMatch.rank}${cardToMatch.suit}`;
                const cardYStr = `${cardFromHand.rank}${cardFromHand.suit}`;
                const failMsg = `${getPlayerNameForLog(event.playerId, context)} failed to match ${originalPlayerName}'s ${cardXStr} with their ${cardYStr} and received a penalty card.`;
                logEventsToEmit.push({ message: failMsg, type: 'player_action', actorId: event.playerId });

                if (deckToAssign.length > 0) {
                  const penaltyCard = deckToAssign.pop()!;
                  playersToAssign[event.playerId] = {
                    ...player,
                    hand: [...player.hand, penaltyCard],
                    numPenalties: player.numPenalties + 1
                  };
                } else {
                }

                activePlayersToAssign[event.playerId] = PlayerActivityStatus.MATCH_ACTION_CONCLUDED;
              }

              const allMatchersConcluded = Object.values(activePlayersToAssign).every(status => status === PlayerActivityStatus.MATCH_ACTION_CONCLUDED);

              if (allMatchersConcluded) {
                if (!matchResolvedDetailsToAssign) {
                    nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;
                }
              }

              enqueue.assign({
                players: playersToAssign,
                deck: deckToAssign,
                discardPile: discardPileToAssign,
                pendingAbilities: pendingAbilitiesToAssign,
                activePlayers: activePlayersToAssign,
                matchingOpportunityInfo: matchingOpportunityInfoToAssign,
                currentPhase: nextPhaseToAssign,
                matchResolvedDetails: matchResolvedDetailsToAssign,
                playerWhoCalledCheck: playerWhoCalledCheckToAssign,
                finalTurnsTaken: finalTurnsTakenToAssign,
                discardPileIsSealed: discardPileIsSealedToAssign
              });

              for (const logData of logEventsToEmit) {
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC',
                  gameId: context.gameId,
                  publicLogData: logData
                });
              }

              if (nextPhaseToAssign !== 'matchingStage') {
                enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
              }
            })
        },
        [PlayerActionType.PASS_ON_MATCH_ATTEMPT]: {
          actions: enqueueActions(
            ({ context, event, enqueue }: {
                context: GameMachineContext;
              event: Extract<GameMachineEvent, { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }>;
                enqueue: any;
              }) => {
              const passEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.PASS_ON_MATCH_ATTEMPT }>;
              let activePlayersToAssign = { ...context.activePlayers };
              activePlayersToAssign[passEvent.playerId] = PlayerActivityStatus.MATCH_ACTION_CONCLUDED;
              let nextPhaseToAssign: GamePhase = 'matchingStage';

              const allMatchersConcluded = Object.values(activePlayersToAssign).every(status => status === PlayerActivityStatus.MATCH_ACTION_CONCLUDED);

              if (allMatchersConcluded) {
                nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;
              }

              enqueue.assign({
                  activePlayers: activePlayersToAssign,
                currentPhase: nextPhaseToAssign
              });

              if (nextPhaseToAssign !== 'matchingStage') {
                enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
              }
            }
          )
        },
        MATCHING_STAGE_TIMER_EXPIRED: {
          actions: enqueueActions(
            ({ context, event, enqueue }: {
              context: GameMachineContext;
              event: Extract<GameMachineEvent, { type: 'MATCHING_STAGE_TIMER_EXPIRED' }>;
              enqueue: any;
            }) => {
              const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'>> = [];
                logEventsToEmit.push({
                message: "Matching stage timer expired. Proceeding.",
                type: 'game_event'
              });

              let nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;

              enqueue.assign({
                currentPhase: nextPhaseToAssign,
                matchingOpportunityInfo: null,
                activePlayers: {}
              });

              for (const logData of logEventsToEmit) {
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC',
                  gameId: context.gameId,
                  publicLogData: logData
                });
              }
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
            }
          )
        }
      }
    },
    finalTurnsPhase: {
      initial: 'determiningPlayer',
      states: {
        determiningPlayer: {
          entry: assign(({ context }: { context: GameMachineContext }) => {
            let nextPlayerId = '';
            const lastPlayerIndex = context.turnOrder.indexOf(context.currentPlayerId);
            let nextPlayerIndex = (lastPlayerIndex + 1) % context.turnOrder.length;
            let newFinalTurnsTaken = context.finalTurnsTaken;

            if (context.turnOrder.length === 0 || !context.playerWhoCalledCheck) {
              return { currentPlayerId: '' };
            }

            if (context.currentPlayerId === '' && context.playerWhoCalledCheck) {
              nextPlayerIndex = context.turnOrder.indexOf(context.playerWhoCalledCheck);
              newFinalTurnsTaken = 0;
            } else if (context.currentPlayerId) {
              newFinalTurnsTaken++;
            }

            let attempts = 0;
            do {
              const potentialNextPlayerId = context.turnOrder[nextPlayerIndex];
              if (potentialNextPlayerId === context.playerWhoCalledCheck) {
                nextPlayerId = '';
                break;
              }
              const potentialPlayer = context.players[potentialNextPlayerId];
              if (potentialPlayer && !potentialPlayer.isLocked && !potentialPlayer.forfeited) {
                nextPlayerId = potentialNextPlayerId;
                break;
              }
              nextPlayerIndex = (nextPlayerIndex + 1) % context.turnOrder.length;
              attempts++;
            } while (attempts < context.turnOrder.length);

            if (!nextPlayerId) {
              return {
                currentPlayerId: '',
                finalTurnsTaken: newFinalTurnsTaken,
              };
            }
            return {
              currentPlayerId: nextPlayerId,
              currentTurnSegment: 'initialAction' as TurnSegment,
              discardPileIsSealed: false,
              activePlayers: { [nextPlayerId]: PlayerActivityStatus.FINAL_TURN_ACTIVE },
              finalTurnsTaken: newFinalTurnsTaken,
            };
          }),
          always: [
            {
              target: 'playerTurn',
              guard: ({ context }: { context: GameMachineContext }) => context.currentPlayerId !== ''
            },
            {
              target: '#checkGame.scoringPhase'
            }
          ]
        },
        playerTurn: {
          invoke: {
            id: 'finalTurnTimer',
            src: 'turnTimerActor',
            input: ({ context }: { context: GameMachineContext }) => ({
              playerId: context.currentPlayerId,
              duration: TURN_DURATION_MS
            }),
            onDone: {
              target: '.handleTimeout'
            }
          },
          initial: 'awaitingInitialAction',
          states: {
            awaitingInitialAction: {
              entry: assign({ currentTurnSegment: 'initialAction' as TurnSegment }),
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: {
                  target: 'awaitingPostDrawAction',
                  guard: and([
                    { type: 'canPerformInitialDrawAction' },
                    { type: 'deckIsNotEmpty' }
                  ]),
                  actions: [
                    assign((
                      { context, event }: {
                        context: GameMachineContext;
                        event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK }>;
                      }) => {
                      const player = context.players[event.playerId];
                      const newDeck = [...context.deck];
                      const cardDrawn = newDeck.pop()!;
                      const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'deck' as const };
                      return {
                        players: { ...context.players, [event.playerId]: updatedPlayer },
                        deck: newDeck
                      };
                    }
                    ),
                    enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                      const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK }>;
                      const player = context.players[drawEvent.playerId];
                      const cardDrawn = player?.pendingDrawnCard;

                      if (player && cardDrawn) {
                        const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} drew a card from the deck (final turn).`,
                            type: 'player_action',
                            actorId: drawEvent.playerId
                          }
                        });
                        enqueue.emit({
                          type: 'EMIT_LOG_PRIVATE',
                          gameId: context.gameId,
                          recipientPlayerId: drawEvent.playerId,
                          privateLogData: {
                            message: `You drew ${cardDrawn.rank}${cardDrawn.suit} from the deck (final turn).`,
                            type: 'player_action',
                            actorId: drawEvent.playerId,
                            cardContext: `${cardDrawn.rank}${cardDrawn.suit}`
                          }
                        });
                      }
                    })
                  ]
                },
                [PlayerActionType.DRAW_FROM_DISCARD]: {
                  target: 'awaitingPostDrawAction',
                  guard: and([
                    { type: 'canPerformInitialDrawAction' },
                    { type: 'discardIsDrawable' }
                  ]),
                  actions: [
                    assign((
                      { context, event }: {
                        context: GameMachineContext;
                        event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD }>;
                      }) => {
                      const player = context.players[event.playerId];
                      const newDiscardPile = [...context.discardPile];
                      const cardDrawn = newDiscardPile.shift()!;
                      const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'discard' as const };
                      return {
                        players: { ...context.players, [event.playerId]: updatedPlayer },
                        discardPile: newDiscardPile
                      };
                    }
                    ),
                    enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                      const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD }>;
                      const player = context.players[drawEvent.playerId];
                      const cardDrawn = player?.pendingDrawnCard;

                      if (player && cardDrawn) {
                        const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} drew ${cardDrawn.rank}${cardDrawn.suit} from the discard pile (final turn).`,
                            type: 'player_action',
                            actorId: drawEvent.playerId,
                            cardContext: `${cardDrawn.rank}${cardDrawn.suit}`
                          }
                        });
                      }
                    })
                  ]
                }
              }
            },
            awaitingPostDrawAction: {
              entry: assign({ currentTurnSegment: 'postDrawAction' as TurnSegment }),
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: {
                  target: '#checkGame.matchingStage',
                  guard: { type: 'isValidSwapAndDiscard' },
                  actions: [
                    assign(({ context, event }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }> }) => {
                      const player = context.players[event.playerId];
                      const newHand = [...player!.hand];
                      const cardToPlaceInHand: Card = { ...player!.pendingDrawnCard!, isFaceDownToOwner: true };
                      const cardFromHand = newHand.splice(event.handIndex, 1, cardToPlaceInHand)[0];
                      const updatedPlayer = { ...player!, hand: newHand, pendingDrawnCard: null, pendingDrawnCardSource: null };
                      const newDiscardPile = [cardFromHand, ...context.discardPile];

                      const potentialMatchers = Object.keys(context.players).filter((pId: string) => {
                        const p = context.players[pId];
                        return p && !p.isLocked && !p.hasCalledCheck && pId !== context.playerWhoCalledCheck;
                      });
                      const newMatchingOpportunityInfo = { cardToMatch: cardFromHand, originalPlayerID: event.playerId, potentialMatchers };
                      const newActivePlayers = potentialMatchers.reduce((acc, pId) => {
                        acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                        return acc;
                      }, {} as { [playerID: string]: PlayerActivityStatus });

                      return {
                        players: { ...context.players, [event.playerId]: updatedPlayer },
                        discardPile: newDiscardPile,
                        discardPileIsSealed: false,
                        matchingOpportunityInfo: newMatchingOpportunityInfo,
                        activePlayers: newActivePlayers,
                        currentPhase: 'matchingStage' as GamePhase,
                        currentTurnSegment: null,
                        lastRegularSwapInfo: { playerId: event.playerId, handIndex: event.handIndex, timestamp: Date.now() }
                      };
                    }),
                    enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                      const swapEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                      const playerName = getPlayerNameForLog(swapEvent.playerId, context);
                      const discardedCard = context.discardPile[0];
                      const keptCard = context.players[swapEvent.playerId].hand[swapEvent.handIndex];

                      if (discardedCard && keptCard) {
                        const discardedCardStr = `${discardedCard.rank}${discardedCard.suit}`;
                        const keptCardStr = `${keptCard.rank}${keptCard.suit}`;
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} discarded ${discardedCardStr} and kept drawn card ${keptCardStr} (final turn).`,
                            type: 'player_action',
                            actorId: swapEvent.playerId,
                            cardContext: `Discarded ${discardedCardStr}, Kept ${keptCardStr}`
                          }
                        });
                        enqueue.emit({
                          type: 'EMIT_LOG_PRIVATE',
                          gameId: context.gameId,
                          recipientPlayerId: swapEvent.playerId,
                          privateLogData: {
                            message: `You discarded ${discardedCardStr} and kept ${keptCardStr} (final turn).`,
                            type: 'player_action',
                            actorId: swapEvent.playerId,
                            cardContext: `Discarded ${discardedCardStr}, Kept ${keptCardStr}`
                          }
                        });
                      }
                    })
                  ]
                },
                [PlayerActionType.DISCARD_DRAWN_CARD]: {
                  target: '#checkGame.matchingStage',
                  guard: { type: 'isValidDiscardDrawnCard' },
                  actions: [
                    assign((
                      { context, event }: {
                        context: GameMachineContext;
                        event: Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                      }) => {
                      const player = context.players[event.playerId];
                      const drawnCardToDiscard = player.pendingDrawnCard!;
                      const updatedPlayer = { ...player, pendingDrawnCard: null, pendingDrawnCardSource: null };
                      const newDiscardPile = [drawnCardToDiscard, ...context.discardPile];

                      const potentialMatchers = Object.keys(context.players).filter(pId => {
                        const p = context.players[pId];
                        return p && !p.isLocked && !p.hasCalledCheck && pId !== context.playerWhoCalledCheck;
                      });
                      const newMatchingOpportunityInfo = { cardToMatch: drawnCardToDiscard, originalPlayerID: event.playerId, potentialMatchers };
                      const newActivePlayers = potentialMatchers.reduce((acc, pId) => {
                        acc[pId] = PlayerActivityStatus.AWAITING_MATCH_ACTION;
                        return acc;
                      }, {} as { [playerID: string]: PlayerActivityStatus });

                      return {
                        players: { ...context.players, [event.playerId]: updatedPlayer },
                        discardPile: newDiscardPile,
                        discardPileIsSealed: false,
                        matchingOpportunityInfo: newMatchingOpportunityInfo,
                        activePlayers: newActivePlayers,
                        currentPhase: 'matchingStage' as GamePhase,
                        currentTurnSegment: null
                      };
                    }),
                    enqueueActions(({ context, event, enqueue }: { context: GameMachineContext, event: GameMachineEvent, enqueue: any }) => {
                      const discardEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                      const playerName = getPlayerNameForLog(discardEvent.playerId, context);
                      const discardedCardFromContext = context.discardPile[0];

                      if (discardedCardFromContext) {
                        const discardedCardStr = `${discardedCardFromContext.rank}${discardedCardFromContext.suit}`;
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} discarded drawn card ${discardedCardStr} (final turn).`,
                            type: 'player_action',
                            actorId: discardEvent.playerId,
                            cardContext: discardedCardStr
                          }
                        });
                      }
                    })
                  ]
                }
              }
            },
            handleTimeout: {
              always: { target: '#checkGame.scoringPhase' }
            }
          }
        }
      }
    },
    abilityResolutionPhase: {
      initial: 'deciding',
      states: {
        deciding: {
          always: [
            {
              target: 'playerTurn',
              guard: ({ context }: { context: GameMachineContext }) => context.pendingAbilities.length > 0,
            },
            {
              target: '#checkGame.playPhase'
            }
          ]
        },
        playerTurn: {
          invoke: {
            id: 'abilityTurnTimer',
            src: 'turnTimerActor',
            input: ({ context }: { context: GameMachineContext }) => ({
                playerId: context.pendingAbilities[0].playerId,
                duration: TURN_DURATION_MS
            }),
            onDone: {
              target: '#checkGame.abilityResolutionPhase.handleTimeout'
            }
          },
          on: {
            [PlayerActionType.RESOLVE_SPECIAL_ABILITY]: '#checkGame.abilityResolutionPhase.deciding'
          }
        },
        handleTimeout: {
          always: '#checkGame.abilityResolutionPhase.deciding'
        }
      }
    },
    scoringPhase: {
        entry: [
          assign(( { context }: { context: GameMachineContext } ) => {
            const players = { ...context.players };
            let winnerId: string | null = null;
            let minScore = Infinity;

            if (context.playerWhoCalledCheck) {
                const checker = players[context.playerWhoCalledCheck];
                const checkerHandValue = checker.hand.reduce((acc, card) => acc + cardValues[card.rank], 0);

                let isTie = false;
                let lowestScoreAmongOthers = Infinity;
                let lowestScorePlayerId: string | null = null;


                Object.entries(players).forEach(([id, p]) => {
                    if (id !== context.playerWhoCalledCheck) {
                        const handValue = p.hand.reduce((acc, card) => acc + cardValues[card.rank], 0);
                        if (handValue < lowestScoreAmongOthers) {
                            lowestScoreAmongOthers = handValue;
                            lowestScorePlayerId = id;
                        }
                    }
                });

                if (checkerHandValue <= lowestScoreAmongOthers) {
                    winnerId = context.playerWhoCalledCheck;
                    minScore = checkerHandValue;
                    Object.entries(players).forEach(([id, p]) => {
                        if (id !== context.playerWhoCalledCheck) {
                            p.score += p.hand.reduce((acc, card) => acc + cardValues[card.rank], 0);
                        }
                    });
                } else {
                    winnerId = lowestScorePlayerId;
                    minScore = lowestScoreAmongOthers;
                    checker.score += 10;
                }

                Object.entries(players).forEach(([id, p]) => {
                    if (id !== winnerId && p.hand.reduce((acc, card) => acc + cardValues[card.rank], 0) === minScore) {
                        isTie = true;
                    }
                });

                if (isTie) winnerId = null;

            } else { // Game ended for other reasons (e.g., stalemate)
                const playerScores = Object.entries(players).map(([id, p]) => ({
                  id,
                  handValue: p.hand.reduce((acc, card) => acc + cardValues[card.rank], 0)
                }));

                if (playerScores.length > 0) {
                  minScore = playerScores.reduce((min, p) => p.handValue < min ? p.handValue : min, playerScores[0].handValue);
                  const winners = playerScores.filter(p => p.handValue === minScore);
                  if (winners.length === 1) {
                    winnerId = winners[0].id;
                  }
                }
            }

            const gameOverData: GameOverData = {
              winnerId: winnerId,
              players: Object.entries(players).map(([id, p]) => ({
                id: id,
                score: p.score,
                hand: p.hand,
              })),
            };

            return {
              roundWinner: winnerId,
              gameover: gameOverData,
              currentPhase: 'scoringPhase' as GamePhase,
            };
          }),
          enqueueActions(({ context, enqueue }: { context: GameMachineContext, enqueue: any }) => {
            const { roundWinner, gameover } = context;
            if (roundWinner) {
              const winnerName = getPlayerNameForLog(roundWinner, context);
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `${winnerName} wins the round!`,
                  type: 'game_event',
                }
              });
            } else {
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `The round is a draw!`,
                  type: 'game_event',
                }
              });
            }
            if (gameover) {
              enqueue.emit({ type: 'EMIT_GAME_OVER', gameId: context.gameId, gameOverData: gameover });
            }
          })
        ],
        on: {
            [PlayerActionType.RESET_GAME]: {
                target: 'awaitingPlayers',
                actions: assign(({ context }: { context: GameMachineContext }) => {
                    const newDeck = shuffleDeck(createDeckWithIds());
                    const newPlayers = { ...context.players };
                    Object.keys(newPlayers).forEach(pId => {
                        const newHand = newDeck.splice(0, 4).map((card: Card) => ({ ...card, isFaceDownToOwner: true }));
                        newPlayers[pId] = {
                            ...newPlayers[pId],
                            hand: newHand,
                            isReadyForInitialPeek: false,
                            hasUsedInitialPeek: false,
                            hasCompletedInitialPeek: false,
                            hasAcknowledgedPeek: false,
                            cardsToPeek: null,
                            peekAcknowledgeDeadline: null,
                            pendingDrawnCard: null,
                            pendingDrawnCardSource: null,
                            pendingSpecialAbility: null,
                            hasCalledCheck: false,
                            isLocked: false,
                        };
                    });

                    return {
                        ...context,
                        deck: newDeck,
                        players: newPlayers,
                        discardPile: [],
                        discardPileIsSealed: false,
                        matchingOpportunityInfo: null,
                        playerWhoCalledCheck: null,
                        roundWinner: null,
                        finalTurnsTaken: 0,
                        lastResolvedAbilitySource: null,
                        initialPeekAllReadyTimestamp: null,
                        lastPlayerToResolveAbility: null,
                        lastResolvedAbilityCardForCleanup: null,
                        matchResolvedDetails: null,
                        pendingAbilities: [],
                        gameover: null,
                        globalAbilityTargets: null,
                        currentPhase: 'awaitingPlayers' as GamePhase,
                        currentPlayerId: '',
                    };
                }),
            },
        },
    },
    gameOver: {
        type: 'final'
    },
    error: {
        type: 'final'
    }
  }
}
);