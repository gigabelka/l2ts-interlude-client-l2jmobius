import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';

/**
 * @fileoverview EventBus - Typed EventBus for real-time event streaming
 * 
 * Provides a type-safe wrapper around Node.js EventEmitter for broadcasting
 * game events to WebSocket subscribers. Supports typed events, channels,
 and wildcard subscriptions.
 * 
 * @module core/EventBus
 * @example
 * ```typescript
 * // Emit an event
 * EventBus.emitEvent({
 *   type: 'character.stats_changed',
 *   channel: 'character',
 *   data: { hp: { current: 100, max: 100 } },
 *   timestamp: new Date().toISOString()
 * });
 * 
 * // Subscribe to specific event
 * EventBus.onEvent('character.stats_changed', (event) => {
 *   console.log('HP changed:', event.data.hp);
 * });
 * 
 * // Subscribe to all events
 * EventBus.onAny((event) => {
 *   console.log(`[${event.channel}] ${event.type}`);
 * });
 * ```
 */

/**
 * Event channels for categorizing events.
 * Used by WebSocket server to filter events for subscribers.
 */
export type EventChannel = 
    | 'system' 
    | 'character' 
    | 'combat' 
    | 'chat' 
    | 'world' 
    | 'movement' 
    | 'party'
    | 'inventory';

/**
 * Base interface for all game events.
 * All specific event interfaces extend this.
 */
export interface BaseEvent {
    /** Event type identifier (e.g., 'character.stats_changed') */
    type: string;
    /** Event channel for categorization */
    channel: EventChannel;
    /** Event payload data */
    data: Record<string, unknown>;
    /** ISO 8601 timestamp */
    timestamp: string;
}

// ==================== Character Events ====================

/**
 * Emitted when character stats (HP, MP, CP, XP, SP) change.
 * @event
 */
export interface CharacterStatsChangedEvent extends BaseEvent {
    type: 'character.stats_changed';
    channel: 'character';
    data: {
        hp?: { current: number; max: number; delta?: number };
        mp?: { current: number; max: number; delta?: number };
        cp?: { current: number; max: number; delta?: number };
        xp?: { current: number; max: number; delta?: number };
        sp?: { current: number; delta?: number };
    };
}

/**
 * Emitted when character levels up.
 * @event
 */
export interface CharacterLevelUpEvent extends BaseEvent {
    type: 'character.level_up';
    channel: 'character';
    data: {
        newLevel: number;
        oldLevel: number;
        sp: number;
    };
}

/**
 * Emitted when a buff is added to the character.
 * @event
 */
export interface CharacterBuffAddedEvent extends BaseEvent {
    type: 'character.buff_added';
    channel: 'character';
    data: {
        skillId: number;
        name: string;
        level: number;
        duration: number;
        isDebuff: boolean;
    };
}

/**
 * Emitted when a buff is removed from the character.
 * @event
 */
export interface CharacterBuffRemovedEvent extends BaseEvent {
    type: 'character.buff_removed';
    channel: 'character';
    data: {
        skillId: number;
        name: string;
    };
}

/**
 * Emitted when the character dies.
 * @event
 */
export interface CharacterDiedEvent extends BaseEvent {
    type: 'character.died';
    channel: 'character';
    data: {
        killerObjectId?: number;
        killerName?: string;
        position: { x: number; y: number; z: number };
    };
}

/**
 * Emitted when the character is revived.
 * @event
 */
export interface CharacterRevivedEvent extends BaseEvent {
    type: 'character.revived';
    channel: 'character';
    data: {
        position: { x: number; y: number; z: number };
        hp: number;
        mp: number;
    };
}

/**
 * Emitted when character skills are updated (e.g., after learning new skill).
 * @event
 */
export interface CharacterSkillsUpdatedEvent extends BaseEvent {
    type: 'character.skills_updated';
    channel: 'character';
    data: {
        skills: Array<{
            skillId: number;
            level: number;
            type: string;
            passive: boolean;
            name?: string;
        }>;
        totalCount: number;
        activeCount: number;
        passiveCount: number;
    };
}

/**
 * Emitted when character skills are cleared (e.g., on disconnect).
 * @event
 */
