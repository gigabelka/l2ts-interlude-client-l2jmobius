/**
 * @fileoverview NewArchitectureBridge - мост для новой архитектуры
 * Предоставляет доступ к DI контейнеру и управляет режимами работы
 * @module infrastructure/integration
 */

import { createContainer } from '../../config/di';
import type { Container } from '../../config/di';
import { GameStateStoreAdapter } from '../adapters';
import type { IEventBus } from '../../application/ports';
import type { ICharacterRepository, IWorldRepository } from '../../domain/repositories';
import { DI_TOKENS } from '../../config/di/Container';

/**
 * Режим работы архитектуры
 */
export type ArchitectureMode = 'NEW' | 'ADAPTER';

/**
 * Bridge для интеграции новой архитектуры
 * 
 * Поддерживает режимы:
 * - ADAPTER: Новая архитектура с адаптером для совместимости
 * - NEW: Только новая архитектура (Repositories + EventBus)
 */
export class NewArchitectureBridge {
    private static instance: NewArchitectureBridge;
    private container: Container;
    private mode: ArchitectureMode = 'NEW';
    private adapter?: GameStateStoreAdapter;

    private constructor() {
        this.container = createContainer();
    }

    static getInstance(): NewArchitectureBridge {
        if (!NewArchitectureBridge.instance) {
            NewArchitectureBridge.instance = new NewArchitectureBridge();
        }
        return NewArchitectureBridge.instance;
    }

    /**
     * Инициализировать bridge в указанном режиме
     */
    initialize(mode: ArchitectureMode = 'NEW'): void {
        this.mode = mode;

        switch (mode) {
            case 'ADAPTER':
                this.setupAdapter();
                break;
            case 'NEW':
            default:
                this.setupNew();
                break;
        }

        console.log(`[ArchitectureBridge] Initialized in ${mode} mode`);
    }

    /**
     * Получить DI контейнер
     */
    getContainer(): Container {
        return this.container;
    }

    /**
     * Получить текущий режим
     */
    getMode(): ArchitectureMode {
        return this.mode;
    }

    /**
     * Проверить, активна ли новая архитектура
     */
    isNewArchitectureActive(): boolean {
        return this.mode === 'NEW' || this.mode === 'ADAPTER';
    }

    /**
     * Получить GameStateStore адаптер (если в режиме ADAPTER)
     */
    getGameStateStore(): GameStateStoreAdapter | undefined {
        return this.adapter;
    }

    /**
     * Получить статистику новой архитектуры
     */
    getStats(): Record<string, unknown> {
        if (!this.isNewArchitectureActive()) {
            return { mode: this.mode };
        }

        const charRepo = this.container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
        const worldRepo = this.container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
        const eventBus = this.container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();

        return {
            mode: this.mode,
            character: charRepo.exists() ? 'initialized' : 'empty',
            world: (worldRepo as unknown as { getStats?: () => unknown }).getStats?.() || {},
            events: (eventBus as unknown as { getStats?: () => unknown }).getStats?.() || {},
        };
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private setupAdapter(): void {
        this.adapter = this.container.resolve<GameStateStoreAdapter>(DI_TOKENS.GameStateStore).getOrThrow();
    }

    private setupNew(): void {
        // В режиме NEW полностью используем репозитории напрямую
        // Здесь можно добавить дополнительную настройку если нужно
    }
}

/**
 * Глобальный bridge instance
 */
export const architectureBridge = NewArchitectureBridge.getInstance();
