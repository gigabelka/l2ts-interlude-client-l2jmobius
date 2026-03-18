/**
 * src/models/L2Item.ts
 * 
 * Унифицированный интерфейс предмета инвентаря для Lineage 2 Interlude
 * Используется в парсерах пакетов, GameStateStore и Dashboard
 * 
 * Protocol: L2J_Mobius CT_0_Interlude (Protocol 746)
 */

/** Типы предметов */
export type L2ItemType = 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';

/** Грейд предмета */
export type L2ItemGrade = 'No' | 'D' | 'C' | 'B' | 'A' | 'S';

/**
 * Основной интерфейс предмета инвентаря
 */
export interface L2Item {
    /** 
     * Object ID предмета 
     * Уникальный идентификатор экземпляра предмета в рамках сервера
     */
    objectId: number;

    /** 
     * Item ID предмета 
     * Идентификатор типа предмета из ItemName-e.dat
     */
    itemId: number;

    /** 
     * Количество предметов 
     * Для stackable предметов может быть > 1
     */
    count: number;

    /** 
     * Слот инвентаря или битовая маска слота экипировки 
     * - Для инвентаря: номер ячейки (обычно 0)
     * - Для экипировки: битовая маска (например, 0x0040 для оружия)
     */
    slot: number;

    /** 
     * Флаг экипировки 
     * true = предмет надет на персонаже
     */
    equipped: boolean;

    /** 
     * Уровень заточки (enchant level) 
     * 0 = не заточен, >0 = количество заточек
     */
    enchant: number;

    /** 
     * Локация предмета 
     * 0 = инвентарь, 1+ = экипировано
     */
    location?: number;

    /** 
     * Тип предмета 
     */
    type?: L2ItemType;

    /** 
     * Отображаемое имя предмета 
     */
    name?: string;

    /** 
     * Грейд предмета 
     */
    grade?: L2ItemGrade;

    /** 
     * Мана (для кристаллов оружия и некоторых предметов) 
     */
    mana?: number;

    /**
     * Флаг аугментации
     */
    augmented?: boolean;

    /**
     * ID аугментации (если применимо)
     */
    augmentationId?: number;

    /**
     * Дополнительные данные предмета
     */
    customType1?: number;
    customType2?: number;
}

/**
 * Интерфейс для изменения предмета в пакете InventoryUpdate
 */
export interface L2ItemChange {
    /** Объект изменённого предмета */
    item: L2Item;
    
    /** Тип изменения */
    changeType: 'added' | 'modified' | 'removed';
    
    /** Предыдущее количество (для modified) */
    oldCount?: number;
    
    /** Новое количество (для modified) */
    newCount?: number;
}

/**
 * Полный набор данных инвентаря для UI
 */
export interface L2InventoryData {
    /** Список всех предметов */
    items: L2Item[];
    
    /** Количество адены */
    adena: number;
    
    /** Вес инвентаря */
    weight: {
        current: number;
        max: number;
    };
    
    /** Экипированные предметы по слотам */
    equipment: Partial<Record<L2EquipmentSlot, L2Item>>;
    
    /** Timestamp последнего обновления */
    lastUpdated: number;
}

/** Слоты экипировки */
export type L2EquipmentSlot = 
    | 'HEAD'      // Шлем
    | 'NECK'      // Ожерелье
    | 'REAR'      // Правая серьга
    | 'LEAR'      // Левая серьга
    | 'RHAND'     // Оружие (правая рука)
    | 'LHAND'     // Щит (левая рука)
    | 'GLOVES'    // Перчатки
    | 'CHEST'     // Верхняя броня
    | 'LEGS'      // Штаны
    | 'FEET'      // Ботинки
    | 'BACK'      // Плащ
    | 'FACE'      // Маска/лицо
    | 'HAIR'      // Причёска
    | 'HAIRALL'   // Полная причёска
    | 'UNDER';    // Нижнее бельё

/** Битовые маски слотов экипировки */
export const SLOT_MASKS: Record<L2EquipmentSlot, number> = {
    UNDER: 0x0001,
    HEAD: 0x0002,
    FACE: 0x0004,
    HAIR: 0x0008,
    NECK: 0x0010,
    REAR: 0x0020,
    LEAR: 0x0040,
    RHAND: 0x0080,
    LHAND: 0x0100,
    GLOVES: 0x0200,
    CHEST: 0x0400,
    LEGS: 0x0800,
    FEET: 0x1000,
    BACK: 0x2000,
    HAIRALL: 0x4000,
} as const;

/**
 * Получает слот экипировки по битовой маске
 */
export function getSlotByMask(mask: number): L2EquipmentSlot | null {
    for (const [slot, slotMask] of Object.entries(SLOT_MASKS)) {
        if (slotMask === mask) {
            return slot as L2EquipmentSlot;
        }
    }
    return null;
}

/**
 * Определяет тип предмета по его ID
 */
export function getItemTypeById(itemId: number): L2ItemType {
    // Оружие: обычно 1-2999
    if (itemId >= 1 && itemId < 3000) return 'weapon';
    
    // Броня: обычно 3000-5999
    if (itemId >= 3000 && itemId < 6000) return 'armor';
    
    // Расходники: обычно 6000-7999
    if (itemId >= 6000 && itemId < 8000) return 'consumable';
    
    // Материалы: обычно 8000-9999
    if (itemId >= 8000 && itemId < 10000) return 'material';
    
    // Квестовые предметы: обычно 10000+
    if (itemId >= 10000) return 'quest';
    
    return 'etc';
}

/**
 * Форматирует имя предмета с заточкой
 */
export function formatItemName(item: L2Item): string {
    const enchantPrefix = item.enchant > 0 ? `+${item.enchant} ` : '';
    const name = item.name || `Item #${item.itemId}`;
    return `${enchantPrefix}${name}`;
}

/**
 * Проверяет, является ли предмет экипированным
 */
export function isItemEquipped(item: L2Item): boolean {
    return item.equipped || item.location !== undefined && item.location > 0;
}

/**
 * Создаёт пустой объект инвентаря
 */
export function createEmptyInventory(): L2InventoryData {
    return {
        items: [],
        adena: 0,
        weight: { current: 0, max: 0 },
        equipment: {},
        lastUpdated: Date.now(),
    };
}