export interface CharacterSkillsClearedEvent extends BaseEvent {
    type: 'character.skills_cleared';
    channel: 'character';
    data: {
        skills: [];
        totalCount: 0;
        activeCount: 0;
        passiveCount: 0;
        reason: string;
    };
}

/**
 * Emitted when inventory is cleared (e.g., on disconnect).
 * @event
 */
export interface InventoryClearedEvent extends BaseEvent {
    type: 'inventory.cleared';
    channel: 'character';
    data: {
        items: [];
        adena: 0;
        reason: string;
    };
}

// ==================== Combat Events ====================

/**
 * Emitted when character attacks a target.
 * @event
 */
export interface CombatAttackSentEvent extends BaseEvent {
    type: 'combat.attack_sent';
    channel: 'combat';
    data: {
        attackerObjectId: number;
        targetObjectId: number;
        damage: number;
        isCritical: boolean;
        isMiss: boolean;
        attackType: 'MELEE' | 'MAGIC' | 'RANGED';
    };
}

/**
 * Emitted when character is attacked.
 * @event
 */
export interface CombatAttackReceivedEvent extends BaseEvent {
    type: 'combat.attack_received';
    channel: 'combat';
    data: {
        attackerObjectId: number;
        attackerName: string;
        damage: number;
        isCritical: boolean;
        newHp: number;
        newMp: number;
    };
}

/**
 * Emitted when a skill is used.
 * @event
 */
export interface CombatSkillUsedEvent extends BaseEvent {
    type: 'combat.skill_used';
    channel: 'combat';
    data: {
        casterObjectId: number;
        targetObjectId: number;
        skillId: number;
        skillName: string;
        skillLevel: number;
        isSuccessful: boolean;
    };
}

/**
 * Emitted when the current target dies.
 * @event
 */
export interface CombatTargetDiedEvent extends BaseEvent {
    type: 'combat.target_died';
    channel: 'combat';
    data: {
        objectId: number;
        name: string;
        npcId?: number;
        position: { x: number; y: number; z: number };
    };
}

// ==================== World Events ====================

/**
 * Emitted when an NPC spawns nearby.
 * @event
 */
export interface WorldNpcSpawnedEvent extends BaseEvent {
    type: 'world.npc_spawned';
    channel: 'world';
    data: {
        objectId: number;
        npcId: number;
        name: string;
        level: number;
        position: { x: number; y: number; z: number };
        isAttackable: boolean;
    };
}

/**
 * Emitted when an NPC despawns.
 * @event
 */
export interface WorldNpcDespawnedEvent extends BaseEvent {
    type: 'world.npc_despawned';
    channel: 'world';
    data: {
        objectId: number;
    };
}

/**
 * Emitted when an item drops in the world.
 * @event
 */
export interface WorldItemDroppedEvent extends BaseEvent {
    type: 'world.item_dropped';
    channel: 'world';
    data: {
        objectId: number;
        itemId: number;
        name: string;
        count: number;
        position: { x: number; y: number; z: number };
    };
}

/**
 * Emitted when an item is picked up.
 * @event
 */
export interface WorldItemPickedUpEvent extends BaseEvent {
    type: 'world.item_picked_up';
    channel: 'world';
    data: {
        objectId: number;
        pickedByObjectId: number;
    };
}

/**
 * Emitted when character starts picking up an item.
 * @event
 */
export interface WorldItemPickingUpEvent extends BaseEvent {
    type: 'world.item_picking_up';
    channel: 'world';
    data: {
        objectId: number;
        itemId: number;
        name: string;
        count: number;
    };
}

// ==================== Movement Events ====================

/**
 * Emitted when character position changes.
 * @event
 */
export interface MovementPositionChangedEvent extends BaseEvent {
    type: 'movement.position_changed';
    channel: 'movement';
    data: {
        objectId: number;
        position: { x: number; y: number; z: number; heading?: number };
        speed: number;
        isRunning: boolean;
    };
}

// ==================== System Events ====================

/**
 * Emitted when connection to game server is established.
 * @event
 */
export interface SystemConnectedEvent extends BaseEvent {
    type: 'system.connected';
    channel: 'system';
    data: {
        phase: string;
        characterName?: string;
        serverId?: number;
        message?: string;
        clientId?: string;
    };
}

