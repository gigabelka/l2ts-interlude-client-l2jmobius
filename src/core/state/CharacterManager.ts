/**
 * @fileoverview Управление состоянием персонажа игрока
 * @module core/state/CharacterManager
 */

import { StateManager, type UpdateResult, type IStateEntity } from './StateManager';
import { EventBus } from '../EventBus';
import type { Position, HpMpCp, CharacterStats, SkillInfo, Buff } from '../GameStateStore';

/**
 * Интерфейс состояния персонажа
 */
export interface ICharacterState extends IStateEntity {
    id: number; // objectId
    name: string;
    title: string;
    classId: number;
    className: string;
    level: number;
    race: string;
    sex: string;
    hp: HpMpCp;
    mp: HpMpCp;
    cp: HpMpCp;
    exp: number;
    expPercent: number;
    sp: number;
    karma: number;
    pvpKills: number;
    pkKills: number;
    position: Position;
    stats: Partial<CharacterStats>;
    buffs: Buff[];
    skills: SkillInfo[];
    targetObjectId?: number;
}

/**
 * Начальное состояние персонажа
 */
const defaultCharacterState: Partial<ICharacterState> = {
    title: '',
    className: '',
    level: 1,
    race: 'Human',
    sex: 'Male',
    hp: { current: 0, max: 0 },
    mp: { current: 0, max: 0 },
    cp: { current: 0, max: 0 },
    exp: 0,
    expPercent: 0,
    sp: 0,
    karma: 0,
    pvpKills: 0,
    pkKills: 0,
    stats: {},
    buffs: [],
    skills: []
};

/**
 * Менеджер состояния персонажа (Singleton)
 */
export class CharacterManager extends StateManager<ICharacterState> {
    private static instance: CharacterManager;
    private playerId: number | null = null;

    private constructor() {
        super({
            name: 'CharacterManager',
            eventChannel: 'character',
            eventType: 'character.updated',
            historyDepth: 20
        });
    }

    static getInstance(): CharacterManager {
        if (!CharacterManager.instance) {
            CharacterManager.instance = new CharacterManager();
        }
        return CharacterManager.instance;
    }

    /**
     * Инициализировать персонажа (при входе в игру)
     */
    initialize(objectId: number, name: string): void {
        this.playerId = objectId;
        this.set(objectId, {
            ...defaultCharacterState,
            id: objectId,
            name
        } as ICharacterState);

        EventBus.emitEvent({
            type: 'character.initialized',
            channel: 'character',
            data: { objectId, name },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Получить текущего персонажа
     */
    getCharacter(): ICharacterState | undefined {
        return this.playerId ? this.get(this.playerId) : undefined;
    }

    /**
     * Обновить основные данные персонажа
     */
    updateCharacter(data: Partial<ICharacterState>): UpdateResult<ICharacterState> {
        if (!this.playerId) {
            throw new Error('Character not initialized');
        }

        const previous = this.getCharacter();
        const result = this.set(this.playerId, data);

        // Эмитим специфические события при изменении статов
        if (result.changed && previous) {
            this.emitSpecificEvents(previous, result.current);
        }

        return result;
    }

    /**
     * Обновить позицию персонажа
     */
    updatePosition(position: Position): void {
        this.updateCharacter({ position });

        EventBus.emitEvent({
            type: 'movement.position_changed',
            channel: 'movement',
            data: {
                objectId: this.playerId,
                position,
                speed: this.getCharacter()?.stats?.speed ?? 0,
                isRunning: true
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Обновить HP/MP/CP
     */
    updateVitals(hp?: HpMpCp, mp?: HpMpCp, cp?: HpMpCp): void {
        const updates: Partial<ICharacterState> = {};
        const previous = this.getCharacter();

        if (hp) updates.hp = hp;
        if (mp) updates.mp = mp;
        if (cp) updates.cp = cp;

        this.updateCharacter(updates);

        // Эмитим событие изменения статов
        if (previous) {
            const eventData: Record<string, unknown> = {};

            if (hp) {
                eventData.hp = {
                    ...hp,
                    delta: hp.current - (previous.hp?.current ?? 0)
                };
            }
            if (mp) {
                eventData.mp = {
                    ...mp,
                    delta: mp.current - (previous.mp?.current ?? 0)
                };
            }
            if (cp) {
                eventData.cp = {
                    ...cp,
                    delta: cp.current - (previous.cp?.current ?? 0)
                };
            }

            EventBus.emitEvent({
                type: 'character.stats_changed',
                channel: 'character',
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Установить цель (таргет)
     */
    setTarget(objectId?: number, name?: string): void {
        this.updateCharacter({ targetObjectId: objectId });

        EventBus.emitEvent({
            type: 'character.target_changed',
            channel: 'character',
            data: { objectId, name },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Очистить цель
     */
    clearTarget(): void {
        this.setTarget(undefined, undefined);
    }

    /**
     * Обновить список скиллов
     */
    updateSkills(skills: SkillInfo[]): void {
        this.updateCharacter({ skills });

        EventBus.emitEvent({
            type: 'character.skills_updated',
            channel: 'character',
            data: {
                skills,
                totalCount: skills.length,
                activeCount: skills.filter(s => !s.isPassive).length,
                passiveCount: skills.filter(s => s.isPassive).length
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Добавить бафф
     */
    addBuff(buff: Buff): void {
        const character = this.getCharacter();
        if (!character) return;

        const buffs = [...character.buffs.filter(b => b.skillId !== buff.skillId), buff];
        this.updateCharacter({ buffs });

        EventBus.emitEvent({
            type: 'character.buff_added',
            channel: 'character',
            data: buff as unknown as Record<string, unknown>,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Удалить бафф
     */
    removeBuff(skillId: number): void {
        const character = this.getCharacter();
        if (!character) return;

        const buff = character.buffs.find(b => b.skillId === skillId);
        if (!buff) return;

        const buffs = character.buffs.filter(b => b.skillId !== skillId);
        this.updateCharacter({ buffs });

        EventBus.emitEvent({
            type: 'character.buff_removed',
            channel: 'character',
            data: { skillId, name: buff.name },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Сбросить состояние (при дисконнекте)
     */
    reset(): void {
        this.clear();
        this.playerId = null;
    }

    /**
     * Получить ID текущего персонажа
     */
    getPlayerId(): number | null {
        return this.playerId;
    }

    /**
     * Проверить, инициализирован ли персонаж
     */
    isInitialized(): boolean {
        return this.playerId !== null;
    }

    /**
     * Эмитим специфические события на основе изменений
     */
    private emitSpecificEvents(previous: ICharacterState, current: ICharacterState): void {
        // Level up
        if (current.level > previous.level) {
            EventBus.emitEvent({
                type: 'character.level_up',
                channel: 'character',
                data: {
                    newLevel: current.level,
                    oldLevel: previous.level,
                    sp: current.sp
                },
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Экспорт синглтона
export const characterManager = CharacterManager.getInstance();
