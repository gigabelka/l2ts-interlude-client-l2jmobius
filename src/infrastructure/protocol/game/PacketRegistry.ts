/**
 * @fileoverview PacketRegistry - автоматическая регистрация пакетов и обработчиков
 * Централизованная конфигурация всех игровых пакетов
 * @module infrastructure/protocol/game
 */

import type { IEventBus, IPacketProcessor, IIncomingPacket } from '../../../application/ports';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository } from '../../../domain/repositories';
import { GameIncomingPacketFactory } from './GameIncomingPacketFactory';

// Packets
import { UserInfoPacket } from './packets/UserInfoPacket';
import { NpcInfoPacket } from './packets/NpcInfoPacket';
import { CharInfoPacket } from './packets/CharInfoPacket';
import { ItemListPacket } from './packets/ItemListPacket';
import { InventoryUpdatePacket } from './packets/InventoryUpdatePacket';
import { SkillListPacket } from './packets/SkillListPacket';
import { AttackPacket } from './packets/AttackPacket';
import { MoveToLocationPacket } from './packets/MoveToLocationPacket';
import { SpawnItemPacket } from './packets/SpawnItemPacket';
import { DropItemPacket } from './packets/DropItemPacket';
import { StatusUpdatePacket } from './packets/StatusUpdatePacket';

// Новые пакеты
import { DeleteObjectPacket } from './packets/DeleteObjectPacket';
import { CreatureSayPacket } from './packets/CreatureSayPacket';
import { DiePacket } from './packets/DiePacket';
import { RevivePacket } from './packets/RevivePacket';
import { AbnormalStatusUpdatePacket } from './packets/AbnormalStatusUpdatePacket';
import { MagicSkillUsePacket } from './packets/MagicSkillUsePacket';
import { MyTargetSelectedPacket } from './packets/MyTargetSelectedPacket';
import { TargetUnselectedPacket } from './packets/TargetUnselectedPacket';

// Дополнительные пакеты (из GameStateUpdater)
import { TeleportToLocationPacket } from './packets/TeleportToLocationPacket';
import { ChangeWaitTypePacket } from './packets/ChangeWaitTypePacket';
import { StopMovePacket } from './packets/StopMovePacket';

// Handlers
import { UserInfoHandler } from './handlers/UserInfoHandler';
import { NpcInfoHandler } from './handlers/NpcInfoHandler';
import { CharInfoHandler } from './handlers/CharInfoHandler';
import { ItemListHandler } from './handlers/ItemListHandler';
import { InventoryUpdateHandler } from './handlers/InventoryUpdateHandler';
import { SkillListHandler } from './handlers/SkillListHandler';
import { AttackHandler } from './handlers/AttackHandler';
import { MoveToLocationHandler } from './handlers/MoveToLocationHandler';
import { SpawnItemHandler } from './handlers/SpawnItemHandler';
import { DropItemHandler } from './handlers/DropItemHandler';
import { StatusUpdateHandler } from './handlers/StatusUpdateHandler';

// Новые обработчики
import { DeleteObjectHandler } from './handlers/DeleteObjectHandler';
import { CreatureSayHandler } from './handlers/CreatureSayHandler';
import { DieHandler } from './handlers/DieHandler';
import { ReviveHandler } from './handlers/ReviveHandler';
import { AbnormalStatusUpdateHandler } from './handlers/AbnormalStatusUpdateHandler';
import { MagicSkillUseHandler } from './handlers/MagicSkillUseHandler';
import { MyTargetSelectedHandler } from './handlers/MyTargetSelectedHandler';
import { TargetUnselectedHandler } from './handlers/TargetUnselectedHandler';

// Дополнительные обработчики
import { TeleportToLocationHandler } from './handlers/TeleportToLocationHandler';
import { ChangeWaitTypeHandler } from './handlers/ChangeWaitTypeHandler';
import { StopMoveHandler } from './handlers/StopMoveHandler';

