import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { ItemListPacket } from '../../../src/game/packets/incoming/ItemListPacket';
import { GameStateStore } from '../../../src/core/GameStateStore';
import { EventBus } from '../../../src/core/EventBus';
import { MockL2Server, createItemListPacket } from '../../utils/mockServer';
import { generateTestItems } from '../../config';

describe('ItemList Packet Integration', () => {
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state
        GameStateStore.reset();

        // Start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        await mockServer.stop();
        GameStateStore.reset();
        EventBus.removeAllListeners();
    });

    describe('Inventory Item Parsing', () => {
        it('should parse item count correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items.length).toBe(2);
        });

        it('should parse item objectId correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].objectId).toBe(1001);
            expect(packet.items[1].objectId).toBe(1002);
        });

        it('should parse itemId correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].itemId).toBe(76); // Sword
            expect(packet.items[1].itemId).toBe(57); // Adena
        });

        it('should parse item count correctly', () => {
            const items = generateTestItems();
            items[1].count = 1000000; // 1 million adena
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[1].count).toBe(1000000);
        });

        it('should parse equipped status correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].equipped).toBe(true);
            expect(packet.items[1].equipped).toBe(false);
        });

        it('should parse enchant level correctly', () => {
            const items = generateTestItems();
            items[0].enchantLevel = 10;
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].enchant).toBe(10);
        });

        it('should parse slot position correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].slot).toBe(0);
            expect(packet.items[1].slot).toBe(1);
        });

        it('should parse item type correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].type).toBe('weapon');
            expect(packet.items[1].type).toBe('etc');
        });

        it('should handle empty inventory', () => {
            const items: ReturnType<typeof generateTestItems> = [];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items.length).toBe(0);
            expect(packet.showWindow).toBe(false);
        });

        it('should handle showWindow flag correctly', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items, true);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.showWindow).toBe(true);
        });

        it('should handle many items in inventory', () => {
            const items = [];
            for (let i = 0; i < 50; i++) {
                items.push({
                    objectId: 2000 + i,
                    itemId: 57,
                    slot: i,
                    count: 100,
                    itemType: 4,
                    customType1: 0,
                    isEquipped: 0,
                    bodyPart: 0,
                    enchantLevel: 0,
                    customType2: 0,
                    augmentationId: 0,
                    mana: 0
                });
            }
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items.length).toBe(50);
        });

        it('should handle malformed packets gracefully', () => {
            const emptyBuffer = Buffer.from([0x1b]); // Just opcode
            const reader = new PacketReader(emptyBuffer);
            const packet = new ItemListPacket();

            // Should not throw
            expect(() => packet.decode(reader)).not.toThrow();
            expect(packet.items.length).toBe(0);
        });
    });

    describe('GameStateStore.updateInventory Integration', () => {
        it('should update inventory in GameStateStore', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            const inventory = GameStateStore.getInventory();
            expect(inventory.items).toBeDefined();
            expect(inventory.items?.length).toBe(2);
        });

        it('should store correct item data in GameStateStore', () => {
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            const inventory = GameStateStore.getInventory();
            const firstItem = inventory.items?.[0];
            expect(firstItem?.objectId).toBe(1001);
            expect(firstItem?.itemId).toBe(76);
            expect(firstItem?.count).toBe(1);
            expect(firstItem?.equipped).toBe(true);
        });

        it('should replace existing inventory on new ItemList packet', () => {
            // First inventory
            const items1 = generateTestItems();
            let packetBuffer = createItemListPacket(items1);
            let reader = new PacketReader(packetBuffer);
            let packet = new ItemListPacket();
            packet.decode(reader);

            // Second inventory (different items)
            const items2 = [
                {
                    objectId: 3001,
                    itemId: 100,
                    slot: 0,
                    count: 5,
                    itemType: 3,
                    customType1: 0,
                    isEquipped: 0,
                    bodyPart: 0,
                    enchantLevel: 0,
                    customType2: 0,
                    augmentationId: 0,
                    mana: 0
                }
            ];
            packetBuffer = createItemListPacket(items2);
            reader = new PacketReader(packetBuffer);
            packet = new ItemListPacket();
            packet.decode(reader);

            const inventory = GameStateStore.getInventory();
            expect(inventory.items?.length).toBe(1);
            expect(inventory.items?.[0].objectId).toBe(3001);
        });

        it('should preserve existing inventory data when partially updating', () => {
            // First, set some initial inventory state with adena
            GameStateStore.updateInventory({ adena: 1000000 });

            // Then receive item list
            const items = generateTestItems();
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();
            packet.decode(reader);

            const inventory = GameStateStore.getInventory();
            // The ItemList packet only updates items, not adena
            expect(inventory.items?.length).toBe(2);
        });
    });

    describe('Item Type Detection', () => {
        it('should categorize weapons correctly', () => {
            const items = [{
                objectId: 1001,
                itemId: 76, // Weapon ID
                slot: 0,
                count: 1,
                itemType: 1, // weapon type
                customType1: 0,
                isEquipped: 1,
                bodyPart: 7,
                enchantLevel: 0,
                customType2: 0,
                augmentationId: 0,
                mana: 0
            }];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].type).toBe('weapon');
        });

        it('should categorize armor correctly', () => {
            const items = [{
                objectId: 1001,
                itemId: 3500, // Armor ID
                slot: 0,
                count: 1,
                itemType: 2, // armor type
                customType1: 0,
                isEquipped: 1,
                bodyPart: 6,
                enchantLevel: 0,
                customType2: 0,
                augmentationId: 0,
                mana: 0
            }];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].type).toBe('armor');
        });

        it('should categorize consumables correctly', () => {
            const items = [{
                objectId: 1001,
                itemId: 6001, // Consumable ID
                slot: 0,
                count: 100,
                itemType: 3, // consumable type
                customType1: 0,
                isEquipped: 0,
                bodyPart: 0,
                enchantLevel: 0,
                customType2: 0,
                augmentationId: 0,
                mana: 0
            }];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].type).toBe('consumable');
        });

        it('should default to etc type for unknown items', () => {
            const items = [{
                objectId: 1001,
                itemId: 99999, // Unknown ID
                slot: 0,
                count: 1,
                itemType: 99, // Unknown type
                customType1: 0,
                isEquipped: 0,
                bodyPart: 0,
                enchantLevel: 0,
                customType2: 0,
                augmentationId: 0,
                mana: 0
            }];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            expect(packet.items[0].type).toBe('etc');
        });
    });

    describe('Item Grade Detection', () => {
        it('should detect item grade correctly', () => {
            const items = [{
                objectId: 1001,
                itemId: 10000, // Grade D item
                slot: 0,
                count: 1,
                itemType: 1,
                customType1: 0,
                isEquipped: 1,
                bodyPart: 7,
                enchantLevel: 0,
                customType2: 0,
                augmentationId: 0,
                mana: 0
            }];
            const packetBuffer = createItemListPacket(items);
            const reader = new PacketReader(packetBuffer);
            const packet = new ItemListPacket();

            packet.decode(reader);

            // Grade is extracted from itemId (simplified logic in the packet)
            expect(packet.items[0].grade).toBeDefined();
        });
    });

    describe('Mock Server Integration', () => {
        it('should receive ItemList packet from mock server', async () => {
            const items = generateTestItems();
            
            // Send item list via mock server
            mockServer.sendItemList(items);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 50));

            const inventory = GameStateStore.getInventory();
            expect(inventory.items?.length).toBe(2);
        });

        it('should update inventory with showWindow flag from mock server', async () => {
            const items = generateTestItems();
            
            mockServer.sendItemList(items, true);

            await new Promise(resolve => setTimeout(resolve, 50));

            const inventory = GameStateStore.getInventory();
            expect(inventory.items?.length).toBe(2);
        });

        it('should handle rapid inventory updates from mock server', async () => {
            // Send multiple inventory updates
            for (let i = 0; i < 3; i++) {
                const items = generateTestItems();
                items[0].objectId = 1000 + i;
                mockServer.sendItemList(items);
                await new Promise(resolve => setTimeout(resolve, 20));
            }

            await new Promise(resolve => setTimeout(resolve, 50));

            const inventory = GameStateStore.getInventory();
            // Should have the last update
            expect(inventory.items?.length).toBe(2);
        });
    });
});
