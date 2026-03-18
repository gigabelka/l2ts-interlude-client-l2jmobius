/**
 * @fileoverview CharInfo (0x03) - Информация о других игроках
 * Обновляет состояние мира при появлении других персонажей
 * @module packets/incoming/game/CharInfoPacket
 */

import { IncomingPacket, PacketHandler } from '../base/IncomingPacket';
import { PacketReader } from '../../../network/PacketReader';
import { GameState } from '../../../game/GameState';
import { worldManager, characterManager } from '../../../core/state';
import { Logger } from '../../../logger/Logger';
import type { Position } from '../../../core/GameStateStore';

/**
 * Данные о экипировке персонажа
 */
interface ICharEquipment {
    underId: number;
    headId: number;
    rHandId: number;
    lHandId: number;
    glovesId: number;
    chestId: number;
    legsId: number;
    feetId: number;
    backId: number;
    lrHandId: number;
    hairId: number;
}

/**
 * Полные данные из пакета CharInfo
 */
export interface ICharInfoData {
    objectId: number;
    name: string;
    race: number;
    sex: number;
    classId: number;
    level: number;
    position: Position;
    heading: number;
    hp: number;
    mp: number;
    cp: number;
    isRunning: boolean;
    isInCombat: boolean;
    isDead: boolean;
    title: string;
    clanId?: number;
}

/**
 * CharInfo Packet (0x03)
 * 
 * Структура пакета (Interlude protocol 746):
 * - x, y, z (int32 each)
 * - heading (int32)
 * - objectId (int32)
 * - name (UTF-16LE string)
 * - race (int32)
 * - sex (int32)
 * - classId (int32)
 * - paperdoll items (varies)
 * - PvP flag (int32)
 * - Karma (int32)
 * - MAtkSpd/ASpd (int32 each)
 * - runSpeed/walkSpeed (float each)
 * - isRunning (byte)
 * - isInCombat (byte)
 * - isDead (byte)
 * - invisible (byte)
 * - mountType (byte)
 * - privateStoreType (byte)
 * - title (UTF-16LE string)
 */
@PacketHandler(0x03, GameState.IN_GAME, GameState.WAIT_USER_INFO)
export class CharInfoPacket extends IncomingPacket implements ICharInfoData {
    // Основные данные
    public objectId: number = 0;
    public name: string = '';
    public race: number = 0;
    public sex: number = 0;
    public classId: number = 0;
    public level: number = 0;

    // Позиция
    public position: Position = { x: 0, y: 0, z: 0 };
    public heading: number = 0;

    // Состояние
    public hp: number = 0;
    public mp: number = 0;
    public cp: number = 0;
    public isRunning: boolean = true;
    public isInCombat: boolean = false;
    public isDead: boolean = false;

    // Дополнительно
    public title: string = '';
    public clanId?: number;

    // Экипировка (для отображения)
    public equipment: Partial<ICharEquipment> = {};

