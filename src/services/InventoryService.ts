/**
 * src/services/InventoryService.ts
 * 
 * Сервис для управления инвентарём и синхронизации с UI
 * Предоставляет удобные методы для работы с предметами и экипировкой
 * 
 * Protocol: L2J_Mobius CT_0_Interlude (Protocol 746)
 */

import { GameStateStore } from '../core/GameStateStore';
import { EventBus } from '../core/EventBus';
import { Logger } from '../logger/Logger';
import type { InventoryItem } from '../core/GameStateStore';
import type { L2InventoryData, L2Item, L2EquipmentSlot } from '../models/L2Item';
import { SLOT_MASKS, getSlotByMask, getItemTypeById, formatItemName } from '../models/L2Item';

/**
 * Сервис инвентаря - singleton для управления инвентарём
 */
class InventoryServiceClass {
    private initialized = false;

    /**
     * Инициализация сервиса
     */
    initialize(): void {
        if (this.initialized) return;
        
        // Подписываемся на события инвентаря
        EventBus.onEvent('inventory.changed', (event) => {
            Logger.debug('InventoryService', `Inventory changed: ${JSON.stringify(event.data)}`);
        });

        EventBus.onEvent('inventory.updated', (event) => {
            const totalItems = (event.data as { totalItems?: number }).totalItems;
            Logger.info('InventoryService', `Inventory fully updated: ${totalItems || 0} items`);
        });

        this.initialized = true;
        Logger.info('InventoryService', 'Initialized');
    }

    /**
     * Получает полные данные инвентаря в формате для UI
     */
    getInventoryData(): L2InventoryData {
        const inventory = GameStateStore.getInventory();
        const items: L2Item[] = (inventory.items || []).map(item => this.convertToL2Item(item));
        
        // Формируем экипировку
        const equipment: Partial<Record<L2EquipmentSlot, L2Item>> = {};
        items.filter(i => i.equipped).forEach(item => {
            const slot = getSlotByMask(item.slot);
            if (slot) {
                equipment[slot] = item;
            }
        });

        return {
            items,
            adena: inventory.adena,
            weight: inventory.weight,
            equipment,
            lastUpdated: Date.now(),
        };
    }

    /**
     * Получает предмет по objectId
     */
    getItem(objectId: number): L2Item | undefined {
        const item = GameStateStore.getInventoryItemByObjectId(objectId);
        return item ? this.convertToL2Item(item) : undefined;
    }

    /**
     * Получает предметы по itemId
     */
    getItemsByItemId(itemId: number): L2Item[] {
        const items = GameStateStore.getInventoryItemsByItemId(itemId);
        return items.map(item => this.convertToL2Item(item));
    }

    /**
     * Получает экипированные предметы
     */
    getEquippedItems(): L2Item[] {
        const items = GameStateStore.getEquippedItems();
        return items.map(item => this.convertToL2Item(item));
    }

    /**
     * Получает предмет в конкретном слоте
     */
    getItemInSlot(slot: L2EquipmentSlot): L2Item | undefined {
        const slotMask = SLOT_MASKS[slot];
        const item = GameStateStore.getEquippedItemBySlot(slotMask);
        return item ? this.convertToL2Item(item) : undefined;
    }

    /**
     * Получает адену
     */
    getAdena(): number {
        return GameStateStore.getInventory().adena;
    }

    /**
     * Получает предметы определённого типа
     */
    getItemsByType(type: L2Item['type']): L2Item[] {
        const inventory = GameStateStore.getInventory();
        return (inventory.items || [])
            .filter(item => item.type === type)
            .map(item => this.convertToL2Item(item));
    }

    /**
     * Ищет предметы по имени (частичное совпадение)
     */
    searchItems(nameQuery: string): L2Item[] {
        const inventory = GameStateStore.getInventory();
        const query = nameQuery.toLowerCase();
        return (inventory.items || [])
            .filter(item => item.name?.toLowerCase().includes(query))
            .map(item => this.convertToL2Item(item));
    }

    /**
     * Получает количество предметов определённого типа
     */
    getItemCount(itemId: number): number {
        const items = GameStateStore.getInventoryItemsByItemId(itemId);
        return items.reduce((sum, item) => sum + item.count, 0);
    }

    /**
     * Формирует JSON для передачи в UI (Dashboard)
     */
    getInventoryJson(): string {
        return JSON.stringify(this.getInventoryData());
    }

    /**
     * Формирует компактный JSON для WebSocket
     */
    getCompactInventoryJson(): string {
        const inventory = GameStateStore.getInventory();
        const compact = {
            items: (inventory.items || []).map(item => ({
                oid: item.objectId,
                iid: item.itemId,
                cnt: item.count,
                eq: item.equipped,
                en: item.enchant,
                sl: item.slot,
            })),
            adena: inventory.adena,
            weight: inventory.weight,
            ts: Date.now(),
        };
        return JSON.stringify(compact);
    }

    /**
     * Получает статистику инвентаря
     */
    getInventoryStats(): {
        totalItems: number;
        equippedItems: number;
        adena: number;
        weapons: number;
        armor: number;
        consumables: number;
        materials: number;
        questItems: number;
        weightPercent: number;
    } {
        const inventory = GameStateStore.getInventory();
        const items = inventory.items || [];
        const weight = inventory.weight;
        
        return {
            totalItems: items.length,
            equippedItems: items.filter(i => i.equipped).length,
            adena: inventory.adena,
            weapons: items.filter(i => i.type === 'weapon').length,
            armor: items.filter(i => i.type === 'armor').length,
            consumables: items.filter(i => i.type === 'consumable').length,
            materials: items.filter(i => i.type === 'material').length,
            questItems: items.filter(i => i.type === 'quest').length,
            weightPercent: weight.max > 0 ? Math.round((weight.current / weight.max) * 100) : 0,
        };
    }

    /**
     * Конвертирует InventoryItem в L2Item
     */
    private convertToL2Item(item: InventoryItem): L2Item {
        return {
            objectId: item.objectId,
            itemId: item.itemId,
            count: item.count,
            slot: item.slot,
            equipped: item.equipped,
            enchant: item.enchant,
            name: item.name,
            type: item.type,
            grade: item.grade,
            mana: item.mana,
        };
    }

    /**
     * Отправляет полное обновление инвентаря через WebSocket
     */
    broadcastInventoryUpdate(): void {
        const inventory = this.getInventoryData();
        
        EventBus.emitEvent({
            type: 'inventory.updated',
            channel: 'inventory',
            data: {
                ...inventory,
                stats: this.getInventoryStats(),
            },
            timestamp: new Date().toISOString()
        });
    }
}

// Singleton instance
export const InventoryService = new InventoryServiceClass();
