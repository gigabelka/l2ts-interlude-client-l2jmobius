/**
 * @fileoverview GameStateStoreAdapter - адаптер для совместимости со старым API
 * Транслирует вызовы legacy GameStateStore в новую архитектуру
 * Позволяет постепенную миграцию без полного переписывания
 * @module infrastructure/adapters
 */

import type {
    ICharacterRepository,
    IWorldRepository,
    IInventoryRepository,
} from '../../domain/repositories';
import type { IEventBus } from '../../application/ports';
import { Position, Vitals, BaseStats, CombatStats } from '../../domain/value-objects';
import { Character } from '../../domain/entities';
import {
    CharacterEnteredGameEvent,
} from '../../domain/events';

// Legacy типы для совместимости
export interface LegacyPosition {
    x: number;
    y: number;
    z: number;
    heading?: number;
}

export interface LegacyHpMpCp {
    current: number;
    max: number;
}

export interface LegacyCharacterState {
    objectId: number;
    name: string;
    title: string;
    classId: number;
    className: string;
    level: number;
    race: string;
    sex: string;
    hp: LegacyHpMpCp;
    mp: LegacyHpMpCp;
    cp: LegacyHpMpCp;
    exp: number;
    expPercent: number;
    sp: number;
    karma: number;
    pvpKills: number;
    pkKills: number;
    position: LegacyPosition;
    stats: Record<string, number>;
    buffs: unknown[];
    skills: unknown[];
    targetObjectId?: number;
}

export interface LegacyNpcInfo {
    objectId: number;
    npcId: number;
    name: string;
    level: number;
    hp: LegacyHpMpCp;
    isAttackable: boolean;
    isAggressive: boolean;
    position: LegacyPosition;
    distance?: number;
}

export interface LegacyInventoryItem {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    type: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
    equipped: boolean;
    slot: number;
    enchant: number;
    mana: number;
    grade?: 'No' | 'D' | 'C' | 'B' | 'A' | 'S';
}

export interface LegacyInventoryState {
    adena: number;
    weight: { current: number; max: number };
    items: LegacyInventoryItem[];
}

/**
 * Адаптер GameStateStore - мост между старым API и новой архитектурой
 * 
 * Использование:
 * ```typescript
 * // Старый код продолжает работать:
 * GameStateStore.updateCharacter({ name: 'Player', level: 80 });
 * const npcs = GameStateStore.getNearbyNpcs(600);
 * 
 * // Новый код может использовать репозитории напрямую:
 * const char = characterRepository.get();
 * ```
 */
export class GameStateStoreAdapter {
    constructor(
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository,
        private inventoryRepo: IInventoryRepository,
        private eventBus: IEventBus
    ) {
        this.setupEventForwarding();
    }

    // ============================================================================
    // Character API (Legacy)
    // ============================================================================

    getCharacter(): Partial<LegacyCharacterState> {
        const char = this.characterRepo.get();
        if (!char) return {};

        return {
            objectId: char.id,
            name: char.name,
            title: char.title,
            classId: char.classId,
            className: '', // TODO: map from constants
            level: char.level,
            race: char.raceId.toString(),
            sex: char.sex.toString(),
            hp: { current: char.hp.current, max: char.hp.max },
            mp: { current: char.mp.current, max: char.mp.max },
            cp: { current: char.cp.current, max: char.cp.max },
            exp: char.experience.exp,
            expPercent: char.experience.levelProgressPercent,
            sp: char.experience.sp,
            karma: 0,
            pvpKills: 0,
            pkKills: 0,
            position: {
                x: char.position.x,
                y: char.position.y,
                z: char.position.z,
                heading: char.position.heading,
            },
            stats: char.baseStats.toJSON() as unknown as Record<string, number>,
            buffs: [],
            skills: [...char.skills] as unknown[],
            targetObjectId: char.targetId,
        };
    }

    updateCharacter(data: Partial<LegacyCharacterState>): void {
        const existing = this.characterRepo.get();
        
        if (existing) {
            // Обновляем существующего
            this.characterRepo.update((char) => {
                if (data.hp) char.updateHp(data.hp.current, data.hp.max);
                if (data.mp) char.updateMp(data.mp.current, data.mp.max);
                if (data.cp) char.updateCp(data.cp.current, data.cp.max);
                if (data.position) {
                    char.updatePosition(
                        Position.at(data.position.x, data.position.y, data.position.z, data.position.heading),
                        0,
                        true
                    );
                }
                if (data.targetObjectId !== undefined) {
                    char.setTarget(data.targetObjectId);
                }
                return char;
            });
        } else {
            // Создаем нового персонажа
            if (data.objectId && data.name) {
                const character = Character.create({
                    objectId: data.objectId,
                    name: data.name,
                    title: data.title || '',
                    level: data.level || 1,
                    exp: data.exp || 0,
                    sp: data.sp || 0,
                    classId: data.classId || 0,
                    raceId: parseInt(data.race || '0'),
                    sex: parseInt(data.sex || '0'),
                    position: data.position 
                        ? Position.at(data.position.x, data.position.y, data.position.z)
                        : Position.zero(),
                    hp: Vitals.create({ current: data.hp?.current || 0, max: data.hp?.max || 1 }).getOrElse(Vitals.zero()),
                    mp: Vitals.create({ current: data.mp?.current || 0, max: data.mp?.max || 1 }).getOrElse(Vitals.zero()),
                    cp: Vitals.create({ current: data.cp?.current || 0, max: data.cp?.max || 1 }).getOrElse(Vitals.zero()),
                    baseStats: BaseStats.default(),
                    combatStats: CombatStats.create({}),
                    skills: (data.skills || []) as import('../../domain/events').SkillInfo[],
                    isInCombat: false,
                });

                this.characterRepo.save(character);

                // Эмитим событие
                this.eventBus.publish(new CharacterEnteredGameEvent({
                    objectId: data.objectId,
                    name: data.name,
                    level: data.level || 1,
                    classId: data.classId || 0,
                    raceId: parseInt(data.race || '0'),
                    sex: parseInt(data.sex || '0'),
                    position: character.position,
                }));
            }
        }
    }

