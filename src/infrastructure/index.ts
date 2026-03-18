// Infrastructure Layer Exports

// Persistence
export {
    InMemoryCharacterRepository,
    InMemoryWorldRepository,
    InMemoryInventoryRepository,
    InMemoryConnectionRepository,
    characterRepository,
    worldRepository,
    inventoryRepository,
    connectionRepository,
} from './persistence';

// Event Bus
export { SimpleEventBus, eventBus } from './event-bus';

// Protocol
export {
    StateMachine,
    StateMachineBuilder,
    createGameStateMachine,
    createLoginStateMachine,
} from './protocol';

// Game Protocol
export {
    GameIncomingPacketFactory,
    gameIncomingPacketFactory,
    GamePacketProcessor,
    BasePacketHandlerStrategy,
    type PacketMetadata,
    type PacketConstructor,
    type PacketMiddleware,
} from './protocol/game';

// Adapters
export {
    GameStateStoreAdapter,
    type LegacyPosition,
    type LegacyHpMpCp,
    type LegacyCharacterState,
    type LegacyNpcInfo,
    type LegacyInventoryItem,
    type LegacyInventoryState,
} from './adapters';

// Integration
export {
    NewArchitectureBridge,
    architectureBridge,
    type ArchitectureMode,
} from './integration/NewArchitectureBridge';
