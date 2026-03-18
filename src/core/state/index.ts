/**
 * @fileoverview Экспорты модуля управления состоянием
 * @module core/state
 */

export { StateManager, SingletonStateManager } from './StateManager';
export type { 
    IStateEntity, 
    StateManagerOptions, 
    UpdateResult 
} from './StateManager';

export { CharacterManager, characterManager } from './CharacterManager';
export type { ICharacterState } from './CharacterManager';

export { WorldManager, worldManager } from './WorldManager';
export type { INpcInfo, IPlayerInfo, IItemDrop } from './WorldManager';