/**
 * Конфигурация пакета
 */
interface PacketConfig {
    opcode: number;
    packetClass: new () => IIncomingPacket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handlerClass?: new (
        eventBus: IEventBus,
        ...repos: any[]
    ) => import('../../../application/ports').IPacketHandlerStrategy;
    repositories?: Array<'character' | 'world' | 'inventory'>;
    description?: string;
}

/**
 * Реестр всех игровых пакетов
 * Добавляйте новые пакеты здесь для автоматической регистрации
 */
const PACKET_REGISTRY: PacketConfig[] = [
    {
        opcode: 0x04,
        packetClass: UserInfoPacket,
        handlerClass: UserInfoHandler,
        repositories: ['character'],
        description: 'UserInfo - полная информация о персонаже',
    },
    {
        opcode: 0x16,
        packetClass: NpcInfoPacket,
        handlerClass: NpcInfoHandler,
        repositories: ['world'],
        description: 'NpcInfo - информация о NPC',
    },
    {
        opcode: 0x03,
        packetClass: CharInfoPacket,
        handlerClass: CharInfoHandler,
        repositories: ['world'],
        description: 'CharInfo - информация о других игроках',
    },
    {
        opcode: 0x1B,
        packetClass: ItemListPacket,
        handlerClass: ItemListHandler,
        repositories: ['inventory', 'character'],
        description: 'ItemList - полный список предметов',
    },
    {
        opcode: 0x19,
        packetClass: InventoryUpdatePacket,
        handlerClass: InventoryUpdateHandler,
        repositories: ['inventory', 'character'],
        description: 'InventoryUpdate - частичное обновление инвентаря',
    },
    {
        opcode: 0x58,
        packetClass: SkillListPacket,
        handlerClass: SkillListHandler,
        repositories: ['character'],
        description: 'SkillList - список скиллов',
    },
    {
        opcode: 0x05,
        packetClass: AttackPacket,
        handlerClass: AttackHandler,
        repositories: ['character'],
        description: 'Attack - атака и урон',
    },
    {
        opcode: 0x2E,
        packetClass: MoveToLocationPacket,
        handlerClass: MoveToLocationHandler,
        repositories: ['character', 'world'],
        description: 'MoveToLocation - движение сущностей',
    },
    {
        opcode: 0x0B,
        packetClass: SpawnItemPacket,
        handlerClass: SpawnItemHandler,
        repositories: ['world'],
        description: 'SpawnItem - появление предмета в мире',
    },
    {
        opcode: 0x0C,
        packetClass: DropItemPacket,
        handlerClass: DropItemHandler,
        repositories: ['world'],
        description: 'DropItem - выпадение предмета',
    },
    {
        opcode: 0x0E,
        packetClass: StatusUpdatePacket,
        handlerClass: StatusUpdateHandler,
        repositories: ['character', 'world'],
        description: 'StatusUpdate - обновление HP/MP/CP',
    },
    // Новые пакеты
    {
        opcode: 0x08,
        packetClass: DeleteObjectPacket,
        handlerClass: DeleteObjectHandler,
        repositories: ['character', 'world'],
        description: 'DeleteObject - удаление объекта из мира',
    },
    {
        opcode: 0x4A,
        packetClass: CreatureSayPacket,
        handlerClass: CreatureSayHandler,
        repositories: ['character'],
        description: 'CreatureSay - сообщение в чате',
    },
    {
        opcode: 0x06,
        packetClass: DiePacket,
        handlerClass: DieHandler,
        repositories: ['character', 'world'],
        description: 'Die - смерть сущности',
    },
    {
        opcode: 0x07,
        packetClass: RevivePacket,
        handlerClass: ReviveHandler,
        repositories: ['character', 'world'],
        description: 'Revive - воскрешение сущности',
    },
    {
        opcode: 0x39,
        packetClass: AbnormalStatusUpdatePacket,
        handlerClass: AbnormalStatusUpdateHandler,
        repositories: ['character'],
        description: 'AbnormalStatusUpdate - обновление баффов/дебаффов',
    },
    {
        opcode: 0x76,
        packetClass: MagicSkillUsePacket,
        handlerClass: MagicSkillUseHandler,
        repositories: ['character', 'world'],
        description: 'MagicSkillUse - использование скилла',
    },
    {
        opcode: 0xA1,
        packetClass: MyTargetSelectedPacket,
        handlerClass: MyTargetSelectedHandler,
        repositories: ['character', 'world'],
        description: 'MyTargetSelected - выбор цели',
    },
    {
        opcode: 0xA6,
        packetClass: TargetUnselectedPacket,
        handlerClass: TargetUnselectedHandler,
        repositories: ['character'],
        description: 'TargetUnselected - сброс цели',
    },
    // Дополнительные пакеты (были только в GameStateUpdater)
    {
        opcode: 0x27,
        packetClass: TeleportToLocationPacket,
        handlerClass: TeleportToLocationHandler,
        repositories: ['character', 'world'],
        description: 'TeleportToLocation - телепорт сущности',
    },
    {
        opcode: 0x2F,
        packetClass: ChangeWaitTypePacket,
        handlerClass: ChangeWaitTypeHandler,
        repositories: ['character', 'world'],
        description: 'ChangeWaitType - изменение состояния сидения/стояния',
    },
    {
        opcode: 0x59,
        packetClass: StopMovePacket,
        handlerClass: StopMoveHandler,
        repositories: ['character', 'world'],
        description: 'StopMove - остановка движения',
    },
];

