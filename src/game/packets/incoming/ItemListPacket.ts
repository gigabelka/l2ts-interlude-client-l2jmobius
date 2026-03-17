import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore, InventoryItem } from '../../../core/GameStateStore';

/**
 * ItemList (0x1B) - Full inventory list
 * 
 * Structure (Interlude):
 * - showWindow (uint16) - Show inventory window flag
 * - itemCount (uint16) - Number of items
 * - For each item:
 *   - objectId (int32)
 *   - itemId (int32)
 *   - slot (int32) - Inventory slot position
 *   - count (int32)
 *   - itemType (int32) - Item type/category
 *   - customType1 (int32)
 *   - isEquipped (int32) - 1 if equipped, 0 otherwise
 *   - bodyPart (int32) - Body part slot
 *   - enchantLevel (int16) - Enchant level
 *   - customType2 (int16)
 *   - augmentationId (int32)
 *   - mana (int32) - Shadow item mana
 */
export class ItemListPacket implements IncomingGamePacket {
    public showWindow: boolean = false;
    public items: InventoryItem[] = [];

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x1B
            
            this.showWindow = reader.readUInt16LE() !== 0;
            const itemCount = reader.readUInt16LE();
            
            this.items = [];
            
            for (let i = 0; i < itemCount && reader.remaining() >= 40; i++) {
                const objectId = reader.readInt32LE();
                const itemId = reader.readInt32LE();
                const slot = reader.readInt32LE();
                const count = reader.readInt32LE();
                const itemType = reader.readInt32LE();
                const customType1 = reader.readInt32LE();
                const isEquipped = reader.readInt32LE() !== 0;
                const bodyPart = reader.readInt32LE();
                const enchantLevel = reader.readInt32LE(); // Using int32 for compatibility
                const customType2 = reader.readInt32LE();
                const augmentationId = reader.readInt32LE();
                const mana = reader.readInt32LE();

                this.items.push({
                    objectId,
                    itemId,
                    name: `Item ${itemId}`, // TODO: Get from item database
                    count,
                    type: this.getItemType(itemId, itemType),
                    equipped: isEquipped,
                    slot,
                    enchant: enchantLevel,
                    mana,
                    grade: this.getItemGrade(itemId)
                });
            }

            // Update GameStateStore
            GameStateStore.updateInventory({
                items: this.items
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }

    private getItemType(itemId: number, itemType: number): InventoryItem['type'] {
        // Simple categorization based on item ID ranges or type
        // These ranges are approximate for Interlude
        if (itemId >= 1 && itemId <= 10000) {
            // Weapons
            if (itemId >= 1 && itemId <= 3000) return 'weapon';
            // Armors
            if (itemId >= 3000 && itemId <= 6000) return 'armor';
            // Consumables
            if (itemId >= 6000 && itemId <= 8000) return 'consumable';
        }
        
        // Based on type field
        if (itemType === 1) return 'weapon';
        if (itemType === 2) return 'armor';
        if (itemType === 3) return 'consumable';
        if (itemType === 4) return 'material';
        if (itemType === 5) return 'quest';
        
        return 'etc';
    }

    private getItemGrade(itemId: number): InventoryItem['grade'] {
        // Simple grade detection based on item ID suffixes
        // This is a placeholder - real implementation would use item database
        const gradeMap: Record<number, InventoryItem['grade']> = {
            0: 'No',
            1: 'D',
            2: 'C',
            3: 'B',
            4: 'A',
            5: 'S'
        };
        
        // Extract grade from itemId (this is simplified)
        const gradeId = Math.floor((itemId % 100000) / 10000);
        return gradeMap[gradeId] || 'No';
    }
}
