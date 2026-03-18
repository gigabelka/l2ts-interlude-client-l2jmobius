/**
 * src/models/IEquipment.ts
 * Интерфейсы для инвентаря и экипировки персонажа
 * Протокол: L2J_Mobius CT_0_Interlude (Protocol 746)
 */

import type { EquipmentSlot } from '../data/slotMasks';

/**
 * Интерфейс предмета (item) из пакета ItemList
 */
export interface IItem {
    /** Object ID предмета (уникальный в рамках сервера) */
    objectId: number;

    /** ID предмета (тип предмета из ItemName-e.dat) */
    itemId: number;

    /**
     * Локация предмета:
     * - 0 = инвентарь
     * - 1 и больше = экипировано
     */
    location: number;

    /** Битовая маска слота (только для экипировки) */
    slot: number;

    /** Уровень заточки (enchant level) */
    enchantLevel: number;

    /** Количество предметов (для stackable) */
    count: bigint;

    /** Кастомный тип 1 (обычно 0) */
    customType1: number;

    /** Флаг аугментации (0 или 1) */
    augmented: boolean;

    /** Мана (для кристаллов и некоторых предметов) */
    mana: number;
}

/**
 * Строго типизированный интерфейс экипировки персонажа
 * Каждый слот может содержать предмет или быть undefined (пустым)
 */
export interface IEquipment {
    /** Шлем */
    HEAD?: IItem;

    /** Ожерелье */
    NECK?: IItem;

    /** Серьги */
    REAR_LEAR?: IItem;

    /** Оружие (правая рука) */
    RHAND?: IItem;

    /** Щит или левая часть двуручного оружия */
    LHAND?: IItem;

    /** Перчатки */
    GLOVES?: IItem;

    /** Верхняя броня */
    CHEST?: IItem;

    /** Штаны */
    LEGS?: IItem;

    /** Ботинки */
    FEET?: IItem;

    /** Плащ/накидка */
    BACK?: IItem;
}

/**
 * Полный набор данных инвентаря
 */
export interface IInventoryData {
    /** Флаг показа окна инвентаря */
    showWindow: boolean;

    /** Все предметы в инвентаре (включая экипировку) */
    inventory: IItem[];

    /** Экипированные предметы по слотам */
    equipment: IEquipment;

    /** Timestamp последнего обновления */
    lastUpdated: number;
}

/**
 * Тип для события обновления инвентаря
 */
export interface InventoryUpdateEvent {
    items: IItem[];
    count: number;
}

/**
 * Тип для события обновления экипировки
 */
export interface EquipmentUpdateEvent {
    equipment: IEquipment;
    equippedCount: number;
}

/**
 * Type guard для проверки, что предмет экипирован
 */
export function isEquippedItem(item: IItem): boolean {
    return item.location > 0;
}

/**
 * Получает отображаемое имя слота
 */
export function getSlotDisplayName(slot: EquipmentSlot): string {
    const names: Record<EquipmentSlot, string> = {
        HEAD: 'Шлем',
        NECK: 'Ожерелье',
        REAR_LEAR: 'Серьги',
        RHAND: 'Оружие',
        LHAND: 'Щит',
        GLOVES: 'Перчатки',
        CHEST: 'Верхняя броня',
        LEGS: 'Штаны',
        FEET: 'Ботинки',
        BACK: 'Плащ',
    };
    return names[slot] || slot;
}

/**
 * Форматирует название предмета с заточкой
 */
export function formatItemName(item: IItem): string {
    const enchantPrefix = item.enchantLevel > 0 ? `(+${item.enchantLevel}) ` : '';
    return `${enchantPrefix}ItemID: ${item.itemId}`;
}