    updatePosition(position: LegacyPosition): void {
        this.characterRepo.update((char) => {
            char.updatePosition(
                Position.at(position.x, position.y, position.z, position.heading),
                0,
                true
            );
            return char;
        });
    }

    // ============================================================================
    // World/NPC API (Legacy)
    // ============================================================================

    getWorld(): { npcs: Map<number, LegacyNpcInfo>; players: Map<number, unknown>; items: Map<number, unknown> } {
        const npcs = new Map<number, LegacyNpcInfo>();
        
        for (const npc of this.worldRepo.getAllNpcs()) {
            npcs.set(npc.id, {
                objectId: npc.id,
                npcId: npc.npcId,
                name: npc.name,
                level: npc.level,
                hp: { current: npc.hp.current, max: npc.hp.max },
                isAttackable: npc.isAttackable,
                isAggressive: npc.isAggressive,
                position: {
                    x: npc.position.x,
                    y: npc.position.y,
                    z: npc.position.z,
                },
            });
        }

        return {
            npcs,
            players: new Map(),
            items: new Map(),
        };
    }

    addNpc(npc: LegacyNpcInfo): void {
        // Конвертируем в доменную сущность
        const position = Position.at(npc.position.x, npc.position.y, npc.position.z);
        const vitals = Vitals.create({ current: npc.hp.current, max: npc.hp.max }).getOrElse(Vitals.zero());
        
        const { Npc } = require('../../domain/entities');
        const { npc: domainNpc, event } = Npc.spawn({
            objectId: npc.objectId,
            npcId: npc.npcId,
            name: npc.name,
            level: npc.level,
            position,
            hp: vitals,
            isAttackable: npc.isAttackable,
            isAggressive: npc.isAggressive,
        });

        this.worldRepo.saveNpc(domainNpc);
        this.eventBus.publish(event);
    }

    removeNpc(objectId: number): void {
        const npc = this.worldRepo.getNpc(objectId);
        if (npc) {
            npc.markAsDespawned();
            this.worldRepo.removeNpc(objectId);
        }
    }

    getNearbyNpcs(radius: number = 600, options?: { attackable?: boolean; alive?: boolean }): Array<LegacyNpcInfo & { distance: number }> {
        const char = this.characterRepo.get();
        if (!char) return [];

        return this.worldRepo.getNearbyNpcs(char.position, radius, options).map((npc) => ({
            objectId: npc.id,
            npcId: npc.npcId,
            name: npc.name,
            level: npc.level,
            hp: { current: npc.hp.current, max: npc.hp.max },
            isAttackable: npc.isAttackable,
            isAggressive: npc.isAggressive,
            position: {
                x: npc.position.x,
                y: npc.position.y,
                z: npc.position.z,
            },
            distance: npc.distance,
        }));
    }

    // ============================================================================
    // Inventory API (Legacy)
    // ============================================================================

    getInventory(): LegacyInventoryState {
        const state = this.inventoryRepo.getState();
        return {
            adena: state.adena,
            weight: state.weight,
            items: state.items.map((item) => ({
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                type: item.type,
                equipped: item.equipped,
                slot: item.slot,
                enchant: item.enchant,
                mana: 0,
                grade: item.grade,
            })),
        };
    }

    updateInventory(data: Partial<LegacyInventoryState>): void {
        if (data.adena !== undefined) {
            this.inventoryRepo.updateAdena(data.adena);
        }
        if (data.items) {
            // TODO: конвертировать LegacyInventoryItem в InventoryItem
        }
    }

    addOrUpdateInventoryItem(_item: LegacyInventoryItem): void {
        // TODO: конвертация
    }

    removeInventoryItem(objectId: number): LegacyInventoryItem | null {
        const result = this.inventoryRepo.removeItem(objectId);
        if (result.isOk()) {
            const item = result.getOrThrow();
            return {
                objectId: item.id,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                type: item.type,
                equipped: item.equipped,
                slot: item.slot,
                enchant: item.enchant,
                mana: 0,
                grade: item.grade,
            };
        }
        return null;
    }

    clearInventory(): void {
        this.inventoryRepo.clear();
    }

    // ============================================================================
    // Reset API
    // ============================================================================

    reset(): void {
        this.characterRepo.reset();
        this.worldRepo.reset();
        this.inventoryRepo.reset();
    }

    // ============================================================================
    // Event Forwarding (синхронизация с legacy EventBus)
    // ============================================================================

    private setupEventForwarding(): void {
        // Перенаправляем события из новой системы в старую (через глобальную подписку)
        this.eventBus.subscribeAll((_event) => {
            // Здесь можно интегрироваться с legacy EventBus
            // Например: legacyEventBus.emit(event.type, event.payload);
        });
    }
}
