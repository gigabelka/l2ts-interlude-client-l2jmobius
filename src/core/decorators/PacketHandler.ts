/**
 * @fileoverview Декораторы для автоматической регистрации обработчиков пакетов
 * @module core/decorators/PacketHandler
 */

import 'reflect-metadata';
import type { PacketReader } from '../../network/PacketReader';
import type { GameState } from '../../game/GameState';

// Реестр обработчиков пакетов
export type PacketHandlerFn = (reader: PacketReader, state?: GameState) => void;

interface PacketMetadata {
    opcode: number;
    stateFilter?: GameState[];
    priority?: number;
}

const packetRegistry = new Map<number, Array<{ metadata: PacketMetadata; handler: new () => unknown }>>();

/**
 * Декоратор @Packet - регистрирует класс как обработчик пакета
 * @param opcode - опкод пакета
 * @param stateFilter - фильтр состояний (опционально)
 * @param priority - приоритет обработки (выше = раньше)
 */
export function Packet(opcode: number, stateFilter?: GameState[], priority = 0) {
    return function <T extends { new (...args: any[]): any }>(target: T): T {
        const metadata: PacketMetadata = { opcode, stateFilter, priority };
        
        if (!packetRegistry.has(opcode)) {
            packetRegistry.set(opcode, []);
        }
        
        const handlers = packetRegistry.get(opcode)!;
        handlers.push({ metadata, handler: target as new () => unknown });
        
        // Сортируем по приоритету
        handlers.sort((a, b) => (b.metadata.priority ?? 0) - (a.metadata.priority ?? 0));
        
        // Сохраняем метаданные на классе
        Reflect.defineMetadata('packet:metadata', metadata, target);
        
        return target;
    };
}

/**
 * Декоратор @InjectState - инжектирует текущее состояние в метод decode
 */
export function InjectState(): ParameterDecorator {
    return function (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number): void {
        if (propertyKey) {
            Reflect.defineMetadata('packet:injectState', parameterIndex, target, propertyKey);
        }
    };
}

/**
 * Получить реестр всех пакетов
 */
export function getPacketRegistry(): Map<number, Array<{ metadata: PacketMetadata; handler: new () => unknown }>> {
    return new Map(packetRegistry);
}

/**
 * Очистить реестр (для тестов)
 */
export function clearPacketRegistry(): void {
    packetRegistry.clear();
}

/**
 * Интерфейс для входящих пакетов
 */
export interface IIncomingPacket {
    decode(reader: PacketReader, state?: GameState): this;
}

/**
 * Базовый класс для входящих пакетов
 */
export abstract class IncomingPacket implements IIncomingPacket {
    protected timestamp: number = Date.now();
    protected rawData?: Buffer;

    abstract decode(reader: PacketReader, state?: GameState): this;

    /**
     * Получить raw данные пакета (для дебага)
     */
    getRawData(): Buffer | undefined {
        return this.rawData;
    }

    /**
     * Получить время получения пакета
     */
    getTimestamp(): number {
        return this.timestamp;
    }
}

/**
 * Контекст обработки пакета
 */
export interface PacketContext {
    opcode: number;
    state: GameState;
    timestamp: number;
    rawBody: Buffer;
}
