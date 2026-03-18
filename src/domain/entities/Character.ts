/**
 * @fileoverview Character - корневая сущность персонажа игрока
 * @module domain/entities
 */

import { ObjectId, Position, Vitals, Experience, BaseStats, CombatStats } from '../value-objects';
import {
    CharacterStatsChangedEvent,
    CharacterPositionChangedEvent,
    CharacterTargetChangedEvent,
    CharacterLevelUpEvent,
    type SkillInfo,
} from '../events';
import type { DomainEvent } from '../events';

export interface CharacterData {
    objectId: number;
    name: string;
    title: string;
    level: number;
    exp: number;
    sp: number;
    classId: number;
    raceId: number;
    sex: number;
    position: Position;
    hp: Vitals;
    mp: Vitals;
    cp: Vitals;
    baseStats: BaseStats;
    combatStats: CombatStats;
    skills: SkillInfo[];
    targetId?: number;
    isInCombat: boolean;
}

import type { PositionData } from '../value-objects/Position';
import type { VitalsData } from '../value-objects/Vitals';
import type { CharacterStatsData, CombatStatsData } from '../value-objects/Stats';

export interface CharacterJSON {
    objectId: number;
    name: string;
    title: string;
    level: number;
    exp: number;
    sp: number;
    classId: number;
    raceId: number;
    sex: number;
    position: PositionData;
    hp: VitalsData;
    mp: VitalsData;
    cp: VitalsData;
    baseStats: CharacterStatsData;
    combatStats: CombatStatsData;
    skills: SkillInfo[];
    targetId?: number;
    isInCombat: boolean;
}

/**
 * Корневая сущность персонажа игрока
 * Инкапсулирует бизнес-логику персонажа
 */
export class Character {
    private uncommittedEvents: DomainEvent[] = [];

    constructor(
        readonly objectId: ObjectId,
        private data: CharacterData
    ) {}

    // ============================================================================
    // Getters (read-only доступ)
    // ============================================================================

    get id(): number {
        return this.objectId.value;
    }

    get name(): string {
        return this.data.name;
    }

    get title(): string {
        return this.data.title;
    }

    get level(): number {
        return this.data.level;
    }

    get experience(): Experience {
        return Experience.create(this.data.level, this.data.exp, this.data.sp);
    }

    get classId(): number {
        return this.data.classId;
    }

    get raceId(): number {
        return this.data.raceId;
    }

    get sex(): number {
        return this.data.sex;
    }

    get position(): Position {
        return this.data.position;
    }

    get hp(): Vitals {
        return this.data.hp;
    }

    get mp(): Vitals {
        return this.data.mp;
    }

    get cp(): Vitals {
        return this.data.cp;
    }

    get baseStats(): BaseStats {
        return this.data.baseStats;
    }

    get combatStats(): CombatStats {
        return this.data.combatStats;
    }

    get skills(): readonly SkillInfo[] {
        return Object.freeze([...this.data.skills]);
    }

    get targetId(): number | undefined {
        return this.data.targetId;
    }

    get isInCombat(): boolean {
        return this.data.isInCombat;
    }

    // ============================================================================
    // Domain Operations
    // ============================================================================

    /**
     * Обновить позицию персонажа
     */
    updatePosition(newPosition: Position, speed: number = 0, isRunning: boolean = true): void {
        const previousPosition = this.data.position;
        this.data.position = newPosition;

        this.uncommittedEvents.push(
            new CharacterPositionChangedEvent(
                { previousPosition, newPosition, speed, isRunning },
                this.objectId
            )
        );
    }

    /**
     * Обновить HP
     */
    updateHp(current: number, max: number): void {
        const previousHp = this.data.hp.current;
        this.data.hp = new Vitals({ current, max });

        if (current !== previousHp) {
            this.uncommittedEvents.push(
                CharacterStatsChangedEvent.createHpChanged(current, max, previousHp, this.objectId)
            );
        }
    }

    /**
     * Обновить MP
     */
    updateMp(current: number, max: number): void {
        const previousMp = this.data.mp.current;
        this.data.mp = new Vitals({ current, max });

        if (current !== previousMp) {
            this.uncommittedEvents.push(
                CharacterStatsChangedEvent.createMpChanged(current, max, previousMp, this.objectId)
            );
        }
    }

    /**
     * Обновить CP
     */
    updateCp(current: number, max: number): void {
        const previousCp = this.data.cp.current;
        this.data.cp = new Vitals({ current, max });

        if (current !== previousCp) {
            this.uncommittedEvents.push(
                CharacterStatsChangedEvent.createCpChanged(current, max, previousCp, this.objectId)
            );
        }
    }

    /**
     * Установить цель
     */
    setTarget(targetId?: number, targetName?: string, targetType?: 'NPC' | 'PLAYER'): void {
        const previousTargetId = this.data.targetId;
        this.data.targetId = targetId;

        this.uncommittedEvents.push(
            new CharacterTargetChangedEvent(
                { previousTargetId, newTargetId: targetId, targetName, targetType },
                this.objectId
            )
        );
    }

