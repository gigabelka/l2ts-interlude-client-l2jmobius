/**
 * @fileoverview PacketBroadcastService - центральный сервис для проброса ВСЕХ пакетов в WebSocket
 * @module services/PacketBroadcastService
 *
 * Архитектурный принцип: каждый пакет от сервера СНАЧАЛА отправляется в WS,
 * ПОТОМ обрабатывается внутренней логикой.
 *
 * Features:
 * - Ring buffer на 1000 пакетов для отключенных клиентов
 * - Единый формат сообщений с direction полем
 * - Неблокирующая отправка с try/catch
 */

/**
 * Формат сообщения для WebSocket
 */
export interface WsPacketMessage {
    type: 'server_packet' | 'client_packet';
    direction: 'server_to_client' | 'client_to_server';
    opcode: number;
    opcodeHex: string;
    name: string;
    data: unknown;
    timestamp: number;
}

/**
 * Ring buffer для хранения пакетов с фиксированным размером
 */
class RingBuffer<T> {
    private buffer: T[];
    private index = 0;
    private isFull = false;

    constructor(private readonly capacity: number) {
        this.buffer = new Array<T>(capacity);
    }

    /**
     * Добавить элемент в буфер (перезаписывает старые при переполнении)
     */
    push(item: T): void {
        this.buffer[this.index] = item;
        this.index = (this.index + 1) % this.capacity;
        if (this.index === 0) {
            this.isFull = true;
        }
    }

    /**
     * Получить все элементы в порядке добавления
     */
    getAll(): T[] {
        if (!this.isFull) {
            return this.buffer.slice(0, this.index).filter((item): item is T => item !== undefined);
        }
        // Возвращаем в порядке от старого к новому
        const result: T[] = [];
        for (let i = 0; i < this.capacity; i++) {
            const idx = (this.index + i) % this.capacity;
            const item = this.buffer[idx];
            if (item !== undefined) {
                result.push(item);
            }
        }
        return result;
    }

    /**
     * Очистить буфер
     */
    clear(): void {
        this.buffer = new Array<T>(this.capacity);
        this.index = 0;
        this.isFull = false;
    }

    /**
     * Получить размер буфера
     */
    size(): number {
        return this.isFull ? this.capacity : this.index;
    }
}

/**
 * Callback для подписчиков на пакеты
 */
type PacketCallback = (packet: WsPacketMessage) => void;

/**
 * Сервис для широковещательной рассылки пакетов
 * Singleton pattern
 */
export class PacketBroadcastService {
    private static instance: PacketBroadcastService | null = null;
    private readonly ringBuffer: RingBuffer<WsPacketMessage>;
    private subscribers: PacketCallback[] = [];
    private packetCounter = 0;

    // Константы
    private readonly RING_BUFFER_SIZE = 1000;

    private constructor() {
        this.ringBuffer = new RingBuffer<WsPacketMessage>(this.RING_BUFFER_SIZE);
    }

    /**
     * Получить singleton instance
     */
    static getInstance(): PacketBroadcastService {
        if (!PacketBroadcastService.instance) {
            PacketBroadcastService.instance = new PacketBroadcastService();
        }
        return PacketBroadcastService.instance;
    }

    /**
     * Сбросить instance (для тестов)
     */
    static resetInstance(): void {
        PacketBroadcastService.instance = null;
    }

    /**
     * Зарегистрировать пакет и отправить подписчикам
     * Вызывается ДО обработки пакета внутренней логикой
     *
     * @param opcode - опкод пакета
     * @param name - название пакета
     * @param data - распарсенные данные пакета
     * @param direction - направление пакета
     */
    broadcast(
        opcode: number,
        name: string,
        data: unknown,
        direction: 'server_to_client' | 'client_to_server' = 'server_to_client'
    ): void {
        const message: WsPacketMessage = {
            type: direction === 'server_to_client' ? 'server_packet' : 'client_packet',
            direction,
            opcode,
            opcodeHex: `0x${opcode.toString(16).padStart(2, '0').toUpperCase()}`,
            name,
            data,
            timestamp: Date.now(),
        };

        // Сохраняем в ring buffer
        this.ringBuffer.push(message);
        this.packetCounter++;

        // Отправляем подписчикам (неблокирующе)
        this.notifySubscribers(message);
    }

    /**
     * Зарегистрировать сырой пакет (когда нет распарсенных данных)
     */
    broadcastRaw(
        opcode: number,
        name: string,
        rawData: Buffer,
        direction: 'server_to_client' | 'client_to_server' = 'server_to_client'
    ): void {
        this.broadcast(
            opcode,
            name,
            {
                rawLength: rawData.length,
                rawHex: rawData.toString('hex').slice(0, 200), // Ограничиваем размер
            },
            direction
        );
    }

    /**
     * Подписаться на пакеты
     */
    subscribe(callback: PacketCallback): () => void {
        this.subscribers.push(callback);
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index !== -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }

    /**
     * Получить накопленные пакеты из ring buffer
     */
    getBufferedPackets(): WsPacketMessage[] {
        return this.ringBuffer.getAll();
    }

    /**
     * Очистить ring buffer
     */
    clearBuffer(): void {
        this.ringBuffer.clear();
    }

    /**
     * Получить статистику
     */
    getStats(): {
        bufferedPackets: number;
        totalPackets: number;
        subscribers: number;
    } {
        return {
            bufferedPackets: this.ringBuffer.size(),
            totalPackets: this.packetCounter,
            subscribers: this.subscribers.length,
        };
    }

    /**
     * Уведомить всех подписчиков (с защитой от ошибок)
     */
    private notifySubscribers(message: WsPacketMessage): void {
        for (const callback of this.subscribers) {
            try {
                callback(message);
            } catch (error) {
                // Логируем ошибку, но не прерываем других подписчиков
                console.error('[PacketBroadcastService] Error notifying subscriber:', error);
            }
        }
    }
}

/**
 * Глобальный singleton для удобного доступа
 */
export const packetBroadcast = PacketBroadcastService.getInstance();
