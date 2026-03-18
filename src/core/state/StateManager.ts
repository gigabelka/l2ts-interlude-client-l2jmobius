/**
 * @fileoverview Базовые классы для управления состоянием (State Management)
 * @module core/state/StateManager
 */

import { EventBus } from '../EventBus';
import type { EventChannel, BaseEvent } from '../EventBus';

/**
 * Базовый интерфейс для всех сущностей состояния
 */
export interface IStateEntity {
    id: number | string;
    updatedAt: number;
}

/**
 * Опции для StateManager
 */
export interface StateManagerOptions<T> {
    /** Название менеджера (для логов) */
    name: string;
    /** Канал событий */
    eventChannel: EventChannel;
    /** Событие изменения */
    eventType: string;
    /** Глубина истории изменений */
    historyDepth?: number;
    /** Включить валидацию */
    validateOnUpdate?: boolean;
    /** Функция валидации */
    validator?: (data: T) => boolean | string[];
}

/**
 * Результат операции обновления
 */
export interface UpdateResult<T> {
    success: boolean;
    changed: boolean;
    previous?: T;
    current: T;
    errors?: string[];
}

/**
 * Базовый класс для управления состоянием
 * Реализует паттерн Observable + Repository
 */
export class StateManager<T extends IStateEntity> {
    protected data = new Map<number | string, T>();
    protected history: Array<{ timestamp: number; changes: Partial<T>[] }> = [];
    protected options: StateManagerOptions<T>;

    constructor(options: StateManagerOptions<T>) {
        this.options = {
            historyDepth: 10,
            validateOnUpdate: false,
            ...options
        };
    }

    /**
     * Получить сущность по ID
     */
    get(id: number | string): T | undefined {
        return this.data.get(id);
    }

    /**
     * Получить все сущности
     */
    getAll(): T[] {
        return Array.from(this.data.values());
    }

    /**
     * Проверить существование сущности
     */
    has(id: number | string): boolean {
        return this.data.has(id);
    }

    /**
     * Получить количество сущностей
     */
    count(): number {
        return this.data.size;
    }

    /**
     * Обновить или создать сущность
     */
    set(id: number | string, data: Partial<T>): UpdateResult<T> {
        const previous = this.data.get(id);
        const now = Date.now();
        
        // Валидация
        if (this.options.validateOnUpdate && this.options.validator) {
            const validation = this.options.validator(data as T);
            if (validation !== true) {
                const errors = Array.isArray(validation) ? validation : ['Validation failed'];
                return {
                    success: false,
                    changed: false,
                    current: previous!,
                    errors
                };
            }
        }

        // Создаём или обновляем сущность
        const current: T = previous 
            ? { ...previous, ...data, updatedAt: now }
            : { ...data, id, updatedAt: now } as T;

        this.data.set(id, current);

        // Определяем изменения
        const changed = !previous || this.hasChanges(previous, current);

        if (changed) {
            // Добавляем в историю
            this.addToHistory([{ id, ...data }]);

            // Эмитим событие
            this.emitChange({
                type: this.options.eventType,
                channel: this.options.eventChannel,
                data: {
                    id,
                    previous: previous ?? null,
                    current,
                    isNew: !previous
                },
                timestamp: new Date().toISOString()
            });
        }

        return {
            success: true,
            changed,
            previous,
            current
        };
    }

    /**
     * Удалить сущность
     */
    delete(id: number | string): boolean {
        const entity = this.data.get(id);
        if (!entity) return false;

        this.data.delete(id);
        
        this.emitChange({
            type: `${this.options.eventType}_removed`,
            channel: this.options.eventChannel,
            data: { id, entity },
            timestamp: new Date().toISOString()
        });

        return true;
    }

    /**
     * Очистить все данные
     */
    clear(): void {
        this.data.clear();
        this.history = [];
    }

    /**
     * Получить историю изменений
     */
    getHistory(): Array<{ timestamp: number; changes: Partial<T>[] }> {
        return [...this.history];
    }

    /**
     * Найти сущности по предикату
     */
    find(predicate: (entity: T) => boolean): T[] {
        return this.getAll().filter(predicate);
    }

    /**
     * Найти одну сущность по предикату
     */
    findOne(predicate: (entity: T) => boolean): T | undefined {
        return this.getAll().find(predicate);
    }

    /**
     * Подписаться на изменения
     */
    onChange(callback: (event: BaseEvent) => void): () => void {
        EventBus.on(this.options.eventType, callback);
        return () => {
            EventBus.removeListener(this.options.eventType, callback);
        };
    }

    /**
     * Проверить есть ли изменения между двумя версиями
     */
    protected hasChanges(previous: T, current: T): boolean {
        const keys = Object.keys(current) as Array<keyof T>;
        return keys.some(key => previous[key] !== current[key]);
    }

    /**
     * Добавить запись в историю
     */
    protected addToHistory(changes: Partial<T>[]): void {
        this.history.push({
            timestamp: Date.now(),
            changes
        });

        // Ограничиваем размер истории
        if (this.history.length > (this.options.historyDepth ?? 10)) {
            this.history.shift();
        }
    }

    /**
     * Эмитить событие изменения
     */
    protected emitChange(event: BaseEvent): void {
        // Use raw emit to allow flexible event types
        EventBus.emit(event.type, event);
        EventBus.emit('*', event);
    }
}

/**
 * Синглтон-менеджер для глобального состояния
 */
export abstract class SingletonStateManager<T extends IStateEntity> extends StateManager<T> {
    private static instances = new Map<string, unknown>();

    protected constructor(options: StateManagerOptions<T>) {
        super(options);
        
        const className = this.constructor.name;
        if (SingletonStateManager.instances.has(className)) {
            throw new Error(`${className} is already instantiated. Use getInstance() instead.`);
        }
        
        SingletonStateManager.instances.set(className, this);
    }

    /**
     * Получить экземпляр (должен быть переопределён в наследниках)
     */
    static getInstance<T>(): T {
        throw new Error('Must be implemented by subclass');
    }
}
