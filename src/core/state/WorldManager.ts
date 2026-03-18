/**
 * @fileoverview Управление состоянием мира (NPC, игроки, предметы)
 * @module core/state/WorldManager
 */

import { StateManager } from './StateManager';
import { EventBus } from '../EventBus';
import type { IStateEntity } from './StateManager';
import type { Position } from '../GameStateStore';

/**
 * Информация о NPC
 */
export interface INpcInfo extends IStateEntity {
    id: number; // objectId
    npcId: number;
    name: string;
    level: number;
    hp: { current: number; max: number };
    isAttackable: boolean;
    isAggressive: boolean;
    position: Position;
}

/**
 * Информация об игроке
 */
export interface IPlayerInfo extends IStateEntity {
    id: number; // objectId
    name: string;
    level: number;
    classId: number;
    hp: { current: number; max: number };
    position: Position;
}

/**
 * Брошенный предмет
 */
export interface IItemDrop extends IStateEntity {
    id: number; // objectId
    itemId: number;
    name: string;
    count: number;
    position: Position;
}

/**
 * Менеджер мира (NPC, игроки, предметы) - Singleton
 */
export class WorldManager {
    private static instance: WorldManager;
    
    readonly npcs: StateManager<INpcInfo>;
    readonly players: StateManager<IPlayerInfo>;
    readonly items: StateManager<IItemDrop>;

    private constructor() {
        this.npcs = new StateManager<INpcInfo>({
            name: 'NpcManager',
            eventChannel: 'world',
            eventType: 'world.npc_updated',
            historyDepth: 5
        });

        this.players = new StateManager<IPlayerInfo>({
            name: 'PlayerManager',
            eventChannel: 'world',
            eventType: 'world.player_updated',
            historyDepth: 5
        });

        this.items = new StateManager<IItemDrop>({
            name: 'ItemDropManager',
            eventChannel: 'world',
            eventType: 'world.item_updated',
            historyDepth: 5
        });
    }

    static getInstance(): WorldManager {
        if (!WorldManager.instance) {
            WorldManager.instance = new WorldManager();
        }
        return WorldManager.instance;
    }

    // ============ NPC Methods ============

    addNpc(npc: INpcInfo): void {
        this.npcs.set(npc.id, npc);
        
        EventBus.emitEvent({
            type: 'world.npc_spawned',
            channel: 'world',
            data: {
                objectId: npc.id,
                npcId: npc.npcId,
                name: npc.name,
                level: npc.level,
                position: npc.position,
                isAttackable: npc.isAttackable
            },
            timestamp: new Date().toISOString()
        });
    }

    removeNpc(objectId: number): void {
        this.npcs.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.npc_despawned',
            channel: 'world',
            data: { objectId },
            timestamp: new Date().toISOString()
        });
    }

    getNpc(objectId: number): INpcInfo | undefined {
        return this.npcs.get(objectId);
    }

    getNearbyNpcs(center: Position, radius: number, options?: { 
        attackable?: boolean; 
        alive?: boolean;
    }): Array<INpcInfo & { distance: number }> {
        return this.npcs.getAll()
            .map(npc => ({
                ...npc,
                distance: this.calculateDistance(center, npc.position)
            }))
            .filter(npc => {
                if (npc.distance > radius) return false;
                if (options?.attackable !== undefined && npc.isAttackable !== options.attackable) return false;
                if (options?.alive !== undefined) {
                    const isAlive = npc.hp.current > 0;
                    if (isAlive !== options.alive) return false;
                }
                return true;
            })
            .sort((a, b) => a.distance - b.distance);
    }

    // ============ Player Methods ============

    addPlayer(player: IPlayerInfo): void {
        this.players.set(player.id, player);
        
        EventBus.emitEvent({
            type: 'world.player_seen',
            channel: 'world',
            data: {
                objectId: player.id,
                name: player.name,
                position: player.position
            },
            timestamp: new Date().toISOString()
        });
    }

    removePlayer(objectId: number): void {
        this.players.delete(objectId);
    }

    getPlayer(objectId: number): IPlayerInfo | undefined {
        return this.players.get(objectId);
    }

    getNearbyPlayers(center: Position, radius: number): Array<IPlayerInfo & { distance: number }> {
        return this.players.getAll()
            .map(player => ({
                ...player,
                distance: this.calculateDistance(center, player.position)
            }))
            .filter(player => player.distance <= radius)
            .sort((a, b) => a.distance - b.distance);
    }

    // ============ Item Methods ============

    addItemDrop(item: IItemDrop): void {
        this.items.set(item.id, item);
        
        EventBus.emitEvent({
            type: 'world.item_dropped',
            channel: 'world',
            data: {
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                position: item.position
            },
            timestamp: new Date().toISOString()
        });
    }

    removeItemDrop(objectId: number, pickedByObjectId?: number): void {
        this.items.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.item_picked_up',
            channel: 'world',
            data: { objectId, pickedByObjectId: pickedByObjectId || 0 },
            timestamp: new Date().toISOString()
        });
    }

    getNearbyItems(center: Position, radius: number): Array<IItemDrop & { distance: number }> {
        return this.items.getAll()
            .map(item => ({
                ...item,
                distance: this.calculateDistance(center, item.position)
            }))
            .filter(item => item.distance <= radius)
            .sort((a, b) => a.distance - b.distance);
    }

    // ============ Utility Methods ============

    /**
     * Очистить весь мир
     */
    clear(): void {
        this.npcs.clear();
        this.players.clear();
        this.items.clear();
    }

    /**
     * Получить статистику мира
     */
    getStats(): { npcs: number; players: number; items: number } {
        return {
            npcs: this.npcs.count(),
            players: this.players.count(),
            items: this.items.count()
        };
    }

    /**
     * Рассчитать расстояние между двумя точками
     */
    private calculateDistance(pos1: Position, pos2: Position): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

// Экспорт синглтона
export const worldManager = WorldManager.getInstance();
