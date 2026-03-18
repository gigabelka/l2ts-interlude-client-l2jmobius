/**
 * @fileoverview GamePacketProcessor - процессор пакетов с паттерном Strategy
 * Координирует фабрику пакетов и стратегии обработки
 * @module infrastructure/protocol/game
 */


import type {
    IPacketProcessor,
    IPacketHandlerStrategy,
    PacketContext,
    PacketResult,
    IIncomingPacket,
} from '../../../application/ports';
import type { IEventBus } from '../../../application/ports';
import type { GameIncomingPacketFactory } from './GameIncomingPacketFactory';
import { PacketReader } from '../../../network/PacketReader';

/**
 * Middleware для обработки пакетов
 */
export type PacketMiddleware = (
    context: PacketContext,
    packet: IIncomingPacket | null,
    next: () => void
) => void;

/**
 * Процессор пакетов Game Server
 * Соединяет Factory и Strategy паттерны
 */
export class GamePacketProcessor implements IPacketProcessor {
    private handlers: IPacketHandlerStrategy[] = [];
    private middlewares: PacketMiddleware[] = [];

    constructor(
        private factory: GameIncomingPacketFactory,
        _eventBus: IEventBus
    ) {}

    /**
     * Регистрация стратегии обработки
     */
    registerHandler(handler: IPacketHandlerStrategy): void {
        this.handlers.push(handler);
    }

    /**
     * Регистрация middleware
     */
    use(middleware: PacketMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Обработать пакет
     */
    process(opcode: number, data: Buffer, state: string): PacketResult {
        const context: PacketContext = {
            opcode,
            state,
            timestamp: Date.now(),
            rawBody: data,
        };

        // Проверяем поддержку опкода
        if (!this.factory.supports(opcode)) {
            return {
                success: false,
                error: `Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')}`,
                context,
            };
        }

        // Создаем пакет через фабрику
        const createResult = this.factory.createFromBuffer(opcode, data);
        if (createResult.isErr()) {
            return {
                success: false,
                error: createResult.error?.message || 'Unknown error',
                context,
            };
        }

        const packet = createResult.getOrThrow();

        // Выполняем middleware chain
        let middlewareIndex = 0;
        const executeMiddleware = (): void => {
            if (middlewareIndex < this.middlewares.length) {
                const mw = this.middlewares[middlewareIndex++];
                if (mw) {
                    mw(context, packet, executeMiddleware);
                }
            } else {
                // После всех middleware выполняем обработчики
                this.executeHandlers(context, packet);
            }
        };

        executeMiddleware();

        return {
            success: true,
            packet,
            context,
        };
    }

    /**
     * Выполнить стратегии обработки
     */
    private executeHandlers(context: PacketContext, _packet: IIncomingPacket): void {
        const { opcode, state } = context;

        // Находим подходящий обработчик
        for (const handler of this.handlers) {
            if (handler.canHandle(opcode, state)) {
                try {
                    // Создаем реальный PacketReader для чтения данных
                    // Пропускаем 1 байт (код операции), так как он уже известен
                    const reader = new PacketReader(context.rawBody, 1);
                    handler.handle(context, reader);
                } catch (error) {
                    console.error(`Error in packet handler for opcode ${opcode}:`, error);
                }
                return; // Первый подходящий обработчик
            }
        }

        // Если нет подходящего обработчика - игнорируем или логируем
        // Это нормально - не все пакеты требуют обработки
    }

    /**
     * Получить статистику
     */
    getStats(): {
        handlers: number;
        middlewares: number;
        supportedOpcodes: number[];
    } {
        return {
            handlers: this.handlers.length,
            middlewares: this.middlewares.length,
            supportedOpcodes: this.factory.getRegisteredOpcodes(),
        };
    }
}

/**
 * Базовая стратегия обработки пакета
 * Помогает создавать конкретные стратегии с type-safe подходом
 */
export abstract class BasePacketHandlerStrategy<T extends IIncomingPacket> implements IPacketHandlerStrategy {
    constructor(
        protected readonly opcode: number,
        protected readonly eventBus: IEventBus
    ) {}

    canHandle(opcode: number, state: string): boolean {
        return opcode === this.opcode && this.canHandleInState(state);
    }

    /**
     * Проверить можно ли обработать в данном состоянии
     */
    protected abstract canHandleInState(state: string): boolean;

    /**
     * Обработать пакет
     */
    abstract handle(context: PacketContext, reader: import('../../../application/ports').IPacketReader): void;

    /**
     * Получить декодированный пакет
     */
    protected decode(_reader: import('../../../application/ports').IPacketReader): T {
        // Переопределяется в наследниках
        throw new Error('Not implemented');
    }
}