/**
 * Emitted when disconnected from game server.
 * @event
 */
export interface SystemDisconnectedEvent extends BaseEvent {
    type: 'system.disconnected';
    channel: 'system';
    data: {
        reason: string;
        phase: string;
        willReconnect: boolean;
        reconnectIn?: number;
    };
}

/**
 * Emitted when an error occurs.
 * @event
 */
export interface SystemErrorEvent extends BaseEvent {
    type: 'system.error';
    channel: 'system';
    data: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * Emitted when WebSocket client subscribes to channels.
 * @event
 */
export interface SystemSubscribedEvent extends BaseEvent {
    type: 'system.subscribed';
    channel: 'system';
    data: {
        channels: string[];
    };
}

/**
 * Emitted when WebSocket client unsubscribes from channels.
 * @event
 */
export interface SystemUnsubscribedEvent extends BaseEvent {
    type: 'system.unsubscribed';
    channel: 'system';
    data: {
        channels: string[];
    };
}

/**
 * Emitted as pong response to ping.
 * @event
 */
export interface PongEvent extends BaseEvent {
    type: 'pong';
    channel: 'system';
    data: Record<string, never>;
}

// ==================== Inventory Events ====================

/**
 * Emitted when inventory changes (item added, removed, or modified).
 * @event
 */
export interface InventoryChangedEvent extends BaseEvent {
    type: 'inventory.changed' | 'inventory.item_added' | 'inventory.item_removed' | 'inventory.item_modified' | 'inventory.updated';
    channel: 'character' | 'inventory';
    data: {
        action?: 'added' | 'removed' | 'updated';
        objectId?: number;
        itemId?: number;
        name?: string;
        count?: number;
        oldCount?: number;
        newCount?: number;
        enchant?: number;
        oldEnchant?: number;
        newEnchant?: number;
        equipped?: boolean;
        slot?: number;
        totalItems?: number;
        added?: number;
        modified?: number;
        removed?: number;
        equippedCount?: number;
    };
}

/**
 * Emitted when adena (gold) amount changes.
 * @event
 */
export interface InventoryAdenaChangedEvent extends BaseEvent {
    type: 'inventory.adena_changed';
    channel: 'character' | 'inventory';
    data: {
        oldAmount: number;
        newAmount: number;
        delta: number;
    };
}

// ==================== Chat Events ====================

/**
 * Emitted when a chat message is received.
 * @event
 */
export interface ChatMessageEvent extends BaseEvent {
    type: 'chat.message';
    channel: 'chat';
    data: {
        channel: string;
        senderName: string;
        senderObjectId?: number;
        objectId?: number;
        message: string;
        receivedAt: string;
    };
}

/**
 * Emitted when a system message is received.
 * @event
 */
export interface ChatSystemMessageEvent extends BaseEvent {
    type: 'chat.system_message';
    channel: 'chat';
    data: {
        messageId: number;
        messageText: string;
        params: string[];
    };
}

// ==================== Additional Events ====================

/**
 * Emitted when an attack sequence starts.
 * @event
 */
export interface CombatAttackStartedEvent extends BaseEvent {
    type: 'combat.attack_started';
    channel: 'combat';
    data: {
        attackerObjectId: number;
        targetObjectId: number;
    };
}

/**
 * Emitted when another player is seen.
 * @event
 */
export interface WorldPlayerSeenEvent extends BaseEvent {
    type: 'world.player_seen';
    channel: 'world';
    data: {
        objectId: number;
        name: string;
        position: { x: number; y: number; z: number };
    };
}

/**
 * Emitted for every raw packet received (for debugging).
 * @event
 */
export interface RawPacketEvent extends BaseEvent {
    type: 'system.raw_packet';
    channel: 'system';
    data: {
        opcode: number;
        opcodeHex: string;
        length: number;
        state?: string;
        source?: string;
    };
}

/**
 * Union type of all game events.
 * Used for type-safe event handling.
 */
export type GameEvent =
    | CharacterStatsChangedEvent
    | CharacterLevelUpEvent
    | CharacterBuffAddedEvent
    | CharacterBuffRemovedEvent
    | CharacterDiedEvent
    | CharacterRevivedEvent
    | CharacterSkillsUpdatedEvent
    | CharacterSkillsClearedEvent
    | InventoryClearedEvent
    | CombatAttackSentEvent
    | CombatAttackReceivedEvent
    | CombatSkillUsedEvent
    | CombatTargetDiedEvent
    | WorldNpcSpawnedEvent
    | WorldNpcDespawnedEvent
    | WorldItemDroppedEvent
    | WorldItemPickedUpEvent
    | WorldItemPickingUpEvent
    | MovementPositionChangedEvent
    | SystemConnectedEvent
    | SystemDisconnectedEvent
    | SystemErrorEvent
    | SystemSubscribedEvent
    | SystemUnsubscribedEvent
    | PongEvent
    | ChatMessageEvent
    | ChatSystemMessageEvent
    | CombatAttackStartedEvent
    | WorldPlayerSeenEvent
    | RawPacketEvent
    | InventoryChangedEvent
    | InventoryAdenaChangedEvent;

/**
 * Typed EventBus wrapper around Node.js EventEmitter.
 * 
 * Provides type-safe event emission and subscription with support for:
 * - Typed events via TypeScript discriminated unions
 * - Channel-based event categorization
 * - Wildcard subscriptions via `onAny`
 * - Singleton pattern for global event bus
 * 
 * @class TypedEventBus
 */
class TypedEventBus extends EventEmitter {
    private static instance: TypedEventBus;

