/**
 * @fileoverview PacketDecoder - декодер пакетов L2 Interlude
 * Преобразует WebSocket сообщения с raw_packet в читаемые события
 * @module infrastructure/protocol/game
 */

/** Категории пакетов */
type PacketCategory = 'AUTH' | 'MOVEMENT' | 'COMBAT' | 'CHAT' | 'STATUS' | 'SPAWN' | 'INVENTORY' | 'SYSTEM';

/** Определение пакета */
interface PacketDefinition {
    name: string;
    category: PacketCategory;
    fields: string[];
}

/** Карта опкодов → определения пакетов (Interlude server packets) */
const OPCODE_MAP: Map<number, PacketDefinition> = new Map([
    [0x00, { name: 'Init', category: 'AUTH', fields: ['blowfishKey', 'sessionId'] }],
    [0x01, { name: 'MoveToLocation', category: 'MOVEMENT', fields: ['objectId', 'toX', 'toY', 'toZ', 'fromX', 'fromY', 'fromZ'] }],
    [0x02, { name: 'Say2', category: 'CHAT', fields: ['objectId', 'type', 'name', 'channelName', 'text'] }],
    [0x03, { name: 'SocialAction', category: 'COMBAT', fields: ['objectId', 'actionId'] }],
    [0x04, { name: 'UserInfo', category: 'STATUS', fields: ['name', 'race', 'sex', 'class', 'level', 'exp', 'hp', 'mp', 'sp', 'karma', 'x', 'y', 'z'] }],
    [0x05, { name: 'Die', category: 'COMBAT', fields: ['objectId', 'isKnownPlayer', 'sweepable'] }],
    [0x06, { name: 'Revive', category: 'STATUS', fields: ['objectId'] }],
    [0x08, { name: 'GetItem', category: 'INVENTORY', fields: ['objectId', 'itemId', 'x', 'y', 'z'] }],
    [0x09, { name: 'StopMove', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],
    [0x0A, { name: 'ItemList', category: 'INVENTORY', fields: ['items'] }],
    [0x0B, { name: 'CharInfo', category: 'SPAWN', fields: ['x', 'y', 'z', 'heading', 'objectId', 'name', 'race', 'sex', 'class'] }],
    [0x0C, { name: 'Logout', category: 'AUTH', fields: [] }],
    [0x0E, { name: 'StatusUpdate', category: 'STATUS', fields: ['objectId', 'attributes'] }],
    [0x0F, { name: 'Attack', category: 'COMBAT', fields: ['attackerId', 'hit'] }],
    [0x11, { name: 'SpawnItem', category: 'SPAWN', fields: ['objectId', 'itemId', 'x', 'y', 'z', 'stackable', 'count'] }],
    [0x12, { name: 'NpcInfo', category: 'SPAWN', fields: ['objectId', 'npcId', 'isAttackable', 'x', 'y', 'z', 'hp', 'maxHp', 'title'] }],
    [0x13, { name: 'CharList', category: 'AUTH', fields: ['chars'] }],
    [0x14, { name: 'CharSelected', category: 'AUTH', fields: ['name', 'charId', 'title', 'x', 'y', 'z', 'class'] }],
    [0x19, { name: 'DeleteObject', category: 'SPAWN', fields: ['objectId'] }],
    [0x1C, { name: 'TargetSelected', category: 'COMBAT', fields: ['objectId', 'targetId', 'color'] }],
    [0x1D, { name: 'TargetUnselected', category: 'COMBAT', fields: ['objectId', 'x', 'y', 'z'] }],
    [0x1F, { name: 'NpcHtmlMessage', category: 'SYSTEM', fields: ['npcObjectId', 'html', 'itemId'] }],
    [0x20, { name: 'SystemMessage', category: 'SYSTEM', fields: ['messageId', 'params'] }],
    [0x25, { name: 'ActionFailed', category: 'SYSTEM', fields: [] }],
    [0x28, { name: 'InventoryUpdate', category: 'INVENTORY', fields: ['changes'] }],
    [0x2F, { name: 'ChangeWaitType', category: 'MOVEMENT', fields: ['objectId', 'moveType'] }],
    [0x38, { name: 'TeleportToLocation', category: 'MOVEMENT', fields: ['objectId', 'toX', 'toY', 'toZ', 'fromX', 'fromY', 'fromZ'] }],
    [0x3E, { name: 'ChangeMoveType', category: 'MOVEMENT', fields: ['objectId', 'isRunning'] }],
    [0x3F, { name: 'ValidateLocation', category: 'MOVEMENT', fields: ['objectId', 'x', 'y', 'z', 'heading'] }],
    [0x47, { name: 'MagicSkillUse', category: 'COMBAT', fields: ['casterObjectId', 'targetObjectId', 'skillId', 'skillLevel', 'castTime'] }],
    [0x48, { name: 'MagicSkillLaunched', category: 'COMBAT', fields: ['casterObjectId', 'targetObjectId', 'skillId'] }],
    [0x4A, { name: 'SetupGauge', category: 'STATUS', fields: ['objectId', 'color', 'time'] }],
    [0x65, { name: 'ShortCutInit', category: 'SYSTEM', fields: ['shortcuts'] }],
    [0x7E, { name: 'LogoutOK', category: 'AUTH', fields: [] }],
    [0x80, { name: 'QuestList', category: 'SYSTEM', fields: ['quests'] }],
    [0xD3, { name: 'NetPingRequest', category: 'SYSTEM', fields: [] }],
    [0xFE, { name: 'ExPacket', category: 'SYSTEM', fields: ['subOpcode'] }],
]);

/** Маппинг категорий → префикс event_type */
const CATEGORY_TYPE_MAP: Record<PacketCategory, string> = {
    AUTH: 'auth',
    MOVEMENT: 'game.move',
    COMBAT: 'game.combat',
    CHAT: 'game.chat',
    STATUS: 'game.status',
    SPAWN: 'game.spawn',
    INVENTORY: 'game.inventory',
    SYSTEM: 'system',
};

/** Входное сообщение WebSocket */
export interface RawPacketMessage {
    type: string;
    channel: string;
    payload: {
        opcode: number;
        opcodeHex: string;
        length: number;
        state: string;
        [key: string]: unknown;
    };
    timestamp: string;
}

/** Выходное событие */
export interface DecodedPacketEvent {
    type: string;
    packet: {
        name: string;
        opcode: number;
        opcodeHex: string;
        category: PacketCategory;
        length: number;
        state: string;
        data: Record<string, unknown>;
    };
    summary: string;
    world: {
        zone: string | null;
        region: string | null;
        nearbyObjects: number | null;
    };
    timestamp: string;
}

/**
 * Вспомогательная функция для получения значения из extraData
 */
function getValue(extraData: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
        if (key in extraData) {
            return extraData[key];
        }
    }
    return undefined;
}

