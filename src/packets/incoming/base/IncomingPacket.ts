/**
 * @fileoverview Базовый класс для входящих пакетов
 * @module packets/incoming/base/IncomingPacket
 */

import 'reflect-metadata';
import type { PacketReader } from '../../../network/PacketReader';
import type { GameState } from '../../../game/GameState';

/**
 * Контекст обработки пакета
 */
export interface PacketContext {
    /** Опкод пакета */
    opcode: number;
    /** Текущее состояние игры */
    state: GameState;
    /** Время получения */
    timestamp: number;
    /** Raw данные */
    rawBody: Buffer;
}

/**
 * Интерфейс для всех входящих пакетов
 */
export interface IIncomingPacket {
    /**
     * Декодировать пакет из буфера
     * @param reader - PacketReader для чтения данных
     * @param state - Текущее состояние игры (опционально)
     * @returns this для chaining
     */
    decode(reader: PacketReader, state?: GameState): this;
}

/**
 * Базовый класс для входящих пакетов
 */
export abstract class IncomingPacket implements IIncomingPacket {
    /** Время получения пакета */
    protected readonly receivedAt: number = Date.now();
    
    /** Raw данные пакета (для дебага) */
    protected rawData?: Buffer;

    /**
     * Декодировать пакет (реализуется в наследниках)
     */
    abstract decode(reader: PacketReader, state?: GameState): this;

    /**
     * Сохранить raw данные для дебага
     */
    protected captureRawData(reader: PacketReader): void {
        // Клонируем буфер для сохранения
        const buffer = (reader as unknown as { buffer: Buffer }).buffer;
        if (buffer) {
            this.rawData = Buffer.from(buffer);
        }
    }

    /**
     * Получить время получения пакета
     */
    getReceivedAt(): number {
        return this.receivedAt;
    }

    /**
     * Получить raw данные
     */
    getRawData(): Buffer | undefined {
        return this.rawData;
    }
}

/**
 * Декоратор для автоматической регистрации пакета
 */
export function PacketHandler(opcode: number, ...states: GameState[]) {
    return function <T extends { new (...args: any[]): any }>(target: T): T {
        Reflect.defineMetadata('packet:opcode', opcode, target);
        if (states.length > 0) {
            Reflect.defineMetadata('packet:states', states, target);
        }
        return target;
    };
}

/**
 * Миксин для пакетов, которые обновляют состояние персонажа
 */
export function WithCharacterUpdate<T extends new (...args: any[]) => any>(Base: T) {
    abstract class CharacterUpdateMixin extends Base {
        /**
         * Обновить данные персонажа через CharacterManager
         */
        protected updateCharacter(data: unknown): void {
            // Импорт выполняется лениво для избежания циклических зависимостей
            const { characterManager } = require('../../../core/state');
            characterManager.updateCharacter(data);
        }
    }
    return CharacterUpdateMixin;
}

/**
 * Миксин для пакетов, которые работают с миром
 */
export function WithWorldUpdate<T extends new (...args: any[]) => any>(Base: T) {
    abstract class WorldUpdateMixin extends Base {
        /**
         * Добавить NPC в мир
         */
        protected addNpc(npc: unknown): void {
            const { worldManager } = require('../../../core/state');
            worldManager.addNpc(npc);
        }

        /**
         * Удалить NPC из мира
         */
        protected removeNpc(objectId: number): void {
            const { worldManager } = require('../../../core/state');
            worldManager.removeNpc(objectId);
        }

        /**
         * Добавить игрока в мир
         */
        protected addPlayer(player: unknown): void {
            const { worldManager } = require('../../../core/state');
            worldManager.addPlayer(player);
        }
    }
    return WorldUpdateMixin;
}