    decode(reader: PacketReader, state?: GameState): this {
        try {
            // Сохраняем raw данные для дебага
            this.captureRawData(reader);

            // Читаем позицию
            this.position.x = reader.readInt32LE();
            this.position.y = reader.readInt32LE();
            this.position.z = reader.readInt32LE();
            this.heading = reader.readInt32LE();

            // Object ID
            this.objectId = reader.readInt32LE();

            // Имя персонажа (UTF-16LE)
            this.name = reader.readStringUTF16();

            // Базовые характеристики
            this.race = reader.readInt32LE();
            this.sex = reader.readInt32LE();
            this.classId = reader.readInt32LE();

            // Экипировка (paperdoll) - 18 слотов * 4 байта
            // Пропускаем для упрощения, но можно распарсить если нужно
            reader.skip(18 * 4);

            // PvP флаг и карма
            const pvpFlag = reader.readInt32LE();
            const karma = reader.readInt32LE();

            // Скорости атаки
            const mAtkSpd = reader.readInt32LE();
            const pAtkSpd = reader.readInt32LE();

            // Скорости движения (float)
            const runSpeed = reader.readFloatLE();
            const walkSpeed = reader.readFloatLE();

            // Флаги состояния
            this.isRunning = reader.readUInt8() !== 0;
            this.isInCombat = reader.readUInt8() !== 0;
            this.isDead = reader.readUInt8() !== 0;
            
            // Invisible, mount type, store type
            reader.skip(3);

            // Остаток пакета можно пропустить если не нужен
            // Титул находится ближе к концу пакета

            Logger.debug('CharInfoPacket', 
                `Player: ${this.name} (ID=${this.objectId}, Class=${this.classId}, ` +
                `Pos=${this.position.x},${this.position.y},${this.position.z})`
            );

            // Обновляем состояние
            this.updateState(state);

        } catch (error) {
            Logger.error('CharInfoPacket', `Decode error: ${error}`);
            // Даже при ошибке парсинга пытаемся обновить то, что распарсили
            this.updateState(state);
        }

        return this;
    }

    /**
     * Обновить состояние игры на основе распарсенных данных
     */
    private updateState(state?: GameState): void {
        // Проверяем, является ли это наш персонаж
        const myId = characterManager.getPlayerId();
        
        if (myId === this.objectId) {
            // Это наш персонаж - обновляем CharacterManager
            characterManager.updateCharacter({
                position: this.position,
                classId: this.classId,
                race: this.getRaceName(this.race),
                sex: this.sex === 0 ? 'Male' : 'Female'
            });
        } else {
            // Это другой игрок - добавляем в мир
            worldManager.addPlayer({
                id: this.objectId,
                name: this.name,
                level: this.level || 1, // Уровень может быть не распарсен
                classId: this.classId,
                hp: { current: this.isDead ? 0 : this.hp || 100, max: 100 },
                position: this.position,
                updatedAt: Date.now()
            });
        }
    }

    /**
     * Получить название расы
     */
    private getRaceName(raceId: number): string {
        const races: Record<number, string> = {
            0: 'Human',
            1: 'Elf',
            2: 'Dark Elf',
            3: 'Orc',
            4: 'Dwarf',
            5: 'Kamael'
        };
        return races[raceId] || `Race ${raceId}`;
    }

    /**
     * Получить название класса
     */
    getClassName(): string {
        const classes: Record<number, string> = {
            0: 'Fighter',
            1: 'Warrior',
            2: 'Gladiator',
            3: 'Warlord',
            4: 'Knight',
            5: 'Paladin',
            6: 'Dark Avenger',
            7: 'Rogue',
            8: 'Treasure Hunter',
            9: 'Hawkeye',
            10: 'Mage',
            11: 'Wizard',
            12: 'Sorcerer',
            13: 'Necromancer',
            14: 'Warlock',
            15: 'Cleric',
            16: 'Bishop',
            17: 'Prophet',
            // Elf classes
            18: 'Elven Fighter',
            19: 'Elven Knight',
            20: 'Temple Knight',
            21: 'Swordsinger',
            22: 'Elven Scout',
            23: 'Plains Walker',
            24: 'Silver Ranger',
            25: 'Elven Mage',
            26: 'Elven Wizard',
            27: 'Spellsinger',
            28: 'Elemental Summoner',
            29: 'Oracle',
            30: 'Elder',
            // etc...
        };
        return classes[this.classId] || `Class ${this.classId}`;
    }

    /**
     * Проверить, враждебный ли игрок
     */
    isEnemy(): boolean {
        // Логика определения врага (по карме, PvP флагу и т.д.)
        return false; // TODO: Implement
    }

    /**
     * Получить расстояние до указанной позиции
     */
    getDistanceTo(pos: Position): number {
        const dx = this.position.x - pos.x;
        const dy = this.position.y - pos.y;
        const dz = this.position.z - pos.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