/**
 * Настроить фабрику пакетов
 */
export function configurePacketFactory(factory?: GameIncomingPacketFactory): GameIncomingPacketFactory {
    const packetFactory = factory || new GameIncomingPacketFactory();

    for (const config of PACKET_REGISTRY) {
        packetFactory.register(config.opcode, config.packetClass, {
            name: config.packetClass.name,
            description: config.description,
        });
    }

    return packetFactory;
}

/**
 * Настроить процессор пакетов с обработчиками
 */
export function configurePacketProcessor(
    processor: IPacketProcessor,
    eventBus: IEventBus,
    repositories: {
        character: ICharacterRepository;
        world: IWorldRepository;
        inventory: IInventoryRepository;
    }
): void {
    for (const config of PACKET_REGISTRY) {
        if (config.handlerClass && config.repositories) {
            // Создаем массив репозиториев для конструктора
            const repos = config.repositories.map((name) => repositories[name]);
            const handler = new config.handlerClass(eventBus, ...repos);
            processor.registerHandler(handler);
        }
    }
}

/**
 * Получить список зарегистрированных опкодов
 */
export function getRegisteredOpcodes(): number[] {
    return PACKET_REGISTRY.map((p) => p.opcode).sort((a, b) => a - b);
}

/**
 * Проверить, поддерживается ли опкод
 */
export function isOpcodeSupported(opcode: number): boolean {
    return PACKET_REGISTRY.some((p) => p.opcode === opcode);
}

/**
 * Получить информацию о пакете по опкоду
 */
export function getPacketInfo(opcode: number): PacketConfig | undefined {
    return PACKET_REGISTRY.find((p) => p.opcode === opcode);
}

/**
 * Получить полный реестр
 */
export function getFullRegistry(): ReadonlyArray<PacketConfig> {
    return Object.freeze([...PACKET_REGISTRY]);
}

/**
 * Получить количество зарегистрированных пакетов
 */
export function getRegisteredPacketCount(): number {
    return PACKET_REGISTRY.length;
}

/**
 * Получить количество обработчиков
 */
export function getHandlerCount(): number {
    return PACKET_REGISTRY.filter((p) => p.handlerClass).length;
}
