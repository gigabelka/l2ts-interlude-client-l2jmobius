/**
 * @fileoverview Диспетчер пакетов с автоматической регистрацией обработчиков
 * Заменяет гигантский switch-case на декларативную систему
 * @module network/protocol/PacketDispatcher
 */

import { PacketReader } from '../PacketReader';
import { Logger } from '../../logger/Logger';
import { GameState } from '../../game/GameState';
import { EventBus } from '../../core/EventBus';
import { GameStateStore } from '../../core/GameStateStore';
import type { IIncomingPacket, PacketContext } from '../../core/decorators/PacketHandler';

// Опкоды пакетов
export const enum GameOpcode {
    CRYPT_INIT_1 = 0x00,
    CRYPT_INIT_2 = 0x2D,
    CHAR_INFO = 0x03,
    USER_INFO = 0x04,
    ATTACK = 0x05,
    CHAR_SELECTED = 0x15,
    SPAWN_ITEM = 0x0B,
    DROP_ITEM = 0x0C,
    GET_ITEM = 0x0D,
    STATUS_UPDATE = 0x0E,
    NPC_INFO = 0x16,
    CHAR_SELECT_INFO_1 = 0x04,
    CHAR_SELECT_INFO_2 = 0x13,
    CHAR_SELECT_INFO_3 = 0x2C,
    MOVE_TO_LOCATION = 0x2E,
    CREATURE_SAY = 0x4A,
    MAGIC_SKILL_USE = 0x48,
    SKILL_LIST = 0x58,
    NPC_DELETE = 0x0C,
    PARTY_SMALL_WINDOW_ALL = 0x4E,
    PARTY_SMALL_WINDOW_ADD = 0x4F,
    PARTY_SMALL_WINDOW_DELETE = 0x50,
    NET_PING = 0xD3,
    ITEM_LIST = 0x1B,
}

/**
 * Интерфейс обработчика пакета
 */
export interface IPacketHandler<T extends IIncomingPacket = IIncomingPacket> {
    new (): T;
}

/**
 * Результат обработки пакета
 */
export interface PacketResult<T = unknown> {
    success: boolean;
    packet?: T;
    error?: string;
    context: PacketContext;
}

/**
 * Правило маршрутизации пакета
 */
interface RoutingRule {
    opcode: number;
    handler: IPacketHandler;
    condition?: (state: GameState, context: PacketContext) => boolean;
    priority: number;
}

/**
 * Диспетчер пакетов с автоматической регистрацией
 */
export class PacketDispatcher {
    private static instance: PacketDispatcher;
    private handlers = new Map<number, RoutingRule[]>();
    private globalMiddleware: Array<(context: PacketContext, next: () => void) => void> = [];

    static getInstance(): PacketDispatcher {
        if (!PacketDispatcher.instance) {
            PacketDispatcher.instance = new PacketDispatcher();
        }
        return PacketDispatcher.instance;
    }

    /**
     * Регистрация обработчика пакета
     */
    register(opcode: number, handler: IPacketHandler, options?: {
        condition?: (state: GameState, context: PacketContext) => boolean;
        priority?: number;
    }): this {
        const rules = this.handlers.get(opcode) ?? [];
        rules.push({
            opcode,
            handler,
            condition: options?.condition,
            priority: options?.priority ?? 0
        });
        
        // Сортируем по приоритету
        rules.sort((a, b) => b.priority - a.priority);
        this.handlers.set(opcode, rules);
        
        Logger.debug('PacketDispatcher', `Registered handler for opcode 0x${opcode.toString(16).padStart(2, '0')}: ${handler.name}`);
        return this;
    }

    /**
     * Регистрация глобального middleware
     */
    use(middleware: (context: PacketContext, next: () => void) => void): this {
        this.globalMiddleware.push(middleware);
        return this;
    }

    /**
     * Обработка входящего пакета
     */
    dispatch(opcode: number, body: Buffer, state: GameState): PacketResult | null {
        const context: PacketContext = {
            opcode,
            state,
            timestamp: Date.now(),
            rawBody: body
        };

        // Выполняем middleware
        let middlewareIndex = 0;
        const executeMiddleware = (): void => {
            if (middlewareIndex < this.globalMiddleware.length) {
                const mw = this.globalMiddleware[middlewareIndex++];
                mw(context, executeMiddleware);
            }
        };
        executeMiddleware();

        // Ищем подходящий обработчик
        const rules = this.handlers.get(opcode);
        if (!rules || rules.length === 0) {
            Logger.debug('PacketDispatcher', `No handler for opcode 0x${opcode.toString(16).padStart(2, '0')}`);
            return null;
        }

        // Находим первый подходящий по условию
        const rule = rules.find(r => !r.condition || r.condition(state, context));
        if (!rule) {
            Logger.debug('PacketDispatcher', `No matching condition for opcode 0x${opcode.toString(16).padStart(2, '0')} in state ${state}`);
            return null;
        }

        try {
            const reader = new PacketReader(body);
            const packet = new rule.handler();
            packet.decode(reader, state);

            // Эмитим событие о получении пакета
            EventBus.emitEvent({
                type: 'system.raw_packet',
                channel: 'system',
                data: {
                    opcode,
                    opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
                    length: body.length,
                    state,
                    handlerName: rule.handler.name
                },
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                packet,
                context
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            Logger.error('PacketDispatcher', `Failed to decode opcode 0x${opcode.toString(16).padStart(2, '0')}: ${errorMsg}`);
            
            return {
                success: false,
                error: errorMsg,
                context
            };
        }
    }

    /**
     * Пакетная регистрация из модуля
     */
    registerFromModule(module: Record<string, unknown>): this {
        Object.values(module).forEach((value) => {
            if (typeof value === 'function' && 'prototype' in value) {
                const opcode = Reflect.getMetadata('packet:opcode', value);
                if (typeof opcode === 'number') {
                    const stateFilter = Reflect.getMetadata('packet:stateFilter', value);
                    const condition = stateFilter 
                        ? (state: GameState) => stateFilter.includes(state)
                        : undefined;
                    this.register(opcode, value as IPacketHandler, { condition });
                }
            }
        });
        return this;
    }

    /**
     * Получить список зарегистрированных опкодов
     */
    getRegisteredOpcodes(): number[] {
        return Array.from(this.handlers.keys());
    }

    /**
     * Очистка всех регистраций
     */
    clear(): void {
        this.handlers.clear();
        this.globalMiddleware = [];
    }
}

// Экспорт синглтона
export const packetDispatcher = PacketDispatcher.getInstance();
