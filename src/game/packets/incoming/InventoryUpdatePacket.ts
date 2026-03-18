/**
 * src/game/packets/incoming/InventoryUpdatePacket.ts
 * 
 * InventoryUpdate (0x19) - Server to Client
 * Обновление инвентаря (добавление, удаление, изменение предметов)
 * 
 * Structure (L2J Mobius Interlude Protocol 746):
 * - count (int32) - количество изменённых предметов
 * - For each item change:
 *   - objectId (int32) - уникальный ID предмета
 *   - itemId (int32) - ID типа предмета
 *   - location (int32) - 0 = инвентарь, 1+ = экипировано
 *   - slot (int32) - битовая маска слота
 *   - enchantLevel (int16) - уровень заточки
 *   - count (int64) - количество
 *   - customType1 (int32)
 *   - customType2 (int32)
 *   - augmentationId (int32)
 *   - mana (int32)
 *   - changeType (int32) - тип изменения:
 *     - 1 = ADDED (новый предмет)
 *     - 2 = MODIFIED (изменено количество или состояние)
 *     - 3 = REMOVED (предмет удалён)
 */

import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';
import { Logger } from '../../../logger/Logger';
import type { InventoryItem } from '../../../core/GameStateStore';

/** Типы изменений предметов */
export enum InventoryChangeType {
    ADDED = 1,      // Новый предмет добавлен
    MODIFIED = 2,   // Предмет изменён (количество, заточка и т.д.)
    REMOVED = 3,    // Предмет удалён
}

/** Интерфейс изменения предмета */
export interface ItemChange {
    objectId: number;
    itemId: number;
    location: number;
    slot: number;
    enchantLevel: number;
    count: number;
    customType1: number;
    customType2: number;
    augmentationId: number;
    mana: number;
    changeType: InventoryChangeType;
}

export class InventoryUpdatePacket implements IncomingGamePacket {
    public changes: ItemChange[] = [];
    public added: ItemChange[] = [];
    public modified: ItemChange[] = [];
    public removed: ItemChange[] = [];

    decode(reader: PacketReader): this {
        try {
            // Пропускаем опкод (0x19)
            reader.readUInt8();

            // Читаем количество изменений
            const count = reader.readInt32LE();
            Logger.debug('InventoryUpdatePacket', `Received ${count} item changes`);

            this.changes = [];
            this.added = [];
            this.modified = [];
            this.removed = [];

            // Читаем каждое изменение
            for (let i = 0; i < count && reader.remaining() >= 40; i++) {
                const change: ItemChange = {
                    objectId: reader.readInt32LE(),
                    itemId: reader.readInt32LE(),
                    location: reader.readInt32LE(),
                    slot: reader.readInt32LE(),
                    enchantLevel: reader.readUInt16LE(),
                    count: Number(reader.readInt64LE()),
                    customType1: reader.readInt32LE(),
                    customType2: reader.readInt32LE(),
                    augmentationId: reader.readInt32LE(),
                    mana: reader.readInt32LE(),
                    changeType: reader.readInt32LE() as InventoryChangeType,
                };

                this.changes.push(change);

                // Сортируем по типу изменения
                switch (change.changeType) {
                    case InventoryChangeType.ADDED:
                        this.added.push(change);
                        break;
                    case InventoryChangeType.MODIFIED:
                        this.modified.push(change);
                        break;
                    case InventoryChangeType.REMOVED:
                        this.removed.push(change);
                        break;
                }

                Logger.debug('InventoryUpdatePacket', 
                    `Change [${InventoryChangeType[change.changeType]}]: ` +
                    `ObjectID=${change.objectId}, ItemID=${change.itemId}, ` +
                    `Count=${change.count}, Enchant=+${change.enchantLevel}`
                );
            }

            // Применяем изменения к GameStateStore
            this.applyChanges();

            Logger.info('InventoryUpdatePacket', 
                `Applied: +${this.added.length} added, ~${this.modified.length} modified, -${this.removed.length} removed`
            );

        } catch (error) {
            Logger.error('InventoryUpdatePacket', `Decode error: ${error}`);
        }

        return this;
    }

    /**
     * Применяет изменения к инвентарю в GameStateStore
     */
    private applyChanges(): void {
        const currentInventory = GameStateStore.getInventory();
        let items = [...(currentInventory.items || [])];

        // Обрабатываем удалённые предметы
        for (const change of this.removed) {
            const index = items.findIndex(item => item.objectId === change.objectId);
            if (index !== -1) {
                const removedItem = items[index];
                items.splice(index, 1);
                
                // Эмитим событие удаления
                EventBus.emitEvent({
                    type: 'inventory.item_removed',
                    channel: 'character',
                    data: {
                        objectId: change.objectId,
                        itemId: change.itemId,
                        name: removedItem.name,
                        slot: change.slot,
                    },
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Обрабатываем добавленные предметы
        for (const change of this.added) {
            const newItem: InventoryItem = {
                objectId: change.objectId,
                itemId: change.itemId,
                name: this.getItemName(change.itemId),
                count: change.count,
                type: this.getItemType(change.itemId),
                equipped: change.location > 0,
                slot: change.slot,
                enchant: change.enchantLevel,
                mana: change.mana,
            };

            items.push(newItem);

            // Эмитим событие добавления
            EventBus.emitEvent({
                type: 'inventory.item_added',
                channel: 'character',
                data: {
                    objectId: change.objectId,
                    itemId: change.itemId,
                    name: newItem.name,
                    count: change.count,
                    slot: change.slot,
                    equipped: change.location > 0,
                    enchant: change.enchantLevel,
                },
                timestamp: new Date().toISOString()
            });
        }

        // Обрабатываем изменённые предметы
        for (const change of this.modified) {
            const index = items.findIndex(item => item.objectId === change.objectId);
            if (index !== -1) {
                const oldItem = items[index];
                const updatedItem: InventoryItem = {
                    ...oldItem,
                    count: change.count,
                    equipped: change.location > 0,
                    slot: change.slot,
                    enchant: change.enchantLevel,
                    mana: change.mana,
                };

                items[index] = updatedItem;

                // Эмитим событие изменения
                EventBus.emitEvent({
                    type: 'inventory.item_modified',
                    channel: 'character',
                    data: {
                        objectId: change.objectId,
                        itemId: change.itemId,
                        name: updatedItem.name,
                        oldCount: oldItem.count,
                        newCount: change.count,
                        oldEnchant: oldItem.enchant,
                        newEnchant: change.enchantLevel,
                        equipped: change.location > 0,
                    },
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Обновляем GameStateStore
        GameStateStore.updateInventory({ items });

        // Эмитим общее событие обновления инвентаря
        EventBus.emitEvent({
            type: 'inventory.updated',
            channel: 'character',
            data: {
                totalItems: items.length,
                added: this.added.length,
                modified: this.modified.length,
                removed: this.removed.length,
                equippedCount: items.filter(i => i.equipped).length,
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Определяет тип предмета по ID
     */
    private getItemType(itemId: number): InventoryItem['type'] {
        if (itemId >= 1 && itemId < 3000) return 'weapon';
        if (itemId >= 3000 && itemId < 6000) return 'armor';
        if (itemId >= 6000 && itemId < 8000) return 'consumable';
        if (itemId >= 8000 && itemId < 10000) return 'material';
        if (itemId >= 10000) return 'quest';
        return 'etc';
    }

    /**
     * Получает имя предмета (заглушка)
     */
    private getItemName(itemId: number): string {
        // TODO: Интеграция с ItemDatabase
        return `Item ${itemId}`;
    }
}
