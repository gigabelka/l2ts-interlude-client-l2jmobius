/**
 * src/game/packets/incoming/ItemListPacket.ts
 * 
 * ItemList (0x1B) - Server to Client
 * Полный список инвентаря и экипировки
 * 
 * Structure (L2J Mobius Interlude Protocol 746):
 * - showWindow (uint8) - флаг показа окна инвентаря
 * - count (int32) - количество предметов
 * - For each item:
 *   - objectId (int32)
 *   - itemId (int32)
 *   - location (int32) - 0 = инвентарь, 1+ = экипировано
 *   - slot (int32) - битовая маска слота (для экипировки)
 *   - enchantLevel (int16)
 *   - count (int64) - количество
 *   - customType1 (int32)
 *   - augmented (uint8) - 0 или 1 (boolean)
 *   - mana (int32)
 */

import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore, type InventoryItem } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';
import { Logger } from '../../../logger/Logger';

/** Битовые маски слотов экипировки */
const SLOT_MASKS = {
    HEAD: 0x0002,
    NECK: 0x0010,
    REAR_LEAR: 0x0020,
    RHAND: 0x0040,
    LHAND: 0x0080,
    GLOVES: 0x0100,
    CHEST: 0x0200,
    LEGS: 0x0400,
    FEET: 0x0800,
    BACK: 0x1000,
} as const;

/** Тип слота экипировки */
type EquipmentSlot = keyof typeof SLOT_MASKS;

/** Предмет экипировки */
interface EquipmentItem {
    slot: EquipmentSlot;
    objectId: number;
    itemId: number;
    enchantLevel: number;
}

export class ItemListPacket implements IncomingGamePacket {
    public showWindow: boolean = false;
    public items: InventoryItem[] = [];
    public equipment: Map<EquipmentSlot, EquipmentItem> = new Map();

    decode(reader: PacketReader): this {
        try {
            // Hex dump для отладки
            Logger.hexDump('ItemListPacket RAW', reader.getBuffer());
            
            // Пропускаем опкод (0x1B)
            reader.readUInt8();

            // Читаем флаг показа окна (uint16 по спеке L2J)
            this.showWindow = reader.readUInt16LE() !== 0;

            // Читаем количество предметов (uint16)
            const count = reader.readUInt16LE();
            Logger.info('ItemListPacket', `Server reports ${count} items, showWindow=${this.showWindow}, remaining=${reader.remaining()} bytes`);

            const parsedItems: InventoryItem[] = [];
            this.equipment.clear();

            // Читаем предметы (структура L2J Mobius Interlude)
            for (let i = 0; i < count && reader.remaining() >= 48; i++) {
                const objectId = reader.readInt32LE();
                const itemId = reader.readInt32LE();
                const slot = reader.readInt32LE();
                const itemCount = reader.readInt32LE();
                const itemType = reader.readInt32LE();
                const customType1 = reader.readInt32LE();
                const isEquipped = reader.readInt32LE() !== 0;
                const bodyPart = reader.readInt32LE();
                const enchantLevel = reader.readInt32LE();
                const customType2 = reader.readInt32LE();
                const augmentationId = reader.readInt32LE();
                const mana = reader.readInt32LE();

                // Определяем тип предмета
                const inventoryItemType = this.getItemType(itemId, itemType);

                // Создаем объект предмета
                const item: InventoryItem = {
                    objectId,
                    itemId,
                    name: this.getItemName(itemId),
                    count: itemCount,
                    type: inventoryItemType,
                    equipped: isEquipped,
                    slot: bodyPart,
                    enchant: enchantLevel,
                    mana,
                };

                parsedItems.push(item);

                // Если предмет экипирован - добавляем в equipment
                if (isEquipped) {
                    const slotKey = this.getSlotKeyByMask(bodyPart);
                    if (slotKey) {
                        this.equipment.set(slotKey, {
                            slot: slotKey,
                            objectId,
                            itemId,
                            enchantLevel,
                        });
                        Logger.debug('ItemListPacket', `Equipped [${slotKey}]: ItemID=${itemId} (+${enchantLevel})`);
                    }
                }
            }

            this.items = parsedItems;
            Logger.info('ItemListPacket', `Loaded ${parsedItems.length} items (${this.equipment.size} equipped)`);

            // Обновляем GameStateStore
            GameStateStore.updateInventory({
                items: parsedItems,
            });

            // Эмитим событие полного обновления инвентаря
            EventBus.emitEvent({
                type: 'inventory.updated',
                channel: 'inventory',
                data: {
                    totalItems: parsedItems.length,
                    equippedCount: this.equipment.size,
                    isFullUpdate: true,
                },
                timestamp: new Date().toISOString()
            });

            // Выводим экипировку в лог
            this.logEquipment();

        } catch (error) {
            Logger.error('ItemListPacket', `Decode error: ${error}`);
        }

        return this;
    }

    /**
     * Получает ключ слота по битовой маске
     */
    private getSlotKeyByMask(slotMask: number): EquipmentSlot | null {
        for (const [key, mask] of Object.entries(SLOT_MASKS)) {
            if (mask === slotMask) {
                return key as EquipmentSlot;
            }
        }
        return null;
    }

    /**
     * Определяет тип предмета по ID и типу из пакета
     */
    private getItemType(itemId: number, itemType: number): InventoryItem['type'] {
        // Сначала проверяем тип из пакета
        if (itemType === 1) return 'weapon';
        if (itemType === 2) return 'armor';
        if (itemType === 3) return 'consumable';
        if (itemType === 4) return 'material';
        if (itemType === 5) return 'quest';
        
        // Fallback на диапазоны itemId
        if (itemId >= 1 && itemId < 3000) return 'weapon';
        if (itemId >= 3000 && itemId < 6000) return 'armor';
        if (itemId >= 6000 && itemId < 8000) return 'consumable';
        if (itemId >= 8000 && itemId < 10000) return 'material';
        if (itemId >= 10000) return 'quest';
        return 'etc';
    }

    /**
     * Получает имя предмета (заглушка - в будущем можно добавить БД предметов)
     */
    private getItemName(itemId: number): string {
        // TODO: Добавить загрузку имен из ItemName-e.dat
        return `Item ${itemId}`;
    }

    /**
     * Выводит экипировку в лог
     */
    private logEquipment(): void {
        if (this.equipment.size === 0) {
            Logger.info('ItemListPacket', 'No equipment equipped');
            return;
        }

        Logger.info('ItemListPacket', '=== EQUIPMENT ===');
        for (const [slot, item] of this.equipment) {
            const enchantStr = item.enchantLevel > 0 ? ` (+${item.enchantLevel})` : '';
            Logger.info('ItemListPacket', `[${slot}] ItemID: ${item.itemId}${enchantStr}`);
        }
    }
}