    /**
     * Get the singleton instance of EventBus.
     * @returns {TypedEventBus} The singleton instance
     */
    static getInstance(): TypedEventBus {
        if (!TypedEventBus.instance) {
            TypedEventBus.instance = new TypedEventBus();
        }
        return TypedEventBus.instance;
    }

    /**
     * Emit a typed event to all subscribers.
     * 
     * @param {GameEvent | BaseEvent} event - The event to emit
     * @returns {void}
     * @example
     * ```typescript
     * EventBus.emitEvent({
     *   type: 'character.stats_changed',
     *   channel: 'character',
     *   data: { hp: { current: 100, max: 100 } },
     *   timestamp: new Date().toISOString()
     * });
     * ```
     */
    emitEvent(event: GameEvent | BaseEvent): void {
        Logger.debug('EventBus', `[${event.channel}] ${event.type}`);
        this.emit(event.type, event);
        this.emit('*', event);
    }

    /**
     * Subscribe to a specific event type.
     * 
     * @param {GameEvent['type'] | string} eventType - The event type to subscribe to
     * @param {(event: GameEvent | BaseEvent) => void} listener - Callback function
     * @returns {this} This EventBus instance for chaining
     * @example
     * ```typescript
     * EventBus.onEvent('character.stats_changed', (event) => {
     *   console.log('HP:', event.data.hp?.current);
     * });
     * ```
     */
    onEvent(eventType: GameEvent['type'] | string, listener: (event: GameEvent | BaseEvent) => void): this {
        return this.on(eventType, listener);
    }

    /**
     * Subscribe to all events (wildcard subscription).
     * 
     * @param {(event: GameEvent) => void} listener - Callback function
     * @returns {this} This EventBus instance for chaining
     * @example
     * ```typescript
     * EventBus.onAny((event) => {
     *   console.log(`[${event.channel}] ${event.type}`);
     * });
     * ```
     */
    onAny(listener: (event: GameEvent) => void): this {
        return this.on('*', listener as (...args: unknown[]) => void);
    }
}

/**
 * Global singleton instance of the typed EventBus.
 * Use this for all event operations.
 * 
 * @example
 * ```typescript
 * import { EventBus } from './core/EventBus';
 * 
 * // Subscribe to events
 * EventBus.onEvent('character.stats_changed', (event) => {
 *   // Handle event
 * });
 * 
 * // Emit events
 * EventBus.emitEvent({
 *   type: 'character.stats_changed',
 *   channel: 'character',
 *   data: { hp: { current: 100, max: 100 } },
 *   timestamp: new Date().toISOString()
 * });
 * ```
 */
export const EventBus = TypedEventBus.getInstance();
