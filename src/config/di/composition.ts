/**
 * @fileoverview Composition Root - конфигурация DI контейнера
 * Здесь регистрируются все зависимости приложения
 * @module config/di
 */

import { Container, DI_TOKENS } from './Container';

// Domain & Application
import type {
    ICharacterRepository,
    IWorldRepository,
    IInventoryRepository,
    IConnectionRepository,
} from '../../domain/repositories';
import type {
    IEventBus,
    IStateMachine,
    IIncomingPacketFactory,
    IPacketProcessor,
} from '../../application/ports';

// Infrastructure
import {
    InMemoryCharacterRepository,
    InMemoryWorldRepository,
    InMemoryInventoryRepository,
    InMemoryConnectionRepository,
} from '../../infrastructure/persistence';
import { SimpleEventBus } from '../../infrastructure/event-bus';
import {
    createGameStateMachine,
    GameIncomingPacketFactory,
    GamePacketProcessor,
    configurePacketFactory,
    configurePacketProcessor,
} from '../../infrastructure/protocol';

// Legacy Adapter
import { GameStateStoreAdapter } from '../../infrastructure/adapters/GameStateStoreAdapter';

/**
 * Создать и настроить DI контейнер
 */
export function createContainer(): Container {
    const container = new Container();

    // ============================================================================
    // Repositories (Singleton - одно хранилище на приложение)
    // ============================================================================

    container.registerInstance<ICharacterRepository>(
        DI_TOKENS.CharacterRepository,
        new InMemoryCharacterRepository()
    );

    container.registerInstance<IWorldRepository>(
        DI_TOKENS.WorldRepository,
        new InMemoryWorldRepository()
    );

    container.registerInstance<IInventoryRepository>(
        DI_TOKENS.InventoryRepository,
        new InMemoryInventoryRepository()
    );
    
    container.registerInstance<IConnectionRepository>(
        DI_TOKENS.ConnectionRepository,
        new InMemoryConnectionRepository()
    );

    // ============================================================================
    // Event Bus (Singleton - единая шина событий)
    // ============================================================================

    container.registerInstance<IEventBus>(
        DI_TOKENS.EventBus,
        new SimpleEventBus()
    );

    // ============================================================================
    // State Machine (Transient - новая для каждого клиента)
    // ============================================================================

    container.register<IStateMachine>(
        DI_TOKENS.StateMachine,
        () => createGameStateMachine(),
        false // transient
    );

    // ============================================================================
    // Packet Factory (Singleton) - configured with all packets
    // ============================================================================

    const packetFactory = configurePacketFactory(new GameIncomingPacketFactory());
    container.registerInstance<IIncomingPacketFactory>(
        DI_TOKENS.PacketFactory,
        packetFactory
    );

    // ============================================================================
    // Packet Processor (Transient) - configured with all handlers
    // ============================================================================

    container.register<IPacketProcessor>(
        DI_TOKENS.PacketProcessor,
        (c) => {
            const factory = c.resolve<IIncomingPacketFactory>(DI_TOKENS.PacketFactory).getOrThrow();
            const eventBus = c.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
            const processor = new GamePacketProcessor(factory as GameIncomingPacketFactory, eventBus);
            
            // Configure handlers with repositories
            configurePacketProcessor(
                processor,
                eventBus,
                {
                    character: c.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow(),
                    world: c.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow(),
                    inventory: c.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow(),
                }
            );
            
            return processor;
        },
        false // transient
    );

    // ============================================================================
    // Legacy Adapter (GameStateStore Bridge)
    // ============================================================================

    container.register<GameStateStoreAdapter>(
        DI_TOKENS.GameStateStore,
        (c) => {
            const charRepo = c.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
            const worldRepo = c.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
            const invRepo = c.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
            const eventBus = c.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
            
            return new GameStateStoreAdapter(charRepo, worldRepo, invRepo, eventBus);
        },
        true // singleton
    );

    return container;
}

/**
 * Создать тестовый контейнер с mock-реализациями
 */
export function createTestContainer(): Container {
    // Для тестов используем те же in-memory реализации
    // но можно заменить на mock-объекты
    return createContainer();
}
