/**
 * src/network/incoming/game/ItemListHandler.ts
 * Обработчик входящего пакета ItemList (опкод 0x1B)
 * Протокол: L2J_Mobius CT_0_Interlude (Protocol 746)
 */

import { PacketReader } from '../../PacketReader';
import { getSlotKeyByMask, type EquipmentSlot } from '../../../data/slotMasks';
import type {
    IItem,
    IEquipment,
    IInventoryData,
} from '../../../models/IEquipment';

/**
 * Опкод пакета ItemList
 */
export const ITEM_LIST_OPCODE = 0x1b;

/**
 * Интерфейс для состояния, которое может эмитить события
 */
interface IStateEmitter {
    emit(event: 'inventory:updated', items: IItem[]): void;
    emit(event: 'equipment:updated', equipment: IEquipment): void;
}

/**
 * Читает предмет из буфера пакета
 * @param reader - PacketReader с позицией на начале предмета
 * @returns Объект IItem
 */
function readItem(reader: PacketReader): IItem {
    const objectId = reader.readInt32LE();
    const itemId = reader.readInt32LE();
    const location = reader.readInt32LE();
    const slot = reader.readInt32LE();
    const enchantLevel = reader.readUInt16LE();
    const count = reader.readInt64LE();
    const customType1 = reader.readInt32LE();
    const augmented = reader.readUInt8() !== 0;
    const mana = reader.readInt32LE();

    return {
        objectId,
        itemId,
        location,
        slot,
        enchantLevel,
        count,
        customType1,
        augmented,
        mana,
    };
}

/**
 * Обрабатывает предмет для экипировки
 * Определяет слот по битовой маске и добавляет в объект equipment
 * @param item - предмет для обработки
 * @param equipment - объект экипировки для заполнения
 */
function processEquipmentItem(item: IItem, equipment: IEquipment): void {
    const slotKey = getSlotKeyByMask(item.slot);

    if (slotKey) {
        // Используем type assertion только для записи в строго типизированный объект
        // Это безопасно, так как slotKey гарантированно является EquipmentSlot
        equipment[slotKey] = item;
    }
}

/**
 * Парсит пакет ItemList и возвращает структурированные данные
 * @param buffer - сырой буфер пакета (без учета заголовка длины)
 * @returns Объект с данными инвентаря
 */
export function parseItemListPacket(buffer: Buffer): IInventoryData {
    const reader = new PacketReader(buffer);

    // Читаем флаг показа окна
    const showWindow = reader.readUInt8() !== 0;

    // Читаем количество предметов
    const count = reader.readInt32LE();

    const inventory: IItem[] = [];
    const equipment: IEquipment = {};

    // Читаем предметы в цикле
    for (let i = 0; i < count; i++) {
        const item = readItem(reader);
        inventory.push(item);

        // Если предмет экипирован (location > 0), добавляем в equipment
        if (item.location > 0) {
            processEquipmentItem(item, equipment);
        }
    }

    return {
        showWindow,
        inventory,
        equipment,
        lastUpdated: Date.now(),
    };
}

/**
 * Обрабатывает пакет ItemList и обновляет состояние
 * @param buffer - сырой буфер пакета
 * @param state - объект состояния с методом emit для событий
 */
export function handleItemListPacket(
    buffer: Buffer,
    state: IStateEmitter,
): IInventoryData {
    const data = parseItemListPacket(buffer);

    // Эмитим событие обновления инвентаря
    state.emit('inventory:updated', data.inventory);

    // Эмитим событие обновления экипировки
    state.emit('equipment:updated', data.equipment);

    return data;
}

/**
 * Класс-обработчик пакета ItemList
 */
export class ItemListHandler {
    /**
     * Опкод обрабатываемого пакета
     */
    public static readonly OPCODE = ITEM_LIST_OPCODE;

    private state: IStateEmitter;

    constructor(state: IStateEmitter) {
        this.state = state;
    }

    /**
     * Обрабатывает пакет ItemList
     * @param buffer - сырой буфер пакета
     * @returns Объект с данными инвентаря
     */
    public handle(buffer: Buffer): IInventoryData {
        return handleItemListPacket(buffer, this.state);
    }

    /**
     * Парсит пакет без эмита событий (для тестов или предпросмотра)
     * @param buffer - сырой буфер пакета
     */
    public static parse(buffer: Buffer): IInventoryData {
        return parseItemListPacket(buffer);
    }
}
