import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PacketReader } from '../../../src/network/PacketReader';
import { UserInfoPacket } from '../../../src/game/packets/incoming/UserInfoPacket';
import { GameStateStore } from '../../../src/core/GameStateStore';
import { EventBus } from '../../../src/core/EventBus';
import { MockL2Server, createUserInfoPacket } from '../../utils/mockServer';
import { generateTestCharacter, TEST_CONFIG } from '../../config';
import { waitForEvent } from '../../setup';

describe('UserInfo Packet Integration', () => {
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

    describe('Character Data Parsing', () => {
        it('should parse character name correctly', () => {
            const testData = generateTestCharacter('TestWarrior');
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.name).toBe('TestWarrior');
        });

        it('should parse character level correctly', () => {
            const testData = generateTestCharacter();
            testData.level = 85;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.level).toBe(85);
        });

        it('should parse character position correctly', () => {
            const testData = generateTestCharacter();
            testData.x = 150000;
            testData.y = 250000;
            testData.z = -4000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.x).toBe(150000);
            expect(packet.y).toBe(250000);
            expect(packet.z).toBe(-4000);
        });

        it('should parse stats correctly', () => {
            const testData = generateTestCharacter();
            testData.str = 45;
            testData.dex = 35;
            testData.con = 50;
            testData.int = 25;
            testData.wit = 15;
            testData.men = 30;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.str).toBe(45);
            expect(packet.dex).toBe(35);
            expect(packet.con).toBe(50);
            expect(packet.int).toBe(25);
            expect(packet.wit).toBe(15);
            expect(packet.men).toBe(30);
        });

        it('should parse HP/MP correctly', () => {
            const testData = generateTestCharacter();
            testData.maxHp = 3000;
            testData.currentHp = 2500;
            testData.maxMp = 1500;
            testData.currentMp = 1200;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.maxHp).toBe(3000);
            expect(packet.currentHp).toBe(2500);
            expect(packet.maxMp).toBe(1500);
            expect(packet.currentMp).toBe(1200);
        });

        it('should parse race and sex correctly', () => {
            const testData = generateTestCharacter();
            testData.race = 2; // Dark Elf
            testData.sex = 1; // Female
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.race).toBe(2);
            expect(packet.sex).toBe(1);
        });

        it('should parse class ID correctly', () => {
            const testData = generateTestCharacter();
            testData.classId = 10; // Paladin
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            expect(packet.classId).toBe(10);
        });

        it('should handle empty or malformed packets gracefully', () => {
            const emptyBuffer = Buffer.from([0x04]); // Just opcode
            const reader = new PacketReader(emptyBuffer);
            const packet = new UserInfoPacket();

            // Should not throw
            expect(() => packet.decode(reader)).not.toThrow();
        });
    });

    describe('GameStateStore Integration', () => {
        it('should update GameStateStore character data', () => {
            const testData = generateTestCharacter('StoreTest');
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            const character = GameStateStore.getCharacter();
            expect(character.name).toBe('StoreTest');
            expect(character.level).toBe(80);
            expect(character.objectId).toBe(12345678);
        });

        it('should update character stats in GameStateStore', () => {
            const testData = generateTestCharacter();
            testData.str = 50;
            testData.dex = 40;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            const character = GameStateStore.getCharacter();
            expect(character.stats?.str).toBe(50);
            expect(character.stats?.dex).toBe(40);
        });

        it('should update character HP/MP in GameStateStore', () => {
            const testData = generateTestCharacter();
            testData.currentHp = 1800;
            testData.maxHp = 2000;
            testData.currentMp = 900;
            testData.maxMp = 1000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            const character = GameStateStore.getCharacter();
            expect(character.hp?.current).toBe(1800);
            expect(character.hp?.max).toBe(2000);
            expect(character.mp?.current).toBe(900);
            expect(character.mp?.max).toBe(1000);
        });

        it('should update character position in GameStateStore', () => {
            const testData = generateTestCharacter();
            testData.x = 50000;
            testData.y = 100000;
            testData.z = -2000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            const character = GameStateStore.getCharacter();
            expect(character.position?.x).toBe(50000);
            expect(character.position?.y).toBe(100000);
            expect(character.position?.z).toBe(-2000);
        });

        it('should calculate and store exp percentage', () => {
            const testData = generateTestCharacter();
            testData.level = 40;
            testData.exp = 500000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            const character = GameStateStore.getCharacter();
            expect(character.exp).toBe(500000);
            expect(character.expPercent).toBeGreaterThanOrEqual(0);
            expect(character.expPercent).toBeLessThanOrEqual(100);
        });
    });

    describe('EventBus Event Emission', () => {
        it('should emit character.stats_changed event on HP change', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('character.stats_changed', (event) => {
                events.push(event);
            });

            const testData = generateTestCharacter();
            testData.currentHp = 1500;
            testData.maxHp = 2000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            // Wait a bit for async event emission
            await new Promise(resolve => setTimeout(resolve, 10));

            const statsEvent = events.find(e => (e as { data?: { hp?: unknown } }).data?.hp);
            expect(statsEvent).toBeDefined();
            expect((statsEvent as { data: { hp: { current: number; max: number } } }).data.hp.current).toBe(1500);
            expect((statsEvent as { data: { hp: { current: number; max: number } } }).data.hp.max).toBe(2000);
        });

        it('should emit movement.position_changed event', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('movement.position_changed', (event) => {
                events.push(event);
            });

            const testData = generateTestCharacter();
            testData.x = 75000;
            testData.y = 125000;
            testData.z = -3000;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            const posEvent = events.find(e => (e as { data?: { position?: unknown } }).data?.position);
            expect(posEvent).toBeDefined();
            expect((posEvent as { data: { position: { x: number; y: number; z: number } } }).data.position.x).toBe(75000);
        });

        it('should emit multiple stat changes when multiple stats update', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('character.stats_changed', (event) => {
                events.push(event);
            });

            const testData = generateTestCharacter();
            testData.currentHp = 1000;
            testData.currentMp = 500;
            testData.currentCp = 800;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();

            packet.decode(reader);

            await new Promise(resolve => setTimeout(resolve, 10));

            const statsEvent = events[events.length - 1] as { data: { hp?: unknown; mp?: unknown; cp?: unknown } };
            expect(statsEvent.data.hp).toBeDefined();
            expect(statsEvent.data.mp).toBeDefined();
        });
    });

    describe('Mock Server Integration', () => {
        it('should receive UserInfo packet from mock server', (done) => {
            const testData = generateTestCharacter('MockTest');
            
            // Listen for packet on EventBus
            EventBus.onEvent('character.stats_changed', () => {
                const character = GameStateStore.getCharacter();
                if (character.name === 'MockTest') {
                    done();
                }
            });

            // Send packet via mock server
            mockServer.sendUserInfo(testData);
        });

        it('should handle rapid UserInfo updates', async () => {
            const testData = generateTestCharacter('RapidTest');
            
            // Send multiple updates
            for (let i = 0; i < 5; i++) {
                testData.currentHp = 1000 + i * 100;
                mockServer.sendUserInfo(testData);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const character = GameStateStore.getCharacter();
            expect(character.hp?.current).toBe(1400);
        });
    });
});
