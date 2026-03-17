import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { NpcInfoPacket } from '../../../src/game/packets/incoming/NpcInfoPacket';
import { GameStateStore } from '../../../src/core/GameStateStore';
import { EventBus } from '../../../src/core/EventBus';
import { MockL2Server, createNpcInfoPacket } from '../../utils/mockServer';
import { generateTestNpc } from '../../config';

describe('NpcInfo Packet Integration', () => {
    let mockServer: MockL2Server;
    let receivedEvents: Array<{ type: string; data: unknown }> = [];

    beforeEach(async () => {
        // Reset state
        GameStateStore.reset();
        receivedEvents = [];

        // Capture all events
        EventBus.onAny((event) => {
            receivedEvents.push({ type: event.type, data: event.data });
        });

        // Start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        await mockServer.stop();
        GameStateStore.reset();
        EventBus.removeAllListeners();
    });

    describe('NPC Data Parsing', () => {
        it('should parse objectId correctly', () => {
            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            expect(packet.objectId).toBe(12345);
        });

        it('should parse npcId correctly', () => {
            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            expect(packet.npcId).toBe(20101);
        });

        it('should parse position correctly', () => {
            const testData = generateTestNpc(12345, 20101);
            testData.x = 50000;
            testData.y = 100000;
            testData.z = -2000;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            expect(packet.x).toBe(50000);
            expect(packet.y).toBe(100000);
            expect(packet.z).toBe(-2000);
        });

        it('should parse isAttackable flag correctly', () => {
            const testData = generateTestNpc(12345, 20101);
            testData.isAttackable = 0;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            expect(packet.isAttackable).toBe(false);
        });

        it('should parse heading correctly', () => {
            const testData = generateTestNpc(12345, 20101);
            testData.heading = 180;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            expect(packet.heading).toBe(180);
        });

        it('should handle empty or malformed packets gracefully', () => {
            const emptyBuffer = Buffer.from([0x16]); // Just opcode
            const reader = new PacketReader(emptyBuffer);
            const packet = new NpcInfoPacket();

            // Should not throw
            expect(() => packet.decode(reader)).not.toThrow();
        });
    });

    describe('GameStateStore.addNpc Integration', () => {
        it('should add NPC to GameStateStore', () => {
            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            const world = GameStateStore.getWorld();
            expect(world.npcs.has(12345)).toBe(true);
        });

        it('should store NPC data correctly in GameStateStore', () => {
            const testData = generateTestNpc(12345, 20101);
            testData.x = 75000;
            testData.y = 150000;
            testData.z = -3500;
            testData.isAttackable = 1;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            const world = GameStateStore.getWorld();
            const npc = world.npcs.get(12345);
            expect(npc).toBeDefined();
            expect(npc?.objectId).toBe(12345);
            expect(npc?.npcId).toBe(20101);
            expect(npc?.position.x).toBe(75000);
            expect(npc?.position.y).toBe(150000);
            expect(npc?.position.z).toBe(-3500);
            expect(npc?.isAttackable).toBe(true);
        });

        it('should update existing NPC when same objectId is received', () => {
            // First spawn
            const testData1 = generateTestNpc(12345, 20101);
            testData1.x = 100000;
            let packetBuffer = createNpcInfoPacket(testData1);
            let reader = new PacketReader(packetBuffer);
            let packet = new NpcInfoPacket();
            packet.decode(reader);

            // Second spawn with same objectId but different position
            const testData2 = generateTestNpc(12345, 20101);
            testData2.x = 200000;
            packetBuffer = createNpcInfoPacket(testData2);
            reader = new PacketReader(packetBuffer);
            packet = new NpcInfoPacket();
            packet.decode(reader);

            const world = GameStateStore.getWorld();
            const npc = world.npcs.get(12345);
            expect(npc?.position.x).toBe(200000);
        });

        it('should store multiple NPCs with different objectIds', () => {
            // Spawn first NPC
            const testData1 = generateTestNpc(12345, 20101);
            let packetBuffer = createNpcInfoPacket(testData1);
            let reader = new PacketReader(packetBuffer);
            let packet = new NpcInfoPacket();
            packet.decode(reader);

            // Spawn second NPC
            const testData2 = generateTestNpc(12346, 20102);
            packetBuffer = createNpcInfoPacket(testData2);
            reader = new PacketReader(packetBuffer);
            packet = new NpcInfoPacket();
            packet.decode(reader);

            const world = GameStateStore.getWorld();
            expect(world.npcs.size).toBe(2);
            expect(world.npcs.has(12345)).toBe(true);
            expect(world.npcs.has(12346)).toBe(true);
        });

        it('should set default HP values for spawned NPCs', () => {
            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            const world = GameStateStore.getWorld();
            const npc = world.npcs.get(12345);
            expect(npc?.hp.current).toBe(100);
            expect(npc?.hp.max).toBe(100);
        });
    });

    describe('world.npc_spawned Event', () => {
        it('should emit world.npc_spawned event when NPC is added', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('world.npc_spawned', (event) => {
                events.push(event);
            });

            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(events.length).toBe(1);
            const spawnEvent = events[0] as { data: { objectId: number; npcId: number } };
            expect(spawnEvent.data.objectId).toBe(12345);
            expect(spawnEvent.data.npcId).toBe(20101);
        });

        it('should include NPC position in spawn event', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('world.npc_spawned', (event) => {
                events.push(event);
            });

            const testData = generateTestNpc(12345, 20101);
            testData.x = 80000;
            testData.y = 160000;
            testData.z = -4000;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            const spawnEvent = events[0] as { data: { position: { x: number; y: number; z: number } } };
            expect(spawnEvent.data.position.x).toBe(80000);
            expect(spawnEvent.data.position.y).toBe(160000);
            expect(spawnEvent.data.position.z).toBe(-4000);
        });

        it('should include isAttackable in spawn event', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('world.npc_spawned', (event) => {
                events.push(event);
            });

            const testData = generateTestNpc(12345, 20101);
            testData.isAttackable = 1;
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            const spawnEvent = events[0] as { data: { isAttackable: boolean } };
            expect(spawnEvent.data.isAttackable).toBe(true);
        });

        it('should emit event for each NPC spawn', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('world.npc_spawned', (event) => {
                events.push(event);
            });

            // Spawn multiple NPCs
            for (let i = 0; i < 5; i++) {
                const testData = generateTestNpc(10000 + i, 20000 + i);
                const packetBuffer = createNpcInfoPacket(testData);
                const reader = new PacketReader(packetBuffer);
                const packet = new NpcInfoPacket();
                packet.decode(reader);
            }

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(events.length).toBe(5);
        });

        it('should include NPC name in spawn event data', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('world.npc_spawned', (event) => {
                events.push(event);
            });

            const testData = generateTestNpc(12345, 20101);
            const packetBuffer = createNpcInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            const spawnEvent = events[0] as { data: { name: string; level: number } };
            expect(spawnEvent.data.name).toBeDefined();
            expect(spawnEvent.data.level).toBeDefined();
        });
    });

    describe('Mock Server Integration', () => {
        it('should receive NpcInfo packet from mock server', (done) => {
            // Listen for spawn event
            EventBus.onEvent('world.npc_spawned', (event) => {
                if ((event.data as { objectId: number }).objectId === 55555) {
                    done();
                }
            });

            // Spawn NPC via mock server
            mockServer.spawnNpc(55555, 20101, 100000, 200000, -3500);
        });

        it('should add NPC to world state from mock server packet', async () => {
            // Spawn NPC via mock server
            mockServer.spawnNpc(55555, 20101, 100000, 200000, -3500);

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 50));

            const world = GameStateStore.getWorld();
            expect(world.npcs.has(55555)).toBe(true);
        });

        it('should handle rapid NPC spawns', async () => {
            // Spawn multiple NPCs rapidly
            for (let i = 0; i < 10; i++) {
                mockServer.spawnNpc(50000 + i, 20000 + i, 100000 + i * 100, 200000, -3500);
            }

            // Wait for all events to process
            await new Promise(resolve => setTimeout(resolve, 100));

            const world = GameStateStore.getWorld();
            expect(world.npcs.size).toBe(10);
        });
    });
});