    /**
     * Очистить цель
     */
    clearTarget(): void {
        if (this.data.targetId !== undefined) {
            this.setTarget(undefined);
        }
    }

    /**
     * Добавить опыт и повысить уровень если нужно
     */
    addExp(amount: number): void {
        const oldLevel = this.data.level;
        this.data.exp += amount;

        // Проверяем повышение уровня
        const expObj = Experience.create(this.data.level, this.data.exp, this.data.sp);
        if (expObj.canLevelUp) {
            const newLevel = expObj.level + 1;
            this.data.level = newLevel;
            this.uncommittedEvents.push(
                new CharacterLevelUpEvent(
                    { oldLevel, newLevel, exp: this.data.exp, sp: this.data.sp },
                    this.objectId
                )
            );
        }
    }

    /**
     * Добавить SP
     */
    addSp(amount: number): void {
        this.data.sp += amount;
    }

    /**
     * Обновить скиллы
     */
    updateSkills(skills: SkillInfo[]): void {
        this.data.skills = [...skills];
    }

    /**
     * Установить состояние боя
     */
    setInCombat(inCombat: boolean): void {
        this.data.isInCombat = inCombat;
    }

    /**
     * Обновить характеристики
     */
    updateStats(stats: Partial<CharacterData>): void {
        if (stats.baseStats) {
            this.data.baseStats = stats.baseStats;
        }
        if (stats.combatStats) {
            this.data.combatStats = stats.combatStats;
        }
    }

    /**
     * Установить уровень персонажа (внутренний метод для обновления из пакетов)
     */
    setLevel(newLevel: number): void {
        if (this.data.level !== newLevel) {
            const oldLevel = this.data.level;
            this.data.level = newLevel;
            this.uncommittedEvents.push(
                new CharacterLevelUpEvent(
                    { oldLevel, newLevel, exp: this.data.exp, sp: this.data.sp },
                    this.objectId
                )
            );
        }
    }

    // ============================================================================
    // Event Sourcing Helpers
    // ============================================================================

    /**
     * Получить незакоммиченные события
     */
    getUncommittedEvents(): DomainEvent[] {
        return [...this.uncommittedEvents];
    }

    /**
     * Очистить незакоммиченные события
     */
    clearUncommittedEvents(): void {
        this.uncommittedEvents = [];
    }

    // ============================================================================
    // Factory Methods
    // ============================================================================

    static create(data: CharacterData): Character {
        return new Character(ObjectId.of(data.objectId), data);
    }

    /**
     * Обновить персонажа из данных пакета
     */
    static fromPacketData(objectId: number, data: Partial<CharacterData>): Character {
        // Always create fresh class instances from plain objects
        const position = data.position ? Position.at(data.position.x, data.position.y, data.position.z, data.position.heading) : Position.zero();
        const hp = Vitals.create({ current: data.hp?.current ?? 0, max: data.hp?.max ?? 0 }).getOrElse(Vitals.zero());
        const mp = Vitals.create({ current: data.mp?.current ?? 0, max: data.mp?.max ?? 0 }).getOrElse(Vitals.zero());
        const cp = Vitals.create({ current: data.cp?.current ?? 0, max: data.cp?.max ?? 0 }).getOrElse(Vitals.zero());
        const baseStats = BaseStats.create(data.baseStats ?? {});
        const combatStats = CombatStats.create(data.combatStats ?? {});

        const fullData: CharacterData = {
            objectId,
            name: data.name ?? 'Unknown',
            title: data.title ?? '',
            level: data.level ?? 1,
            exp: data.exp ?? 0,
            sp: data.sp ?? 0,
            classId: data.classId ?? 0,
            raceId: data.raceId ?? 0,
            sex: data.sex ?? 0,
            position,
            hp,
            mp,
            cp,
            baseStats,
            combatStats,
            skills: data.skills ?? [],
            isInCombat: data.isInCombat ?? false,
            targetId: data.targetId,
        };
        return new Character(ObjectId.of(objectId), fullData);
    }

    toJSON(): CharacterJSON {
        return {
            objectId: this.data.objectId,
            name: this.data.name,
            title: this.data.title,
            level: this.data.level,
            exp: this.data.exp,
            sp: this.data.sp,
            classId: this.data.classId,
            raceId: this.data.raceId,
            sex: this.data.sex,
            position: this.data.position.toJSON(),
            hp: this.data.hp.toJSON(),
            mp: this.data.mp.toJSON(),
            cp: this.data.cp.toJSON(),
            baseStats: this.data.baseStats.toJSON(),
            combatStats: this.data.combatStats.toJSON(),
            skills: this.data.skills,
            targetId: this.data.targetId,
            isInCombat: this.data.isInCombat,
        };
    }

    /**
     * Клонировать персонажа с сохранением незакоммиченных событий
     */
    clone(): Character {
        const cloned = new Character(this.objectId, this.data);
        // Копируем события
        cloned.uncommittedEvents = [...this.uncommittedEvents];
        return cloned;
    }
}

// Импорт ObjectId нужен здесь чтобы избежать циклических зависимостей

