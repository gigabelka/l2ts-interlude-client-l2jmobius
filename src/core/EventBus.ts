import { EventEmitter } from 'events';
import { Logger } from '../logger/Logger';

/**
 * Typed EventBus for real-time event streaming.
 * Used by WebSocket server to broadcast events to subscribers.
 */
export type EventChannel = 
    | 'system' 
    | 'character' 
    | 'combat' 
    | 'chat' 
    | 'world' 
    | 'movement' 
    | 'party';

export interface BaseEvent {
    type: string;
    channel: EventChannel;
    data: Record<string, unknown>;
    timestamp: string;
}

// Character events
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

export interface CharacterLevelUpEvent extends BaseEvent {
    type: 'character.level_up';
    channel: 'character';
    data: {
        newLevel: number;
        oldLevel: number;
        sp: number;
    };
}

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

export interface CharacterBuffRemovedEvent extends BaseEvent {
    type: 'character.buff_removed';
    channel: 'character';
    data: {
        skillId: number;
        name: string;
    };
}

export interface CharacterDiedEvent extends BaseEvent {
    type: 'character.died';
    channel: 'character';
    data: {
        killerObjectId?: number;
        killerName?: string;
        position: { x: number; y: number; z: number };
    };
}

export interface CharacterRevivedEvent extends BaseEvent {
    type: 'character.revived';
    channel: 'character';
    data: {
        position: { x: number; y: number; z: number };
        hp: number;
        mp: number;
    };
}

export interface CharacterSkillsUpdatedEvent extends BaseEvent {
    type: 'character.skills_updated';
    channel: 'character';
    data: {
        skills: Array<{
            skillId: number;
            level: number;
            type: string;
            passive: boolean;
        }>;
        totalCount: number;
        activeCount: number;
        passiveCount: number;
    };
}

// Combat events
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

// World events
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

export interface WorldNpcDespawnedEvent extends BaseEvent {
    type: 'world.npc_despawned';
    channel: 'world';
    data: {
        objectId: number;
    };
}

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

export interface WorldItemPickedUpEvent extends BaseEvent {
    type: 'world.item_picked_up';
    channel: 'world';
    data: {
        objectId: number;
        pickedByObjectId: number;
    };
}

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

// Movement events
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

// System events
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

export interface SystemErrorEvent extends BaseEvent {
    type: 'system.error';
    channel: 'system';
    data: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export interface SystemSubscribedEvent extends BaseEvent {
    type: 'system.subscribed';
    channel: 'system';
    data: {
        channels: string[];
    };
}

export interface SystemUnsubscribedEvent extends BaseEvent {
    type: 'system.unsubscribed';
    channel: 'system';
    data: {
        channels: string[];
    };
}

export interface PongEvent extends BaseEvent {
    type: 'pong';
    channel: 'system';
    data: Record<string, never>;
}

// Chat events
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

export interface ChatSystemMessageEvent extends BaseEvent {
    type: 'chat.system_message';
    channel: 'chat';
    data: {
        messageId: number;
        messageText: string;
        params: string[];
    };
}

// Combat started event
export interface CombatAttackStartedEvent extends BaseEvent {
    type: 'combat.attack_started';
    channel: 'combat';
    data: {
        attackerObjectId: number;
        targetObjectId: number;
    };
}

// Player seen event
export interface WorldPlayerSeenEvent extends BaseEvent {
    type: 'world.player_seen';
    channel: 'world';
    data: {
        objectId: number;
        name: string;
        position: { x: number; y: number; z: number };
    };
}

// Raw packet event - for any packet
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

// Union type of all events
export type GameEvent =
    | CharacterStatsChangedEvent
    | CharacterLevelUpEvent
    | CharacterBuffAddedEvent
    | CharacterBuffRemovedEvent
    | CharacterDiedEvent
    | CharacterRevivedEvent
    | CharacterSkillsUpdatedEvent
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
    | RawPacketEvent;

/**
 * Typed EventBus wrapper around EventEmitter.
 */
class TypedEventBus extends EventEmitter {
    private static instance: TypedEventBus;

    static getInstance(): TypedEventBus {
        if (!TypedEventBus.instance) {
            TypedEventBus.instance = new TypedEventBus();
        }
        return TypedEventBus.instance;
    }

    emitEvent(event: GameEvent | BaseEvent): void {
        Logger.debug('EventBus', `[${event.channel}] ${event.type}`);
        this.emit(event.type, event);
        this.emit('*', event);
    }

    onEvent(eventType: GameEvent['type'] | string, listener: (event: GameEvent | BaseEvent) => void): this {
        return this.on(eventType, listener);
    }

    onAny(listener: (event: GameEvent) => void): this {
        return this.on('*', listener as (...args: unknown[]) => void);
    }
}

export const EventBus = TypedEventBus.getInstance();