/**
 * Создает пустой объект data с полями пакета (все null)
 */
function createEmptyData(fields: string[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const field of fields) {
        data[field] = null;
    }
    return data;
}

/**
 * Генерирует summary на русском языке
 */
function generateSummary(
    packetDef: PacketDefinition,
    payload: RawPacketMessage['payload']
): string {
    const { name } = packetDef;
    const extraData = payload;

    switch (name) {
        case 'MoveToLocation': {
            const toX = getValue(extraData, ['toX', 'to_x']) ?? '?';
            const toY = getValue(extraData, ['toY', 'to_y']) ?? '?';
            const toZ = getValue(extraData, ['toZ', 'to_z']) ?? '?';
            return `Объект начал движение → (${toX}, ${toY}, ${toZ})`;
        }

        case 'Attack': {
            const damage = getValue(extraData, ['damage']) ?? '?';
            const critical = extraData['critical'];
            return `Атака по цели — урон ${damage}${critical ? ' [Крит!]' : ''}`;
        }

        case 'Die': {
            const sweepable = extraData['sweepable'];
            return `Объект погиб${sweepable ? ' [sweep возможен]' : ''}`;
        }

        case 'Say2': {
            const channel = getValue(extraData, ['channelName', 'channel', 'type']) ?? '?';
            const speaker = extraData['name'] ?? '?';
            const text = extraData['text'] ?? '...';
            return `[${channel}] ${speaker}: '${text}'`;
        }

        case 'TeleportToLocation': {
            const toX = getValue(extraData, ['toX', 'to_x']) ?? '?';
            const toY = getValue(extraData, ['toY', 'to_y']) ?? '?';
            const toZ = getValue(extraData, ['toZ', 'to_z']) ?? '?';
            return `Телепорт → (${toX}, ${toY}, ${toZ})`;
        }

        case 'StatusUpdate': {
            return 'HP/MP/CP обновлён у объекта';
        }

        case 'NetPingRequest': {
            return 'Ping от сервера — нужен Pong';
        }

        case 'ActionFailed': {
            return 'Действие отклонено сервером';
        }

        case 'UserInfo': {
            const lvl = extraData['level'] ?? '?';
            const hp = extraData['hp'] ?? '?';
            return `UserInfo: уровень ${lvl}, HP ${hp}`;
        }

        case 'NpcInfo': {
            const npcId = getValue(extraData, ['npcId', 'npc_id']) ?? '?';
            const title = extraData['title'] ?? '';
            return `NPC ${npcId} появился${title ? ` (${title})` : ''}`;
        }

        case 'CharInfo': {
            const charName = extraData['name'] ?? '?';
            return `Игрок ${charName} появился в зоне видимости`;
        }

        case 'ItemList': {
            const items = extraData['items'];
            const count = items && Array.isArray(items) ? items.length : (getValue(extraData, ['itemCount', 'count']) ?? '?');
            return `Получен список инвентаря (${count} предметов)`;
        }

        case 'InventoryUpdate': {
            return 'Инвентарь обновлён';
        }

        case 'SpawnItem': {
            const itemId = getValue(extraData, ['itemId', 'item_id']) ?? '?';
            return `Предмет ${itemId} появился в мире`;
        }

        case 'DeleteObject': {
            const objId = getValue(extraData, ['objectId', 'object_id']) ?? '?';
            return `Объект ${objId} удалён из мира`;
        }

        case 'TargetSelected': {
            const targetId = getValue(extraData, ['targetId', 'target_id']) ?? '?';
            return `Цель выбрана: ${targetId}`;
        }

        case 'TargetUnselected': {
            return 'Цель сброшена';
        }

        case 'MagicSkillUse': {
            const skillId = getValue(extraData, ['skillId', 'skill_id']) ?? '?';
            const castTime = getValue(extraData, ['castTime', 'cast_time']) ?? '?';
            return `Используется скилл ${skillId} (${castTime}мс)`;
        }

        case 'MagicSkillLaunched': {
            const skillId = getValue(extraData, ['skillId', 'skill_id']) ?? '?';
            return `Скилл ${skillId} запущен`;
        }

        case 'SocialAction': {
            const actionId = getValue(extraData, ['actionId', 'action_id']) ?? '?';
            return `Социальное действие: ${actionId}`;
        }

        case 'StopMove': {
            return 'Движение остановлено';
        }

        case 'ValidateLocation': {
            const x = extraData['x'] ?? '?';
            const y = extraData['y'] ?? '?';
            return `Позиция валидирована: (${x}, ${y})`;
        }

        case 'ChangeMoveType': {
            const running = extraData['isRunning'] ?? extraData['running'];
            return running ? 'Начат бег' : 'Начата ходьба';
        }

        case 'ChangeWaitType': {
            const moveType = (getValue(extraData, ['moveType', 'move_type']) as number) ?? 0;
            const types = ['стоит', 'сидит', 'feign death'];
            return `Состояние: ${types[moveType] ?? 'неизвестно'}`;
        }

        case 'CharList': {
            const chars = extraData['chars'];
            const charCount = chars && Array.isArray(chars) ? chars.length : (extraData['charCount'] ?? '?');
            return `Список персонажей (${charCount})`;
        }

        case 'CharSelected': {
            const charName = extraData['name'] ?? '?';
            return `Выбран персонаж: ${charName}`;
        }

        case 'SystemMessage': {
            const msgId = getValue(extraData, ['messageId', 'message_id']) ?? '?';
            return `Системное сообщение [ID: ${msgId}]`;
        }

        case 'NpcHtmlMessage': {
            return 'HTML сообщение от NPC';
        }

        case 'QuestList': {
            const quests = extraData['quests'];
            const questCount = quests && Array.isArray(quests) ? quests.length : '?';
            return `Список квестов (${questCount})`;
        }

        case 'ShortCutInit': {
            const shortcuts = extraData['shortcuts'];
            const shortcutCount = shortcuts && Array.isArray(shortcuts) ? shortcuts.length : '?';
            return `Инициализация панели (${shortcutCount} слотов)`;
        }

        case 'SetupGauge': {
            const color = extraData['color'] ?? '?';
            const time = extraData['time'] ?? '?';
            return `Прогрессбар: цвет=${color}, время=${time}мс`;
        }

        case 'Revive': {
            return 'Объект воскрешён';
        }

        case 'GetItem': {
            const itemId = getValue(extraData, ['itemId', 'item_id']) ?? '?';
            return `Предмет ${itemId} поднят`;
        }

        case 'Logout':
        case 'LogoutOK': {
            return 'Выход из игры';
        }

        case 'Init': {
            const sessionId = getValue(extraData, ['sessionId', 'session_id']) ?? '?';
            return `Инициализация сессии ${sessionId}`;
        }

        case 'ExPacket': {
            const subOpcode = getValue(extraData, ['subOpcode', 'sub_opcode']) ?? '?';
            return `Расширенный пакет (sub: 0x${Number(subOpcode).toString(16).toUpperCase()})`;
        }

        default:
            return `Пакет ${name}`;
    }
}

