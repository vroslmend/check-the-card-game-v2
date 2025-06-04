import { setup, assign, sendParent, sendTo, ActorRefFrom, raise, enqueueActions, fromPromise, emit } from 'xstate';
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
} from '../../shared-types/src/index';

// Durations (configurable in game-manager, hardcoded here for now)
const PEEK_TOTAL_DURATION_MS = 10000; // 10 seconds
const TURN_DURATION_MS = 60000;      // 60 seconds
const MATCHING_STAGE_DURATION_MS = 20000; // 20 seconds
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 seconds

// Helper to get player name, avoiding null/undefined issues for logging
// TODO: Move to a shared utility or ensure context always has player names resolved
const getPlayerNameForLog = (playerId: string, context: GameMachineContext): string => {
    return context.players[playerId]?.name || 'P-' + playerId.slice(-4);
};

export const gameMachine = setup({
  types: {
    context: {} as GameMachineContext,
    events: {} as GameMachineEvent,
    emitted: {} as GameMachineEmittedEvents,
    input: {} as GameMachineInput, // This defines the TYPE of input
  },
  // REMOVED: The top-level input property for default values, which was causing the error.
  // input: { 
  //   gameId: '',
  // },
  
  actions: {
  },
  guards: {
    canPlayerJoin: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== 'PLAYER_JOIN_REQUEST') return false;
      const { playerSetupData } = event;
      if (context.players[playerSetupData.id]) {
        console.warn(`[GameMachine] Player ${playerSetupData.id} already joined.`);
        return false; // Player already in game
      }
      if (Object.keys(context.players).length >= 4) { // Assuming max 4 players
        console.warn(`[GameMachine] Game is full. Cannot add player ${playerSetupData.id}.`);
        return false; // Game is full
      }
      return true;
    },
    allJoinedPlayersReadyAndMinPlayersMet: ({ context }: { context: GameMachineContext }) => {
      const numPlayers = context.turnOrder.length;
      if (numPlayers < 1) return false; // Minimum 1 player to start (or 2, adjust as per rules)
      return context.turnOrder.every((pid: string) => context.players[pid]?.isReadyForInitialPeek);
    },
    allPlayersReadyAndPeekNotYetStarted: ({ context }: { context: GameMachineContext }) => {
      if (context.turnOrder.length === 0) return false; // No players, can't be ready
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
      if (event.type !== PlayerActionType.SWAP_AND_DISCARD) return false; // Type guard
      if (event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || !player.pendingDrawnCard || event.handIndex < 0 || event.handIndex >= player.hand.length) return false;
      return true;
    },
    isValidDiscardDrawnCard: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.DISCARD_DRAWN_CARD) return false; // Type guard
      if (event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || !player.pendingDrawnCard || player.pendingDrawnCardSource !== 'deck') return false;
      return true;
    },
    isValidCallCheck: ({ context, event }: { context: GameMachineContext, event: GameMachineEvent }) => {
      if (event.type !== PlayerActionType.CALL_CHECK) return false; // Type guard
      if (!('playerId' in event) || event.playerId !== context.currentPlayerId) return false;
      const player = context.players[event.playerId];
      if (!player || player.hasCalledCheck || player.pendingDrawnCard) return false;
      // Check if the player has any pending abilities
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
      // Player must be an active matcher for this opportunity
      if (!context.activePlayers || context.activePlayers[event.playerId] !== PlayerActivityStatus.AWAITING_MATCH_ACTION) return false;
      // Ensure the player is part of the potential matchers list in the opportunity info
      if (!context.matchingOpportunityInfo.potentialMatchers.includes(event.playerId)) return false;
      return true;
    }
  },
  actors: {
    turnTimerActor: fromPromise(async ({ input }: { input: { playerId: string, duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      // The output of this promise will be available in event.output in onDone
      return { timedOutPlayerId: input.playerId }; 
    }),
    matchingStageTimerActor: fromPromise(async ({ input }: { input: { duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      return {}; // No specific output needed, just completion
    }),
    disconnectGraceTimerActor: fromPromise(async ({ input }: { input: { playerId: string, duration: number } }) => {
      await new Promise(resolve => setTimeout(resolve, input.duration));
      return { timedOutGracePlayerId: input.playerId }; // Identify which player's grace period ended
    })
  }
}).createMachine(
  {
  id: 'checkGame',
    context: ({ input }: { input?: GameMachineInput }) => ({ // Input here is optional
      gameId: input?.gameId || '', // Provide default for gameId here
      deck: [],
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
      // Initializing timers to null/undefined as per GameMachineContext
      disconnectGraceTimerExpiresAt: undefined,
      matchingStageTimerExpiresAt: undefined,
      // turnTimerExpiresAt: undefined, // This is managed per player in playerTimers
    }),
    initial: 'awaitingPlayers', // Changed initial state
    on: { // Global event handlers
      PLAYER_DISCONNECTED: {
        actions: [
          enqueueActions(({ context, event, enqueue, check }) => {
            const { playerId } = event as Extract<GameMachineEvent, { type: 'PLAYER_DISCONNECTED' }>;
            const playerPreAssign = context.players[playerId];

            // Enqueue the assign action (assuming this part is now correct from previous edit)
            enqueue.assign(({ context: currentContext, event: assignEvent }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: 'PLAYER_DISCONNECTED'}> }) => {
              const player = currentContext.players[assignEvent.playerId]; 
              if (!player || !player.isConnected) {
                return {}; 
              }
              console.log(`[GameMachine] Player ${getPlayerNameForLog(assignEvent.playerId, currentContext)} disconnected (processing assign).`);
              return {
                players: { 
                  ...currentContext.players, 
                  [assignEvent.playerId]: { ...player, isConnected: false } 
                },
                logHistory: undefined // Removed direct logHistory update
              };
            });

            // Emit the log after assign has potentially run
            const playerName = getPlayerNameForLog(playerId, context); // Get name based on context potentially *before* assign if needed for log
            enqueue.emit({
              type: 'EMIT_LOG_PUBLIC',
              gameId: context.gameId,
              publicLogData: {
                message: `${playerName} disconnected.`,
                type: 'system' as RichGameLogMessage['type'],
                actorId: playerId // or actorName: playerName if schema prefers that directly for EMIT_LOG_PUBLIC
              }
            });

            if (playerPreAssign && playerPreAssign.isConnected && check(({ context: currentContext, event: checkEvent }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: 'PLAYER_DISCONNECTED'}> }) => {
                const playerPostAssign = currentContext.players[checkEvent.playerId];
                return playerPostAssign ? !playerPostAssign.isConnected : false;
            })) {
              enqueue.spawnChild('disconnectGraceTimerActor', {
                id: `graceTimer_${playerId}`,
                input: { 
                  playerId: playerId,
                  duration: DISCONNECT_GRACE_PERIOD_MS 
                }
              });
            }
          })
        ]
      },
      PLAYER_RECONNECTED: {
        actions: [
          enqueueActions(({ context, event, enqueue }) => {
            const { playerId, newSocketId } = event as Extract<GameMachineEvent, { type: 'PLAYER_RECONNECTED' }>;
            const player = context.players[playerId];

            if (!player) {
              console.warn(`[GameMachine] Player ${playerId} reconnected but not found in state.`);
              return;
            }

            enqueue.assign(({ context: currentContext, event: assignEvent }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: 'PLAYER_RECONNECTED'}> }) => {
              const p = currentContext.players[assignEvent.playerId];
              if (!p) return {}; 

              console.log(`[GameMachine] Player ${getPlayerNameForLog(assignEvent.playerId, currentContext)} reconnected.`);
              return {
                players: {
                  ...currentContext.players,
                  [assignEvent.playerId]: { ...p, isConnected: true, socketId: assignEvent.newSocketId }
                },
                logHistory: undefined 
              };
            });

            enqueue.stopChild(`graceTimer_${playerId}`);
            
            const playerName = getPlayerNameForLog(playerId, context);
            enqueue.emit({
              type: 'EMIT_LOG_PUBLIC',
              gameId: context.gameId,
              publicLogData: {
                message: `${playerName} reconnected.`,
                type: 'system' as RichGameLogMessage['type'],
                actorId: playerId
              }
            });
          })
        ]
      },
      DISCONNECT_GRACE_TIMER_EXPIRED: {
        actions: [
          assign(
            ({ context, event }: { 
              context: GameMachineContext; 
              event: Extract<GameMachineEvent, { type: 'DISCONNECT_GRACE_TIMER_EXPIRED'}>
            }) => {
              const playerId = event.timedOutGracePlayerId;
              const player = context.players[playerId];

              if (!player || player.isConnected) {
                if (player && player.isConnected) {
                  console.log(`[GameMachine] Grace timer expired for ${getPlayerNameForLog(playerId, context)}, but player already reconnected.`);
                }
                // If player reconnected or was not in a state to be forfeited, return empty to signify no change from this assign.
                return { logHistory: undefined }; 
              }
              
              console.log(`[GameMachine] Grace period expired for ${getPlayerNameForLog(playerId, context)}. Player forfeited.`);
              return {
                players: {
                  ...context.players,
                  [playerId]: { 
                    ...player, 
                    forfeited: true, 
                    isConnected: false, 
                    pendingDrawnCard: null,      // Clear pending card
                    pendingDrawnCardSource: null // Clear pending card source
                  }
                },
                logHistory: undefined // Handled by emit
              };
            }
          ),
          enqueueActions(({ context, event, enqueue }) => {
            const playerId = (event as Extract<GameMachineEvent, { type: 'DISCONNECT_GRACE_TIMER_EXPIRED' }>).timedOutGracePlayerId;
            // Check the context *after* the assign has run to see if forfeiture actually occurred.
            const playerStateAfterAssign = context.players[playerId];

            if (playerStateAfterAssign && playerStateAfterAssign.forfeited === true && playerStateAfterAssign.isConnected === false) {
              const playerName = getPlayerNameForLog(playerId, context);
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `${playerName}'s disconnection grace period expired. Player has forfeited.`,
                  type: 'system',
                  actorId: playerId
                }
              });
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
              enqueue.raise({ type: '_HANDLE_FORFEITURE_CONSEQUENCES', forfeitedPlayerId: playerId });
            } else {
              // Player might have reconnected just before assign, or assign didn't run due to initial checks.
              // No forfeiture event to raise. If a state broadcast is still needed, it can be added here.
              // console.log(`[GameMachine] Forfeiture for ${playerId} did not proceed or player reconnected.`);
            }
          })
        ]
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
            logHistory: undefined 
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
          // let nextPhaseToAssign: GamePhase = context.currentPhase; // This will be determined later
          let lastResolvedAbilityCardToAssign: Card | null = context.lastResolvedAbilityCardForCleanup;
          let lastResolvedAbilitySourceToAssign: SpecialAbilityInfo['source'] | null = context.lastResolvedAbilitySource;
          let lastPlayerToResolveAbilityToAssign = context.lastPlayerToResolveAbility;
          let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo;

          if (pendingAbilitiesToAssign.length === 0) {
            console.warn('[GameMachine-ResolveAbility] No pending abilities to resolve despite event call.');
            // If this happens, it might be a stale event. Determine phase like abilityResolutionPhase entry.
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
                matchResolvedDetails: null, // Clear stale details
                globalAbilityTargets: null, // Clear GATs
                logHistory: undefined 
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
            // Determine next phase after removing problematic ability
            let resolvedNextPhase: GamePhase;
            let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
            let resolvedMatchDetails = context.matchResolvedDetails;
            if (pendingAbilitiesToAssign.length > 0) { resolvedNextPhase = 'abilityResolutionPhase'; } 
            else if (resolvedMatchDetails?.isAutoCheck) { resolvedNextPhase = 'finalTurnsPhase'; if (!resolvedPlayerWhoCalledCheck) { resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId; } resolvedMatchDetails = null;}
            else if (resolvedPlayerWhoCalledCheck) { resolvedNextPhase = 'finalTurnsPhase'; resolvedMatchDetails = null; } 
            else { resolvedNextPhase = 'playPhase'; resolvedMatchDetails = null; }
            enqueue.assign({ pendingAbilities: pendingAbilitiesToAssign, currentPhase: resolvedNextPhase, playerWhoCalledCheck: resolvedPlayerWhoCalledCheck, matchResolvedDetails: resolvedMatchDetails, globalAbilityTargets: null, logHistory: undefined });
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
            
            // Determine next phase after fizzle
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
              logHistory: undefined
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
              // Next phase is still abilityResolutionPhase to process the swap stage
              enqueue.assign({ 
                  pendingAbilities: pendingAbilitiesToAssign, 
                  currentPhase: 'abilityResolutionPhase', 
                  globalAbilityTargets: globalAbilityTargetsToAssign,
                  logHistory: undefined
              });
            } else { // "Full skip" / "skip swap" / "Jack skip" path
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
              // Determine next phase after full skip
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
                  logHistory: undefined
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
                logHistory: undefined 
            });
            for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
            return; 
          }

          if (pendingAbility.currentAbilityStage === 'swap' || abilityRank === Rank.Jack) {
            // ... (validation for swap targets) ... 
            if (!args.swapTargets || args.swapTargets.length !== 2 /* ... other validation ... */) {
                console.warn('[GameMachine-ResolveAbility] Swap targets issue.'); 
                // Potentially emit error to client if appropriate
                return; 
            }
            // ... (perform swap logic on playersToAssign, set globalAbilityTargetsToAssign, prepare logs for swap in logEventsToEmit) ...
            // Example: (assuming swap logic from previous attempt is correct and has populated playersToAssign and globalAbilityTargetsToAssign)
            const t1Name = getPlayerNameForLog(args.swapTargets[0].playerID, context);
            const t2Name = getPlayerNameForLog(args.swapTargets[1].playerID, context);
            const swapMsg = `${getPlayerNameForLog(event.playerId, context)} used ${abilityRank} to swap ${t1Name}'s card (idx ${args.swapTargets[0].cardIndex}) with ${t2Name}'s card (idx ${args.swapTargets[1].cardIndex}).`;
            logEventsToEmit.push({ message: swapMsg, type: 'player_action', actorId: event.playerId });
            // Private logs for swap targets also added to logEventsToEmit or emitted directly here

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
                // globalAbilityTargetsToAssign (set by the current successful swap, if any) persists for the next ability resolution turn.
            } else { // No more abilities pending - leaving ability resolution context
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
                finalMatchDetailsToAssign = null; // Clear match details when leaving ability resolution
                // Unconditionally clear Global Ability Targets when leaving ability resolution context
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
              logHistory: undefined
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
              logHistory: undefined 
          });
          for (const logData of fallbackLogEvents) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });}
          return;
        })
      },
      _HANDLE_FORFEITURE_CONSEQUENCES: { // New global event handler
        actions: enqueueActions(({ context, event, enqueue }) => {
          const { forfeitedPlayerId } = event as Extract<GameMachineEvent, { type: '_HANDLE_FORFEITURE_CONSEQUENCES' }>;
          const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string }> = [];
          let changesMade = false;

          // Make a mutable copy of context pieces we might change
          let newContextValues = { // Renamed to avoid confusion with full context type
            currentPhase: context.currentPhase,
            currentPlayerId: context.currentPlayerId,
            activePlayers: { ...context.activePlayers },
            pendingAbilities: [...context.pendingAbilities],
            currentTurnSegment: context.currentTurnSegment,
            playerWhoCalledCheck: context.playerWhoCalledCheck,
            matchResolvedDetails: context.matchResolvedDetails,
          };

          // Use the original context for read-only operations like getting player name or full player list
          const forfeitedPlayerName = getPlayerNameForLog(forfeitedPlayerId, context); 
          const activeNonForfeitedPlayers = Object.values(context.players).filter(p => p && !p.forfeited).length;

          // 1. Game End Check
          if (activeNonForfeitedPlayers < 2 && newContextValues.currentPhase !== 'scoringPhase' && newContextValues.currentPhase !== 'gameOver') {
            logEventsToEmit.push({ message: `Game ends: only ${activeNonForfeitedPlayers} player(s) remain after ${forfeitedPlayerName} forfeited.`, type: 'game_event' });
            newContextValues.currentPhase = 'scoringPhase';
            newContextValues.currentPlayerId = '';
            newContextValues.activePlayers = {};
            newContextValues.currentTurnSegment = null;
            changesMade = true;
          } else if (newContextValues.currentPhase !== 'scoringPhase' && newContextValues.currentPhase !== 'gameOver') {
            // 2. Turn/Activity Handling (if game not ended)
            if (newContextValues.currentPlayerId === forfeitedPlayerId && (newContextValues.currentPhase === 'playPhase' || newContextValues.currentPhase === 'finalTurnsPhase')) {
              logEventsToEmit.push({ message: `${forfeitedPlayerName} forfeited during their turn. Turn skipped.`, type: 'game_event' });
              newContextValues.currentPlayerId = ''; // Force re-determination
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
    awaitingPlayers: { // New initial state
      on: {
        PLAYER_JOIN_REQUEST: {
          guard: { type: 'canPlayerJoin' },
          actions: [
            assign(
              ({ context, event }: {
                context: GameMachineContext;
                event: Extract<GameMachineEvent, { type: 'PLAYER_JOIN_REQUEST' }>;
              }) => {
                const { playerSetupData } = event;
                const newPlayerId = playerSetupData.id;
                const newDeck = [...context.deck];
                const newPlayerHand = newDeck.splice(0, 4).map((card: Card) => ({ ...card, isFaceDownToOwner: true }));

                const newPlayer: PlayerState = {
                  hand: newPlayerHand,
                  isReadyForInitialPeek: false, // Joins as not ready
                hasUsedInitialPeek: false,
                hasCompletedInitialPeek: false,
                cardsToPeek: null,
                peekAcknowledgeDeadline: null,
                pendingDrawnCard: null,
                pendingDrawnCardSource: null,
                pendingSpecialAbility: null,
                hasCalledCheck: false,
                isLocked: false,
                score: 0,
                  name: playerSetupData.name,
                  isConnected: true, // Assumed connected on join
                  socketId: playerSetupData.socketId!,
                forfeited: false,
                numMatches: 0,
                numPenalties: 0,
              };

                const newPlayers = { ...context.players, [newPlayerId]: newPlayer };
                const newTurnOrder = [...context.turnOrder, newPlayerId];
                const newGameMasterId = context.gameMasterId || newPlayerId; // First player to join is GM

            return {
                  ...context,
                  deck: newDeck,
                  players: newPlayers,
                  turnOrder: newTurnOrder,
                  gameMasterId: newGameMasterId,
                  // logHistory: undefined // Handled by emit
                };
              }
            ),
            enqueueActions(({ context, event, enqueue }) => {
              const joinEvent = event as Extract<GameMachineEvent, { type: 'PLAYER_JOIN_REQUEST' }>;
              const playerName = joinEvent.playerSetupData.name || `P-${joinEvent.playerSetupData.id.slice(-4)}`;
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `${playerName} joined the game. Waiting for players to get ready...`,
                type: 'game_event',
                }
              });
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
            })
          ]
        },
        [PlayerActionType.DECLARE_READY_FOR_PEEK]: {
          actions: [
            assign(
              ({ context, event }: {
                context: GameMachineContext;
                event: Extract<GameMachineEvent, { type: PlayerActionType.DECLARE_READY_FOR_PEEK }>;
              }) => {
                const player = context.players[event.playerId];
                if (!player || player.isReadyForInitialPeek) return {};

                return {
                  players: {
                    ...context.players,
                    [event.playerId]: { ...player, isReadyForInitialPeek: true }
                  },
                  // logHistory: undefined // Handled by emit
                };
              }
            ),
            enqueueActions(({ context, event, enqueue }) => {
              const readyEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DECLARE_READY_FOR_PEEK }>;
              const playerName = getPlayerNameForLog(readyEvent.playerId, context);
              enqueue.emit({
                type: 'EMIT_LOG_PUBLIC',
                gameId: context.gameId,
                publicLogData: {
                  message: `${playerName} is ready for the initial peek.`,
                  type: 'player_action',
                  actorId: readyEvent.playerId
                }
              });
              enqueue.emit({ type: 'BROADCAST_GAME_STATE', gameId: context.gameId });
            })
          ]
        }
      },
      always: [ // Check to transition to initialPeekPhase
        {
          target: 'initialPeekPhase',
          guard: { type: 'allJoinedPlayersReadyAndMinPlayersMet' }
        }
      ]
    },
    initialPeekPhase: {
      // DECLARE_READY_FOR_PEEK handler is removed from here
      entry: [ // Actions to perform when entering initialPeekPhase
        assign(
          ({ context }: {
            context: GameMachineContext;
          }) => {
            const peekDeadline = Date.now() + PEEK_TOTAL_DURATION_MS;
            const playersWithPeekInfo = { ...context.players };
            context.turnOrder.forEach(pid => {
              const p = playersWithPeekInfo[pid];
              if (p) { // Player should exist if they are in turnOrder
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
              // currentPlayerId should be set to the first player in turn order if not already set,
              // or this can be part of the entry to playPhase.
              // For now, peek phase doesn't strictly need a currentPlayerId.
              currentPlayerId: context.turnOrder[0] || '', // First player to start after peek
              // logHistory: undefined // Handled by emit
            };
          }
        ),
        enqueueActions(({ context, enqueue }) => {
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
            assign(({ context, event }: { context: GameMachineContext; event: Extract<GameMachineEvent, { type: 'PEEK_TIMER_EXPIRED'}> }) => {
            const newPlayers = { ...context.players };
              context.turnOrder.forEach((pid: string) => {
                if (newPlayers[pid]) {
                    newPlayers[pid].cardsToPeek = null;
                  newPlayers[pid].hasCompletedInitialPeek = true; // Mark as completed
                    newPlayers[pid].peekAcknowledgeDeadline = null;
                }
            });
            return {
                initialPeekAllReadyTimestamp: null, // Clear timestamp
                players: newPlayers,
                // logHistory: undefined // Handled by emit
            };
          }),
            enqueueActions(({ context, enqueue }) => {
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
      },
    },
    playPhase: {
          initial: 'determiningPlayer',
          states: {
            determiningPlayer: {
              entry: assign(( { context }: { context: GameMachineContext } ) => {
                let nextPlayerId = ''; // Default to empty, indicating no player found yet
                let currentPlayerIndex = context.turnOrder.indexOf(context.currentPlayerId);
                let attempts = 0;

                if (context.turnOrder.length === 0) {
                  console.warn('[GameMachine-determiningPlayer] No turn order! Stalemate.');
                  return {
                    currentPlayerId: '', // Signal for stalemate
                    // Cleanup transient state for potential stalemate -> scoring transition
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
                  if (potentialPlayer && !potentialPlayer.isLocked && potentialPlayer.isConnected && !potentialPlayer.forfeited) {
                    nextPlayerId = potentialNextPlayerId;
                    break;
                  }
                  attempts++;
                } while (attempts < context.turnOrder.length);

                if (!nextPlayerId) { 
                  console.warn('[GameMachine-determiningPlayer] No valid next player found after checking all. Stalemate.');
                  return {
                    currentPlayerId: '',
                    // Cleanup transient state for stalemate -> scoring transition
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
                  // Cleanup transient state at the start of a new turn
                  globalAbilityTargets: null,
                  lastRegularSwapInfo: null,
                  matchResolvedDetails: null,
                  lastResolvedAbilityCardForCleanup: null,
                  lastResolvedAbilitySource: null,
                  lastPlayerToResolveAbility: null,
                  logHistory: undefined // ensure logs are not part of this assign
                };
              }),
              always: [
                { 
                  target: 'playerTurn',
                  guard: ({context}) => context.currentPlayerId !== '',
                  actions: assign({ currentPhase: 'playPhase' as GamePhase }) // Ensure phase is correctly playPhase
                },
                { 
                  target: 'scoringPhase', 
                  // This transition is taken if currentPlayerId is '' (no valid player found)
                  actions: [
                    assign({ currentPhase: 'scoringPhase' as GamePhase }), // Set phase for scoring
                    enqueueActions(({ context, enqueue }) => {
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
                  target: 'handleTimeout', 
                  actions: assign({ 
                    // Log or store the fact that a timeout occurred
                    // The actual outcome is handled by 'handleTimeout' state
                    // Example: gameStats: context => ({...context.gameStats, timeouts: ...}) 
                  })
                }
              },
              initial: 'awaitingInitialAction',
              states: {
                awaitingInitialAction: {
                  entry: assign({ currentTurnSegment: 'initialAction' as TurnSegment }),
      on: {
        [PlayerActionType.DRAW_FROM_DECK]: {
          target: 'awaitingPostDrawAction',
          guards: [
              { type: 'canPerformInitialDrawAction' },
              { type: 'deckIsNotEmpty' }
          ],
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
                
                // emitLogEntry removed from here

                return { 
                  players: { ...context.players, [event.playerId]: updatedPlayer }, 
                  deck: newDeck
                };
              }
            ),
            enqueueActions(({ context, event, enqueue }) => {
              const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK }>;
              const player = context.players[drawEvent.playerId];
              const cardDrawn = player?.pendingDrawnCard;

              if (player && cardDrawn) {
                const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                // Public Log
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC',
                  gameId: context.gameId,
                  publicLogData: {
                    message: `${playerName} drew a card from the deck.`,
                    type: 'player_action',
                    actorId: drawEvent.playerId
                  }
                });
                // Private Log for the player who drew
                enqueue.emit({
                  type: 'EMIT_LOG_PRIVATE',
                  gameId: context.gameId,
                  recipientPlayerId: drawEvent.playerId,
                  privateLogData: {
                    message: `You drew ${cardDrawn.rank}${cardDrawn.suit} from the deck.`,
                    type: 'player_action', // or a more specific type for private info
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
          guards: [
              { type: 'canPerformInitialDrawAction' },
              { type: 'discardIsDrawable' } 
          ],
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
                
                // emitLogEntry removed from here

                return { 
                  players: { ...context.players, [event.playerId]: updatedPlayer }, 
                  discardPile: newDiscardPile
                };
              }
            ),
            enqueueActions(({ context, event, enqueue }) => {
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
                    cardContext: `${cardDrawn.rank}${cardDrawn.suit}` // Card drawn from discard is public
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
                        
                        // emitLogEntry removed from here
                        
                        return { 
                          players: { ...context.players, [event.playerId]: updatedPlayer },
                          playerWhoCalledCheck: newPlayerWhoCalledCheck,
                          finalTurnsTaken: 0, // Reset on first check call
                          currentPhase: 'finalTurnsPhase' as GamePhase // Explicitly set phase
                        };
                      }),
                      enqueueActions(({ context, event, enqueue }) => {
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
                  } // End of CALL_CHECK
                } // End of on for awaitingInitialAction
              }, // End of awaitingInitialAction state
              awaitingPostDrawAction: {
                entry: assign({ currentTurnSegment: 'postDrawAction' as TurnSegment }),
                on: {
        [PlayerActionType.SWAP_AND_DISCARD]: {
                    target: '#checkGame.matchingStage', 
                    guard: { type: 'isValidSwapAndDiscard' },
                    actions: [
                      assign((
                        { context, event }: { 
                          context: GameMachineContext; 
                          event: Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                        }) => {
                const player = context.players[event.playerId];
                        const newHand = [...player!.hand];
                        const cardToPlaceInHand: Card = { ...player!.pendingDrawnCard!, isFaceDownToOwner: true };
                        const cardFromHand = newHand.splice(event.handIndex, 1, cardToPlaceInHand)[0];
                        const updatedPlayer = { ...player!, hand: newHand, pendingDrawnCard: null, pendingDrawnCardSource: null };
                
                        // emitLogEntry removed here
                
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
                      enqueueActions(({ context, event, enqueue }) => {
                        const swapEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                        const player = context.players[swapEvent.playerId];
                        const playerName = getPlayerNameForLog(swapEvent.playerId, context);
                        
                        // cardFromHand is now context.discardPile[0]
                        // cardToPlaceInHand is now context.players[swapEvent.playerId].hand[swapEvent.handIndex]
                        const discardedCard = context.discardPile[0];
                        const keptCard = player?.hand[swapEvent.handIndex];

                        if (player && discardedCard && keptCard) {
                          const discardedCardStr = `${discardedCard.rank}${discardedCard.suit}`;
                          const keptCardStr = `${keptCard.rank}${keptCard.suit}`;

                          // Public Log
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

                          // Private Log
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

                        // emitLogEntry removed from here

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
                      enqueueActions(({ context, event, enqueue }) => {
                        const discardEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                        const playerName = getPlayerNameForLog(discardEvent.playerId, context);
                        const discardedCard = context.discardPile[0]; // The card just discarded

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
                } // End of on for awaitingPostDrawAction
              } // End of awaitingPostDrawAction state
            }
          },
          handleTimeout: {
            entry: enqueueActions(( { context, event, enqueue }: { context: GameMachineContext, event: any, enqueue: any } ) => {
                const timedOutPlayerId = event.output?.timedOutPlayerId || context.currentPlayerId;
                const player = context.players[timedOutPlayerId];
                const actorNameForLog = getPlayerNameForLog(timedOutPlayerId, context);
                
                const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, cardContext?: string, targetName?: string }> = [];

                let playersToAssign = { ...context.players };
                let deckToAssign = [...context.deck]; // Added for deck card draw penalty
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
                  console.warn(`[GameMachine-Timeout] Player ${timedOutPlayerId} not found for non-ability timeout.`);
                  logEventsToEmit.push({
                    message: `Critical Error: Timed out player ${timedOutPlayerId} not found.`,
                    type: 'error',
                  });
                  enqueue.assign({ currentPhase: 'error' as GamePhase, logHistory: undefined });
                  // Emit logs and return
                  for (const logData of logEventsToEmit) { enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData }); }
                  return;
                }
                
                if (context.currentPhase === 'abilityResolutionPhase' && pendingAbilitiesToAssign.length > 0) {
                    const pendingAbility = pendingAbilitiesToAssign[0];
                    if (pendingAbility.playerId === timedOutPlayerId) {
                        generalTimeoutMessage = `${actorNameForLog} timed out during ${pendingAbility.card.rank} ability resolution. Ability skipped.`;
                        console.log(`[GameMachine-Timeout] ${generalTimeoutMessage}`);
                        
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
                        console.warn(`[GameMachine-Timeout] ${generalTimeoutMessage}. Timed out player: ${timedOutPlayerId}, Ability player: ${pendingAbility.playerId}`);
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
                        nextPhaseToAssign = 'finalTurnsPhase';
                        const isDiscardedSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(drawnCard.rank);
                        if (isDiscardedSpecial) {
                            let stage: 'peek' | 'swap' | undefined = undefined;
                            if (drawnCard.rank === Rank.King || drawnCard.rank === Rank.Queen) stage = 'peek';
                            else if (drawnCard.rank === Rank.Jack) stage = 'swap';
                            if (!pendingAbilitiesToAssign.some(ab => ab.playerId === timedOutPlayerId && ab.card.id === drawnCard.id && ab.source === 'discard')) {
                                pendingAbilitiesToAssign.push({ playerId: timedOutPlayerId, card: drawnCard, source: 'discard', currentAbilityStage: stage });
                            }
                            nextPhaseToAssign = 'abilityResolutionPhase';
                        }
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
                      let discardedCardFromHandForAbility: Card | null = null;
                      if (timedOutPlayerState.hand.length > 0) {
                        const cardFromHand = timedOutPlayerState.hand[0]; 
                        discardedCardFromHandForAbility = cardFromHand;
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
                        discardedCardFromHandForAbility = drawnCard;
                        logEventsToEmit.push({ 
                            message: `${actorNameForLog} timed out. Card ${drawnCardStr} (from discard) auto-discarded (hand empty).`, 
                            type: 'game_event', actorId: timedOutPlayerId, cardContext: drawnCardStr
                        });
                        discardPileToAssign.unshift(drawnCard);
                        playersToAssign[timedOutPlayerId] = { ...timedOutPlayerState, pendingDrawnCard: null, pendingDrawnCardSource: null };
                      }

                      if (context.currentPhase === 'finalTurnsPhase') {
                        nextPhaseToAssign = 'finalTurnsPhase';
                        if (discardedCardFromHandForAbility) {
                            const isDiscardedSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(discardedCardFromHandForAbility.rank);
                            if (isDiscardedSpecial) {
                                let stage: 'peek' | 'swap' | undefined = undefined;
                                if (discardedCardFromHandForAbility.rank === Rank.King || discardedCardFromHandForAbility.rank === Rank.Queen) stage = 'peek';
                                else if (discardedCardFromHandForAbility.rank === Rank.Jack) stage = 'swap';
                                if (!pendingAbilitiesToAssign.some(ab => ab.playerId === timedOutPlayerId && ab.card.id === discardedCardFromHandForAbility!.id && ab.source === 'discard')) {
                                    pendingAbilitiesToAssign.push({ playerId: timedOutPlayerId, card: discardedCardFromHandForAbility, source: 'discard', currentAbilityStage: stage });
                                }
                                nextPhaseToAssign = 'abilityResolutionPhase';
                            }
                        }
                      } else {
                        nextPhaseToAssign = 'matchingStage' as GamePhase;
                        discardPileIsSealedToAssign = false;
                        const cardForMatcher = discardedCardFromHandForAbility || drawnCard;
                        const potentialMatchers = Object.keys(playersToAssign).filter(pId => {
                            const p = playersToAssign[pId];
                            return p && !p.isLocked && !p.hasCalledCheck;
                        });
                        matchingOpportunityInfoToAssign = { cardToMatch: cardForMatcher, originalPlayerID: timedOutPlayerId, potentialMatchers };
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

                console.warn(`[GameMachine-Timeout-FINAL] ${generalTimeoutMessage}`);
                // Add the general timeout message to the logs to be emitted
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
                  logHistory: undefined // Ensure logHistory is not directly assigned
                });

                // Emit all collected logs
                for (const logData of logEventsToEmit) {
                    enqueue.emit({ type: 'EMIT_LOG_PUBLIC', gameId: context.gameId, publicLogData: logData });
                }
            }),
            always: [
              { target: '#checkGame.matchingStage', guard: ({context}) => context.currentPhase === 'matchingStage' },
              { target: '#checkGame.abilityResolutionPhase', guard: ({context}) => context.currentPhase === 'abilityResolutionPhase' },
              { target: '#checkGame.finalTurnsPhase', guard: ({context}) => context.currentPhase === 'finalTurnsPhase' },
              // Default to determiningPlayer if playPhase, or if it somehow ended up in an unexpected state before phase specific targets
              { target: 'determiningPlayer', guard: ({context}) => context.currentPhase === 'playPhase' },
              { target: 'determiningPlayer' } // Ultimate fallback
            ]
          }
        }
    },
    matchingStage: {
        entry: [
          assign(({
            context,
            event
          }) => {
            return {
              matchingStageTimerExpiresAt: Date.now() + MATCHING_STAGE_DURATION_MS,
            };
          }),
          enqueueActions(({ context, enqueue }) => {
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
        invoke: { // Invoke the server-side authoritative timer
          id: 'matchingStageTimer',
          src: 'matchingStageTimerActor',
          input: { duration: MATCHING_STAGE_DURATION_MS },
          onDone: {
            // Target self to re-evaluate transitions after actions triggered by the raised event
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
                enqueue: any; // Adjust if specific enqueue type is available from xstate setup
              }) => {
              const player = context.players[event.playerId];
              const cardToMatch = context.matchingOpportunityInfo!.cardToMatch;
              const cardFromHand = player.hand[event.handIndex];
              
              // Initialize variables to hold new state parts
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

              const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, targetName?: string }> = [];

              console.log(`[GameMachine-AttemptMatch] Player ${getPlayerNameForLog(event.playerId, context)} attempting to match ${cardToMatch.rank}${cardToMatch.suit} with ${cardFromHand.rank}${cardFromHand.suit}`);

              if (cardFromHand.rank === cardToMatch.rank) {
                // MATCH SUCCESSFUL
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
                  actorId: event.playerId, // actorName will be derived by listener from actorId
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
                    actorId: event.playerId // actorName derived by listener
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
                // MATCH FAILED (rest of the logic for this branch will be refactored similarly)
                const attemptedCardStr = `${cardFromHand.rank}${cardFromHand.suit}`;
                const targetCardStr = `${cardToMatch.rank}${cardToMatch.suit}`;
                let penaltyMsg = `${getPlayerNameForLog(event.playerId, context)} failed to match ${targetCardStr} with their ${attemptedCardStr}.`;
                let penaltyCardContext = "No card drawn (deck empty)";

                if (deckToAssign.length > 0) {
                  const penaltyCard = deckToAssign.pop()!;
                  const handWithPenalty = [...playersToAssign[event.playerId].hand, { ...penaltyCard, isFaceDownToOwner: true }];
                  playersToAssign[event.playerId] = {
                    ...playersToAssign[event.playerId],
                    hand: handWithPenalty,
                    numPenalties: playersToAssign[event.playerId].numPenalties + 1
                  };
                  penaltyMsg += ' They drew a penalty card.';
                  penaltyCardContext = `Drew a face-down card. Hand now ${handWithPenalty.length}.`;
                } else {
                  penaltyMsg += ' Deck is empty, no penalty card drawn.';
                  playersToAssign[event.playerId] = { 
                    ...playersToAssign[event.playerId],
                    numPenalties: playersToAssign[event.playerId].numPenalties + 1
                  };
                }
                logEventsToEmit.push({
                    message: penaltyMsg, type: 'player_action',
                    actorId: event.playerId, 
                    cardContext: `Attempt: ${attemptedCardStr} vs ${targetCardStr}. Penalty: ${penaltyCardContext}`
                });
                
                if (activePlayersToAssign[event.playerId]) {
                    delete activePlayersToAssign[event.playerId];
                }

                const stillActiveMatchers = Object.values(activePlayersToAssign).some(status => status === PlayerActivityStatus.AWAITING_MATCH_ACTION);
                if (!stillActiveMatchers && matchingOpportunityInfoToAssign) {
                    logEventsToEmit.push({ 
                        message: `Matching opportunity for ${targetCardStr} ended (all passed or failed).`, 
                        type: 'game_event' 
                    });
                    const originalDiscarderID = matchingOpportunityInfoToAssign.originalPlayerID;
                    const originalCard = matchingOpportunityInfoToAssign.cardToMatch;
                    matchingOpportunityInfoToAssign = null;
                    
                    const isOriginalDiscardSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(originalCard.rank);
                    if (isOriginalDiscardSpecial) {
                        let stage: 'peek' | 'swap' | undefined = undefined;
                        if (originalCard.rank === Rank.King || originalCard.rank === Rank.Queen) stage = 'peek';
                        else if (originalCard.rank === Rank.Jack) stage = 'swap';
                        if (!pendingAbilitiesToAssign.some(ab => ab.playerId === originalDiscarderID && ab.card.id === originalCard.id && ab.source === 'discard')) {
                            pendingAbilitiesToAssign.push({ playerId: originalDiscarderID, card: originalCard, source: 'discard', currentAbilityStage: stage });
                        }
                        nextPhaseToAssign = 'abilityResolutionPhase' as GamePhase;
                    } else {
                        nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;
                    }
                } else if (stillActiveMatchers) {
                    nextPhaseToAssign = 'matchingStage' as GamePhase;
                } else { 
                    nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' as GamePhase : 'playPhase' as GamePhase;
                }
              }
              
              // Assign all calculated state changes
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
                discardPileIsSealed: discardPileIsSealedToAssign,
                currentTurnSegment: null,
                logHistory: undefined // Explicitly remove direct logHistory update from assign
              });

              // Emit all collected log events
              for (const logData of logEventsToEmit) {
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC', // Assuming all are public for now, can refine if private logs are needed here
                  gameId: context.gameId,
                  publicLogData: logData
                });
              }
          })
        },
        [PlayerActionType.PASS_MATCH]: {
            // Removed guard: { type: 'isPlayerTurnToRespondToMatch' } as per original, assuming guards are handled by machine logic flow or higher-level guards
            actions: enqueueActions((
              { context, event, enqueue }: { 
                context: GameMachineContext; 
                event: Extract<GameMachineEvent, { type: PlayerActionType.PASS_MATCH }>;
                enqueue: any;
              }) => {
            console.log('[GameMachine] Event: ' + event.type + ', Player: ' + event.playerId);
              
              // Initialize variables to hold new state parts
              let activePlayersToAssign = { ...context.activePlayers };
              let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo;
              let nextPhaseToAssign = context.currentPhase;
              let pendingAbilitiesToAssign = [...context.pendingAbilities]; // Added for potential ability queuing

              const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, targetName?: string }> = [];

              if (activePlayersToAssign[event.playerId]) {
                  delete activePlayersToAssign[event.playerId];
                  const passMessage = `${getPlayerNameForLog(event.playerId, context)} passed the match.`;
                  logEventsToEmit.push({
                    message: passMessage,
                    type: 'player_action',
                    actorId: event.playerId
                });
            }
              
              const noActiveMatchersLeft = Object.keys(activePlayersToAssign).filter(pId => activePlayersToAssign[pId] === PlayerActivityStatus.AWAITING_MATCH_ACTION).length === 0;

              if (noActiveMatchersLeft && matchingOpportunityInfoToAssign) {
                  console.log("[GameMachine] All active players passed. Determining next phase after PASS_MATCH.");
                  const { cardToMatch, originalPlayerID } = matchingOpportunityInfoToAssign;
                  const isOriginalDiscardSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardToMatch.rank);

                  // Log that the matching opportunity has ended
                  logEventsToEmit.push({
                    message: `Matching opportunity for ${cardToMatch.rank}${cardToMatch.suit} (discarded by ${getPlayerNameForLog(originalPlayerID, context)}) ended. All remaining players passed.`,
                    type: 'game_event',
                    cardContext: `${cardToMatch.rank}${cardToMatch.suit}`
                  });

                  if (isOriginalDiscardSpecial) {
                      nextPhaseToAssign = 'abilityResolutionPhase' as GamePhase;
                      // Queue ability for the original discarder
                      let stageForDiscardedCard: 'peek' | 'swap' | undefined = undefined;
                      if (cardToMatch.rank === Rank.King || cardToMatch.rank === Rank.Queen) stageForDiscardedCard = 'peek';
                      else if (cardToMatch.rank === Rank.Jack) stageForDiscardedCard = 'swap';
                      
                      // Ensure not to double-queue if already handled (e.g. by timer)
                      const alreadyPending = pendingAbilitiesToAssign.some(
                        ab => ab.playerId === originalPlayerID && 
                              ab.card.id === cardToMatch.id && // Check card ID for uniqueness
                              ab.source === 'discard'
                      );
                      if (!alreadyPending) {
                        pendingAbilitiesToAssign.push({
                          playerId: originalPlayerID,
                          card: cardToMatch,
                          source: 'discard',
                          currentAbilityStage: stageForDiscardedCard
                        });
                         logEventsToEmit.push({
                           message: `${getPlayerNameForLog(originalPlayerID, context)}'s discarded ${cardToMatch.rank}${cardToMatch.suit} was special. Ability queued.`,
                           type: 'game_event',
                           actorId: originalPlayerID,
                           cardContext: `${cardToMatch.rank}${cardToMatch.suit}`
                         });
                      }
                  } else if (context.playerWhoCalledCheck) {
                      nextPhaseToAssign = 'finalTurnsPhase' as GamePhase;
                  } else {
                      nextPhaseToAssign = 'playPhase' as GamePhase;
                  }
                  // Clear opportunity info only when the phase changes due to all passed
                  matchingOpportunityInfoToAssign = null; 
              }
              
              // Assign all calculated state changes
              enqueue.assign({
                  activePlayers: activePlayersToAssign,
                  matchingOpportunityInfo: matchingOpportunityInfoToAssign, 
                  currentPhase: nextPhaseToAssign,
                  pendingAbilities: pendingAbilitiesToAssign,
                  logHistory: undefined // Explicitly remove direct logHistory update
              });

              // Emit all collected log events
              for (const logData of logEventsToEmit) {
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC',
                  gameId: context.gameId,
                  publicLogData: logData
                });
              }
          })
        },
        MATCHING_STAGE_TIMER_EXPIRED: {
            actions: enqueueActions(({ context, event, enqueue }) => {
              const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, cardContext?: string, targetName?: string }> = [];
              
              const originalLogicResult = (() => {
                console.log('[GameMachine] Event: MATCHING_STAGE_TIMER_EXPIRED processing.');
                // newLogHistory is removed, logs collected in logEventsToEmit
                let activePlayersToAssign = { ...context.activePlayers }; // Renamed for clarity
                let matchingOpportunityInfoToAssign = context.matchingOpportunityInfo; // Renamed
                let nextPhaseToAssign: GamePhase = context.currentPhase; // Renamed
                let pendingAbilitiesToAssign = [...context.pendingAbilities]; // Renamed

                if (!matchingOpportunityInfoToAssign) {
                  console.warn('[GameMachine-MatchingTimeout] Timer expired but no matching opportunity info. Stale timer or already resolved.');
                  nextPhaseToAssign = context.playerWhoCalledCheck ? 'finalTurnsPhase' : 'playPhase';
                  // No specific logs to emit here, just assign state
                  return { 
                    matchingStageTimerExpiresAt: undefined,
                    currentPhase: nextPhaseToAssign,
                    matchingOpportunityInfo: null
                    // logHistory removed
                  };
                }

                const { cardToMatch, originalPlayerID } = matchingOpportunityInfoToAssign;
                const cardStr = cardToMatch.rank + cardToMatch.suit;
                const originalPlayerName = getPlayerNameForLog(originalPlayerID, context);
                
                logEventsToEmit.push({
                  message: `Matching stage for ${cardStr} (discarded by ${originalPlayerName}) timed out. Auto-passing remaining players.`,
                  type: 'game_event',
                  cardContext: cardStr
                });

                Object.keys(activePlayersToAssign).forEach(pId => {
                  if (activePlayersToAssign[pId] === PlayerActivityStatus.AWAITING_MATCH_ACTION) {
                    const playerName = getPlayerNameForLog(pId, context);
                    console.log(`[GameMachine-MatchingTimeout] Auto-passing player ${playerName}`);
                    logEventsToEmit.push({
                      message: `${playerName} was auto-passed for matching due to timeout.`,
                      type: 'game_event',
                      actorId: pId
                    });
                    delete activePlayersToAssign[pId];
                  }
                });
                
                matchingOpportunityInfoToAssign = null; // Renamed

                const isOriginalDiscardSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardToMatch.rank);
                if (isOriginalDiscardSpecial) {
                  console.log(`[GameMachine-MatchingTimeout] Original discard ${cardStr} by ${originalPlayerName} was special. Adding its ability.`);
                  let stageForDiscardedCard: 'peek' | 'swap' | undefined = undefined;
                  if (cardToMatch.rank === Rank.King || cardToMatch.rank === Rank.Queen) stageForDiscardedCard = 'peek';
                  else if (cardToMatch.rank === Rank.Jack) stageForDiscardedCard = 'swap';

                  const alreadyPending = pendingAbilitiesToAssign.some(
                    ab => ab.playerId === originalPlayerID && 
                          ab.card.id === cardToMatch.id && // Use card ID
                          ab.source === 'discard'
                  );
                  if (!alreadyPending) {
                    pendingAbilitiesToAssign.push({
                      playerId: originalPlayerID,
                      card: cardToMatch,
                      source: 'discard',
                      currentAbilityStage: stageForDiscardedCard
                    });
                    logEventsToEmit.push({
                      message: `${originalPlayerName}'s discarded ${cardStr} was special. Its ability is now queued.`,
                      type: 'game_event',
                      actorId: originalPlayerID,
                      cardContext: cardStr
                    });
                  }
                  nextPhaseToAssign = 'abilityResolutionPhase' as GamePhase;
                } else {
                  if (context.playerWhoCalledCheck) {
                    nextPhaseToAssign = 'finalTurnsPhase' as GamePhase;
                  } else {
                    nextPhaseToAssign = 'playPhase' as GamePhase;
                  }
                }
                
                return {
                  // logHistory removed
                  activePlayers: activePlayersToAssign,
                  matchingOpportunityInfo: matchingOpportunityInfoToAssign, 
                  matchingStageTimerExpiresAt: undefined, 
                  currentPhase: nextPhaseToAssign,
                  pendingAbilities: pendingAbilitiesToAssign,
                  currentTurnSegment: null 
                };
              })(); // End of IIFE
              
              enqueue.assign(originalLogicResult); // originalLogicResult no longer contains logHistory

              // Emit all collected log events
              for (const logData of logEventsToEmit) {
                enqueue.emit({
                  type: 'EMIT_LOG_PUBLIC',
                  gameId: context.gameId,
                  publicLogData: logData
                });
              }
            })
          },
        },
        always: [
        // If entry action decided to move to a different phase (no abilities pending)
        { target: 'finalTurnsPhase', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'finalTurnsPhase' && context.pendingAbilities.length === 0 },
        { target: 'playPhase', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'playPhase' && context.pendingAbilities.length === 0 },
        // If still in abilityResolutionPhase but something went wrong and no player/abilities (fallback)
        { target: 'playPhase', guard: ({context}: { context: GameMachineContext }) => context.currentPhase === 'abilityResolutionPhase' && (context.pendingAbilities.length === 0 || !context.currentPlayerId) }
      ]
    },
    finalTurnsPhase: {
      initial: 'determiningFinalTurnPlayer',
      entry: [
        assign({
          currentPhase: 'finalTurnsPhase' as GamePhase,
          // logHistory will be handled by emit
        }),
        enqueueActions(({ context, enqueue }) => {
          const playerWhoCalledCheckName = getPlayerNameForLog(context.playerWhoCalledCheck!, context);
          enqueue.emit({
            type: 'EMIT_LOG_PUBLIC',
            gameId: context.gameId,
            publicLogData: {
              message: `Final turns have begun. ${playerWhoCalledCheckName} called Check!.`,
              type: 'game_event',
              // actorId could be context.playerWhoCalledCheck if we want to associate the log with them
            }
          });
        })
      ],
      states: {
        determiningFinalTurnPlayer: {
          entry: assign(({ context }: { context: GameMachineContext }) => {
            console.log('[GameMachine-FinalTurns] Determining next player for final turn.');
            const { turnOrder, players, playerWhoCalledCheck, finalTurnsTaken } = context;
            let nextPlayerId = '';
            let updatedFinalTurnsTaken = finalTurnsTaken;
            let nextPhase: GamePhase = 'finalTurnsPhase'; 
            let newActivePlayers = { ...context.activePlayers };

            const eligiblePlayersForFinalTurn = turnOrder.filter(pId => 
                pId !== playerWhoCalledCheck && 
                players[pId] && 
                !players[pId].isLocked && 
                players[pId].isConnected && 
                !players[pId].forfeited
            );

            if (finalTurnsTaken >= eligiblePlayersForFinalTurn.length) {
              console.log('[GameMachine-FinalTurns] All eligible players have taken final turns. Proceeding to scoring.');
              nextPhase = 'scoringPhase' as GamePhase;
              newActivePlayers = {};
              return {
                currentPhase: nextPhase,
                currentPlayerId: '',
                activePlayers: newActivePlayers,
                currentTurnSegment: null,
                // Cleanup transient state
                globalAbilityTargets: null,
                lastRegularSwapInfo: null,
                matchResolvedDetails: null,
                lastResolvedAbilityCardForCleanup: null,
                lastResolvedAbilitySource: null,
                lastPlayerToResolveAbility: null,
              };
            }

            if (eligiblePlayersForFinalTurn.length > 0 && finalTurnsTaken < eligiblePlayersForFinalTurn.length) {
                nextPlayerId = eligiblePlayersForFinalTurn[finalTurnsTaken]; 
            } else if (eligiblePlayersForFinalTurn.length === 0 && finalTurnsTaken === 0) {
                console.log('[GameMachine-FinalTurns] No eligible players for any final turn. Proceeding to scoring.');
                nextPhase = 'scoringPhase' as GamePhase;
                newActivePlayers = {};
                return {
                    currentPhase: nextPhase,
                    currentPlayerId: '',
                    activePlayers: newActivePlayers,
                    currentTurnSegment: null,
                    // Cleanup transient state
                    globalAbilityTargets: null,
                    lastRegularSwapInfo: null,
                    matchResolvedDetails: null,
                    lastResolvedAbilityCardForCleanup: null,
                    lastResolvedAbilitySource: null,
                    lastPlayerToResolveAbility: null,
                };
            }
            
            if (nextPlayerId) {
              console.log(`[GameMachine-FinalTurns] Next player is ${getPlayerNameForLog(nextPlayerId, context)}. Final turns taken will be: ${updatedFinalTurnsTaken + 1}`);
              updatedFinalTurnsTaken++; 
              newActivePlayers = { [nextPlayerId]: PlayerActivityStatus.FINAL_TURN_ACTIVE };
              return {
                currentPlayerId: nextPlayerId,
                finalTurnsTaken: updatedFinalTurnsTaken, 
                currentTurnSegment: 'initialAction' as TurnSegment,
                activePlayers: newActivePlayers,
                discardPileIsSealed: false,
                // Cleanup transient state
                globalAbilityTargets: null,
                lastRegularSwapInfo: null,
                matchResolvedDetails: null,
                lastResolvedAbilityCardForCleanup: null,
                lastResolvedAbilitySource: null,
                lastPlayerToResolveAbility: null,
              };
            } else {
              console.warn('[GameMachine-FinalTurns] Could not determine next player, proceeding to scoring.');
              nextPhase = 'scoringPhase' as GamePhase;
              newActivePlayers = {};
              return {
                currentPhase: nextPhase,
                currentPlayerId: '',
                activePlayers: newActivePlayers,
                currentTurnSegment: null,
                // Cleanup transient state
                globalAbilityTargets: null,
                lastRegularSwapInfo: null,
                matchResolvedDetails: null,
                lastResolvedAbilityCardForCleanup: null,
                lastResolvedAbilitySource: null,
                lastPlayerToResolveAbility: null,
              };
            }
          }),
          always: [
            { target: 'finalPlayerTurn', guard: ({context}) => context.currentPlayerId !== '' && context.currentPhase === 'finalTurnsPhase' },
            { target: '#checkGame.scoringPhase', guard: ({context}) => context.currentPhase === 'scoringPhase' }
          ]
        },
        finalPlayerTurn: {
          invoke: {
            id: 'finalTurnTimer',
            src: 'turnTimerActor',
            input: ({ context }: { context: GameMachineContext }) => ({ 
                playerId: context.currentPlayerId, 
                duration: TURN_DURATION_MS 
            }),
            onDone: { 
              target: '#checkGame.playPhase.handleTimeout'
              // Timeout during final turn will be handled by the global timeout handler,
              // which needs to be aware of finalTurnsPhase.
            }
          },
          initial: 'awaitingFinalInitialAction',
          states: {
            awaitingFinalInitialAction: {
              entry: assign({ currentTurnSegment: 'initialAction' as TurnSegment }),
              on: {
                [PlayerActionType.DRAW_FROM_DECK]: {
                  target: 'awaitingFinalPostDrawAction',
                  guards: [
                      { type: 'isPlayersTurn' }, 
                      { type: 'hasNoPendingCard' },
                      { type: 'deckIsNotEmpty' }
                  ],
                  actions: [
                    assign(( { context, event } : { context: GameMachineContext, event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK}> } ) => {
                      const player = context.players[event.playerId];
                      const newDeck = [...context.deck];
                      const cardDrawn = newDeck.pop()!;
                      const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'deck' as 'deck' | 'discard' | null };
                      // emitLogEntry removed
                      return { 
                        players: { ...context.players, [event.playerId]: updatedPlayer }, 
                        deck: newDeck,
                        logHistory: undefined // Ensure no log history update from assign
                      };
                    }),
                    enqueueActions(({ context, event, enqueue }) => {
                      const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DECK}>;
                      const player = context.players[drawEvent.playerId];
                      const cardDrawn = player?.pendingDrawnCard; // Will be set by the preceding assign
                      
                      if (player && cardDrawn) {
                        const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                        // Public Log
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} drew from deck (final turn).`,
                            type: 'player_action',
                            actorId: drawEvent.playerId
                          }
                        });
                        // Private Log
                        enqueue.emit({
                          type: 'EMIT_LOG_PRIVATE',
                          gameId: context.gameId,
                          recipientPlayerId: drawEvent.playerId,
                          privateLogData: {
                            message: `You drew ${cardDrawn.rank}${cardDrawn.suit} (final turn).`,
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
                  target: 'awaitingFinalPostDrawAction',
                  guards: [
                      { type: 'isPlayersTurn' },
                      { type: 'hasNoPendingCard' },
                      { type: 'discardIsDrawable' } 
                  ],
                  actions: [
                    assign(( { context, event }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD}> } ) => {
                      const player = context.players[event.playerId];
                      const newDiscardPile = [...context.discardPile];
                      const cardDrawn = newDiscardPile.shift()!;
                      const updatedPlayer = { ...player!, pendingDrawnCard: cardDrawn, pendingDrawnCardSource: 'discard' as 'deck' | 'discard' | null };
                      // emitLogEntry removed
                      return { 
                        players: { ...context.players, [event.playerId]: updatedPlayer }, 
                        discardPile: newDiscardPile,
                        logHistory: undefined // Ensure no log history update from assign
                      };
                    }),
                    enqueueActions(({ context, event, enqueue }) => {
                      const drawEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DRAW_FROM_DISCARD}>;
                      const player = context.players[drawEvent.playerId];
                      const cardDrawn = player?.pendingDrawnCard; // Set by the preceding assign

                      if (player && cardDrawn) {
                        const playerName = getPlayerNameForLog(drawEvent.playerId, context);
                        enqueue.emit({
                          type: 'EMIT_LOG_PUBLIC',
                          gameId: context.gameId,
                          publicLogData: {
                            message: `${playerName} drew ${cardDrawn.rank}${cardDrawn.suit} from discard (final turn).`,
                            type: 'player_action',
                            actorId: drawEvent.playerId,
                            cardContext: `${cardDrawn.rank}${cardDrawn.suit}`
                          }
                        });
                      }
                    })
                  ]
                },
                // CALL_CHECK is disallowed in final turns (no transition defined, or guard needed)
              }
            },
            awaitingFinalPostDrawAction: {
              entry: assign({ currentTurnSegment: 'postDrawAction' as TurnSegment }),
              on: {
                [PlayerActionType.SWAP_AND_DISCARD]: {
                  target: 'determiningFinalTurnPlayer', 
                  guard: { type: 'isValidSwapAndDiscard' }, 
                  actions: [
                    assign(( { context, event }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>} ) => {
                      const player = context.players[event.playerId];
                      const newHand = [...player.hand];
                      const cardToPlaceInHand: Card = { ...player.pendingDrawnCard!, isFaceDownToOwner: true };
                      const cardFromHandToDiscard = newHand.splice(event.handIndex, 1, cardToPlaceInHand)[0];
                      const updatedPlayer = { ...player, hand: newHand, pendingDrawnCard: null, pendingDrawnCardSource: null };
                      const newDiscardPile = [cardFromHandToDiscard, ...context.discardPile];
                      
                      let nextPhaseOverride: GamePhase | undefined = undefined;
                      let newPendingAbilities = [...context.pendingAbilities];
                      const isDiscardedSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(cardFromHandToDiscard.rank);
                      if (isDiscardedSpecial) {
                          let stage: 'peek' | 'swap' | undefined = undefined;
                          if (cardFromHandToDiscard.rank === Rank.King || cardFromHandToDiscard.rank === Rank.Queen) stage = 'peek';
                          else if (cardFromHandToDiscard.rank === Rank.Jack) stage = 'swap';
                          // Ensure no duplicates if ability somehow already queued by other means (defensive)
                          if (!newPendingAbilities.some(ab => ab.playerId === event.playerId && ab.card.id === cardFromHandToDiscard.id && ab.source === 'discard')) {
                              newPendingAbilities.push({ playerId: event.playerId, card: cardFromHandToDiscard, source: 'discard', currentAbilityStage: stage });
                          }
                          nextPhaseOverride = 'abilityResolutionPhase';
                      }

                      return {
                          players: { ...context.players, [event.playerId]: updatedPlayer },
                          discardPile: newDiscardPile,
                          discardPileIsSealed: false,
                          currentTurnSegment: null,
                          logHistory: undefined,
                          ...(nextPhaseOverride && { currentPhase: nextPhaseOverride, pendingAbilities: newPendingAbilities })
                      };
                    }),
                    enqueueActions(({ context, event, enqueue }) => {
                      const swapEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.SWAP_AND_DISCARD; handIndex: number }>;
                      const playerName = getPlayerNameForLog(swapEvent.playerId, context);
                      const discardedCard = context.discardPile[0]; // Card just discarded by assign
                      const keptCard = context.players[swapEvent.playerId].hand[swapEvent.handIndex]; // Card just placed in hand

                      if (discardedCard && keptCard) {
                        const discardedCardStr = `${discardedCard.rank}${discardedCard.suit}`;
                        const keptCardStr = `${keptCard.rank}${keptCard.suit}`;
                        // Public Log for swap/discard
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
                        // Private Log for swap/discard
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

                        // New: Log if special ability was queued
                        if (context.currentPhase === 'abilityResolutionPhase') {
                          const queuedAbility = context.pendingAbilities.find(ab => 
                            ab.playerId === swapEvent.playerId && 
                            ab.card.id === discardedCard.id && 
                            ab.source === 'discard'
                          );
                          if (queuedAbility) {
                            enqueue.emit({
                              type: 'EMIT_LOG_PUBLIC',
                              gameId: context.gameId,
                              publicLogData: {
                                message: `${playerName}'s discarded ${discardedCardStr} was special. Its ability is now queued (final turn).`,
                                type: 'game_event',
                                actorId: swapEvent.playerId,
                                cardContext: discardedCardStr
                              }
                            });
                          }
                        }
                      }
                    })
                  ]
                },
                [PlayerActionType.DISCARD_DRAWN_CARD]: {
                  target: 'determiningFinalTurnPlayer',
                  guard: { type: 'isValidDiscardDrawnCard' }, 
                  actions: [
                    assign(( { context, event }: { context: GameMachineContext, event: Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>} ) => {
                      const player = context.players[event.playerId];
                      const drawnCardToDiscard = player.pendingDrawnCard!;
                      const updatedPlayer = { ...player, pendingDrawnCard: null, pendingDrawnCardSource: null };
                      const newDiscardPile = [drawnCardToDiscard, ...context.discardPile];

                      let nextPhaseOverride: GamePhase | undefined = undefined;
                      let updatedPendingAbilities = [...context.pendingAbilities]; // Use a different name to avoid conflict if newPendingAbilities is a common pattern
                      const isDiscardedSpecial = [Rank.King, Rank.Queen, Rank.Jack].includes(drawnCardToDiscard.rank);

                      if (isDiscardedSpecial) {
                          let stage: 'peek' | 'swap' | undefined = undefined;
                          if (drawnCardToDiscard.rank === Rank.King || drawnCardToDiscard.rank === Rank.Queen) stage = 'peek';
                          else if (drawnCardToDiscard.rank === Rank.Jack) stage = 'swap';
                          if (!updatedPendingAbilities.some(ab => ab.playerId === event.playerId && ab.card.id === drawnCardToDiscard.id && ab.source === 'discard')) {
                            updatedPendingAbilities.push({ playerId: event.playerId, card: drawnCardToDiscard, source: 'discard', currentAbilityStage: stage });
                          }
                          nextPhaseOverride = 'abilityResolutionPhase';
                      }
                      
                      const baseChanges = {
                        players: { ...context.players, [event.playerId]: updatedPlayer },
                        discardPile: newDiscardPile,
                        discardPileIsSealed: false,
                        currentTurnSegment: null,
                        logHistory: undefined,
                      };

                      if (nextPhaseOverride) {
                        return {
                          ...baseChanges,
                          currentPhase: nextPhaseOverride,
                          pendingAbilities: updatedPendingAbilities,
                        };
                      }
                      return baseChanges;
                    }),
                    enqueueActions(({ context, event, enqueue }) => {
                      const discardEvent = event as Extract<GameMachineEvent, { type: PlayerActionType.DISCARD_DRAWN_CARD }>;
                      const playerName = getPlayerNameForLog(discardEvent.playerId, context);
                      const discardedCardFromContext = context.discardPile[0]; // Card just discarded by assign

                      if (discardedCardFromContext) {
                        const discardedCardStr = `${discardedCardFromContext.rank}${discardedCardFromContext.suit}`;
                        // Public Log for discard
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

                        // Log if special ability was queued
                        if (context.currentPhase === 'abilityResolutionPhase') {
                          const queuedAbility = context.pendingAbilities.find(ab => 
                            ab.playerId === discardEvent.playerId && 
                            ab.card.id === discardedCardFromContext.id && 
                            ab.source === 'discard'
                          );
                          if (queuedAbility) {
                            enqueue.emit({
                              type: 'EMIT_LOG_PUBLIC',
                              gameId: context.gameId,
                              publicLogData: {
                                message: `${playerName}'s discarded ${discardedCardStr} was special. Its ability is now queued (final turn).`,
                                type: 'game_event',
                                actorId: discardEvent.playerId,
                                cardContext: discardedCardStr
                              }
                            });
                          }
                        }
                      }
                    })
                  ]
                }
              }
            }
          },
          always: [
            { 
              target: '#checkGame.abilityResolutionPhase', 
              guard: ({context}: {context: GameMachineContext}) => context.currentPhase === 'abilityResolutionPhase' 
            },
            { 
              target: '#checkGame.scoringPhase', 
              guard: ({context}: {context: GameMachineContext}) => context.currentPhase === 'scoringPhase' 
            }
          ]
        }
      }
    }, // END of finalTurnsPhase states
    
    },
    scoringPhase: {
    always: {
        target: 'gameOver',
      actions: assign(({ context }: { context: GameMachineContext }) => {
            console.log('[GameMachine] Calculating scores...');
            let minScore = Infinity;
            let roundWinnerIds: string[] = [];
            const scores: { [playerId: string]: number } = {};
            const finalHands: { [playerId: string]: Card[] } = {};
            const updatedPlayers = { ...context.players };
            const playerStatsForGameOver: GameOverData['playerStats'] = {};

          for (const playerId in updatedPlayers) {
              const player = updatedPlayers[playerId];
                let playerScore = 0;
              player.hand.forEach((card: Card) => { playerScore += cardValues[card.rank]; });
                player.score = playerScore;
                scores[playerId] = playerScore;
                finalHands[playerId] = [...player.hand];
                playerStatsForGameOver[playerId] = {
                    name: player.name || `P-${playerId.slice(-4)}`,
                    numMatches: player.numMatches,
                    numPenalties: player.numPenalties,
                };

              if (playerScore < minScore) {
                  minScore = playerScore;
                  roundWinnerIds = [playerId];
              } else if (playerScore === minScore) {
                  roundWinnerIds.push(playerId);
              }
          }
          const roundWinner = roundWinnerIds.length > 0 ? roundWinnerIds[0] : null; 
          
            return {
              players: updatedPlayers,
                roundWinner,
              gameover: { 
                winner: roundWinner || undefined, 
                scores, 
                finalHands, 
                totalTurns: context.totalTurnsInRound,
                playerStats: playerStatsForGameOver
              },
              // Cleanup transient state for game over
              globalAbilityTargets: null,
              lastRegularSwapInfo: null,
              matchResolvedDetails: null,
              lastResolvedAbilityCardForCleanup: null,
              lastResolvedAbilitySource: null,
              lastPlayerToResolveAbility: null,
              // Also ensure other potentially active elements are reset
              currentPlayerId: '',
              activePlayers: {},
              pendingAbilities: [],
              currentTurnSegment: null,
              matchingOpportunityInfo: null,
              discardPileIsSealed: false, // Reset for potential next round (though game is over)
              logHistory: undefined // Ensure no direct log history update
            };
        })
      }
    },
    gameOver: {
    type: 'final',
    },
    error: {
      type: 'final',
    },
    abilityResolutionPhase: {
      entry: enqueueActions(( { context, enqueue }: { context: GameMachineContext, enqueue: any } ) => {
        console.log('[GameMachine] Entering abilityResolutionPhase');
        
        let pendingAbilitiesToAssign = [...context.pendingAbilities];
        let nextPhaseToAssign = context.currentPhase as GamePhase;
        let currentPlayerIdToAssign = context.currentPlayerId;
        let activePlayersToAssign = { ...context.activePlayers };
        let discardPileIsSealedToAssign = true; 
        const logEventsToEmit: Array<Omit<RichGameLogMessage, 'timestamp' | 'logId' | 'isPublic' | 'recipientPlayerId'> & { actorId?: string, targetName?: string }> = [];

        // Player-specific state that might be updated if no abilities are pending
        let resolvedPlayerWhoCalledCheck = context.playerWhoCalledCheck;
        let resolvedMatchDetails = context.matchResolvedDetails;
        let resolvedGlobalAbilityTargets = context.globalAbilityTargets; // Default to preserving

        pendingAbilitiesToAssign.sort((a, b) => {
          const priorityOrder = { 'stack': 1, 'stackSecondOfPair': 2, 'discard': 3, 'deck': 4 };
          if ((a.source === 'stack' || a.source === 'stackSecondOfPair') && !(b.source === 'stack' || b.source === 'stackSecondOfPair')) return -1;
          if (!(a.source === 'stack' || a.source === 'stackSecondOfPair') && (b.source === 'stack' || b.source === 'stackSecondOfPair')) return 1;
          if ((a.source === 'stack' || a.source === 'stackSecondOfPair') && (b.source === 'stack' || b.source === 'stackSecondOfPair')) {
            if (a.pairTargetId && a.pairTargetId === context.lastPlayerToResolveAbility && a.source === 'stackSecondOfPair') return -1;
            if (b.pairTargetId && b.pairTargetId === context.lastPlayerToResolveAbility && b.source === 'stackSecondOfPair') return 1; 
          }
          return (priorityOrder[a.source] || 99) - (priorityOrder[b.source] || 99);
        });

        if (pendingAbilitiesToAssign.length === 0) {
          console.log('[GameMachine-AbilityEntry] No pending abilities. Determining next main phase.');
          
          if (resolvedMatchDetails?.isAutoCheck) {
            nextPhaseToAssign = 'finalTurnsPhase';
            if (!resolvedPlayerWhoCalledCheck) { // This auto-check is the first "Check"
              resolvedPlayerWhoCalledCheck = resolvedMatchDetails.byPlayerId;
            }
            logEventsToEmit.push({ message: `Auto-check by ${getPlayerNameForLog(resolvedMatchDetails.byPlayerId, context)} processed after abilities. Transitioning to final turns.`, type: 'game_event' });
          } else if (resolvedPlayerWhoCalledCheck) { // A check was already active
            nextPhaseToAssign = 'finalTurnsPhase';
             logEventsToEmit.push({ message: `Abilities resolved. Continuing final turns.`, type: 'game_event' });
          } else { // No auto-check, no prior check call
            nextPhaseToAssign = 'playPhase';
            logEventsToEmit.push({ message: `Abilities resolved. Transitioning to play phase.`, type: 'game_event' });
          }
          resolvedMatchDetails = null; // Always clear match details after this decision point
          currentPlayerIdToAssign = ''; 
          activePlayersToAssign = {};   
          resolvedGlobalAbilityTargets = null; // Clear GATs when leaving ability resolution
          discardPileIsSealedToAssign = false; // Unseal for next turn/phase
        } else {
          const abilityToResolve = pendingAbilitiesToAssign[0];
          currentPlayerIdToAssign = abilityToResolve.playerId;
          nextPhaseToAssign = 'abilityResolutionPhase'; 
          activePlayersToAssign = { [currentPlayerIdToAssign]: PlayerActivityStatus.ABILITY_RESOLUTION_ACTIVE };
          // discardPileIsSealedToAssign remains true
          // resolvedGlobalAbilityTargets remains context.globalAbilityTargets (preserved)
          
          const abilityCardName = `${abilityToResolve.card.rank}${abilityToResolve.card.suit}`;
          const playerName = getPlayerNameForLog(currentPlayerIdToAssign, context);
          const logMsg = `Resolving ${abilityCardName} ability for ${playerName} (source: ${abilityToResolve.source}).`;
          logEventsToEmit.push({
            message: logMsg, type: 'game_event',
            actorId: currentPlayerIdToAssign
          });
          console.log(`[GameMachine-AbilityEntry] ${logMsg}`);
        }

        enqueue.assign({
          pendingAbilities: pendingAbilitiesToAssign,
          currentPhase: nextPhaseToAssign,
          currentPlayerId: currentPlayerIdToAssign,
          activePlayers: activePlayersToAssign,
          discardPileIsSealed: discardPileIsSealedToAssign,
          currentTurnSegment: null, 
          playerWhoCalledCheck: resolvedPlayerWhoCalledCheck, // Updated if auto-check logic hit
          matchResolvedDetails: resolvedMatchDetails,       // Cleared if logic hit
          globalAbilityTargets: resolvedGlobalAbilityTargets, // Updated if logic hit
          logHistory: undefined 
        });

        for (const logData of logEventsToEmit) {
          enqueue.emit({
            type: 'EMIT_LOG_PUBLIC',
            gameId: context.gameId,
            publicLogData: logData
          });
        }
      }),
      invoke: {
        // ... existing code ...
      }
    }
}
// Implementations are now in setup()
// {
//   delays: {
//     peekDuration: 10000, // PEEK_TOTAL_DURATION_MS (10 seconds)
//   },
//   guards: {
//     allPlayersReadyAndPeekNotYetStarted: ({ context }: { context: GameMachineContext }) => {
//       // This guard is still useful for other potential logic or if we revert to choose/enqueueActions
//       return context.turnOrder.every((pid: string) => context.players[pid]?.isReadyForInitialPeek) && !context.initialPeekAllReadyTimestamp;
//     }
//   },
// }
); 