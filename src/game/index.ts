// src/game/index.ts
// Game module exports

// Core game client
export { GameClientNew } from './GameClient';
export type { IGameClient } from './IGameClient';
export { GameState } from './GameState';
export { GameCommandManager } from './GameCommandManager';

// Outgoing packets
export * from './packets/outgoing';