/**
 * Декодирует raw пакет в читаемое событие
 * @param message WebSocket сообщение с raw_packet
 * @returns Декодированное событие
 */
export function decodePacket(message: RawPacketMessage): DecodedPacketEvent {
    const { opcode, opcodeHex, length, state, ...extraFields } = message.payload;
    const timestamp = message.timestamp;

    // Ищем определение пакета
    const packetDef = OPCODE_MAP.get(opcode);

    if (!packetDef) {
        // Неизвестный пакет
        return {
            type: 'system.unknown',
            packet: {
                name: 'Unknown',
                opcode,
                opcodeHex,
                category: 'SYSTEM',
                length,
                state,
                data: { raw: extraFields },
            },
            summary: `Неизвестный пакет 0x${opcode.toString(16).toUpperCase().padStart(2, '0')}`,
            world: {
                zone: null,
                region: null,
                nearbyObjects: null,
            },
            timestamp,
        };
    }

    // Создаем data с полями пакета
    const data = createEmptyData(packetDef.fields);

    // Добавляем дополнительные поля из payload если они есть
    for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined && value !== null) {
            data[key] = value;
        }
    }

    // Формируем type
    const typePrefix = CATEGORY_TYPE_MAP[packetDef.category];
    const type = `${typePrefix}.${packetDef.name.toLowerCase()}`;

    // Генерируем summary
    const summary = generateSummary(packetDef, message.payload);

    return {
        type,
        packet: {
            name: packetDef.name,
            opcode,
            opcodeHex,
            category: packetDef.category,
            length,
            state,
            data,
        },
        summary,
        world: {
            zone: null,
            region: null,
            nearbyObjects: null,
        },
        timestamp,
    };
}

/**
 * Получить информацию о пакете по опкоду
 * @param opcode Номер опкода
 * @returns Определение пакета или undefined
 */
export function getPacketDefinition(opcode: number): PacketDefinition | undefined {
    return OPCODE_MAP.get(opcode);
}

/**
 * Получить список всех поддерживаемых опкодов
 * @returns Массив опкодов
 */
export function getSupportedOpcodes(): number[] {
    return Array.from(OPCODE_MAP.keys()).sort((a, b) => a - b);
}

/**
 * Проверить, поддерживается ли опкод
 * @param opcode Номер опкода
 * @returns true если опкод известен
 */
export function isOpcodeKnown(opcode: number): boolean {
    return OPCODE_MAP.has(opcode);
}
