import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import { GameStateStore } from '../../../src/core/GameStateStore';
import { EventBus } from '../../../src/core/EventBus';
import { MockL2Server } from '../../utils/mockServer';
import { generateTestCharacter, generateTestNpc } from '../../config';
import { PacketReader } from '../../../src/network/PacketReader';
import { UserInfoPacket } from '../../../src/game/packets/incoming/UserInfoPacket';
import { NpcInfoPacket } from '../../../src/game/packets/incoming/NpcInfoPacket';
import { createUserInfoPacket, createNpcInfoPacket } from '../../utils/mockServer';
import { GameCommandManager } from '../../../src/game/GameCommandManager';

// Import routes directly for testing
import combatRouter from '../../../src/api/routes/combat';
import targetRouter from '../../../src/api/routes/target';
import { requestIdMiddleware } from '../../../src/api/middleware/requestId';

describe('Combat API Integration', () => {
    let app: Application;
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state
        GameStateStore.reset();
        EventBus.removeAllListeners();
        GameCommandManager.setGameClient(null);

        // Create express app for testing
        app = express();
        app.use(express.json());
        app.use(requestIdMiddleware);
        
        // Mount the combat routes
        app.use('/api/v1/combat', combatRouter);
        app.use('/api/v1/target', targetRouter);

        // Start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        await mockServer.stop();
        GameStateStore.reset();
        EventBus.removeAllListeners();
        GameCommandManager.setGameClient(null);
    });

    describe('POST /api/v1/combat/attack', () => {
        it('should return 400 when no target is set', async () => {
            const response = await request(app)
                .post('/api/v1/combat/attack')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('INVALID_TARGET');
        });

        it('should return 503 when not in game', async () => {
            // Set target without being in game
            GameStateStore.setTarget(12345, 'TestTarget', 'NPC');

            const response = await request(app)
                .post('/api/v1/combat/attack')
                .send({})
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('COMMAND_FAILED');
        });

        it('should accept attack request with objectId in body', async () => {
            // First enter game
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            // Simulate being in game by setting connection state
            GameStateStore.updateConnection({ phase: 'IN_GAME' });

            // Mock game client for command manager
            const mockSendPacket = vi.fn();
            const mockClient = {
                sendPacket: mockSendPacket,
                isConnected: () => true
            };
            GameCommandManager.setGameClient(mockClient as unknown as import('../../../src/game/GameClient').GameClient);

            const response = await request(app)
                .post('/api/v1/combat/attack')
                .send({ objectId: 12345, shiftClick: false })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.targetId).toBe(12345);
            expect(response.body.data.shiftClick).toBe(false);
        });

        it('should use current target when objectId not provided', async () => {
            // First enter game
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            GameStateStore.updateConnection({ phase: 'IN_GAME' });
            GameStateStore.setTarget(99999, 'CurrentTarget', 'NPC');

            // Mock game client
            const mockSendPacket = vi.fn();
            const mockClient = {
                sendPacket: mockSendPacket,
                isConnected: () => true
            };
            GameCommandManager.setGameClient(mockClient as unknown as import('../../../src/game/GameClient').GameClient);

            const response = await request(app)
                .post('/api/v1/combat/attack')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.targetId).toBe(99999);
        });

        it('should handle shift click parameter', async () => {
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            GameStateStore.updateConnection({ phase: 'IN_GAME' });

            const mockSendPacket = vi.fn();
            const mockClient = {
                sendPacket: mockSendPacket,
                isConnected: () => true
            };
            GameCommandManager.setGameClient(mockClient as unknown as import('../../../src/game/GameClient').GameClient);

            const response = await request(app)
                .post('/api/v1/combat/attack')
                .send({ objectId: 12345, shiftClick: true })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.shiftClick).toBe(true);
        });

        it('should update combat state to inCombat', async () => {
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            GameStateStore.updateConnection({ phase: 'IN_GAME' });

            const mockSendPacket = vi.fn();
            const mockClient = {
                sendPacket: mockSendPacket,
                isConnected: () => true
            };
            GameCommandManager.setGameClient(mockClient as unknown as import('../../../src/game/GameClient').GameClient);

            // Initially not in combat
            expect(GameStateStore.getCombat().inCombat).toBe(false);

            await request(app)
                .post('/api/v1/combat/attack')
                .send({ objectId: 12345 })
                .expect(200);

            // After attack, should be in combat
            expect(GameStateStore.getCombat().inCombat).toBe(true);
        });
    });

    describe('POST /api/v1/combat/stop', () => {
        it('should stop combat and return success', async () => {
            // Set combat state
            GameStateStore.setInCombat(true);
            expect(GameStateStore.getCombat().inCombat).toBe(true);

            const response = await request(app)
                .post('/api/v1/combat/stop')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('Stop attack command sent');
            expect(GameStateStore.getCombat().inCombat).toBe(false);
        });
    });

    describe('POST /api/v1/target/set', () => {
        it('should set target by objectId', async () => {
            const response = await request(app)
                .post('/api/v1/target/set')
                .send({ objectId: 12345, name: 'TestNPC', type: 'NPC' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.objectId).toBe(12345);
            expect(response.body.data.name).toBe('TestNPC');
            expect(response.body.data.type).toBe('NPC');

            const combat = GameStateStore.getCombat();
            expect(combat.targetObjectId).toBe(12345);
            expect(combat.targetName).toBe('TestNPC');
            expect(combat.targetType).toBe('NPC');
        });

        it('should return 400 for invalid objectId', async () => {
            const response = await request(app)
                .post('/api/v1/target/set')
                .send({ objectId: 'invalid', name: 'TestNPC' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('INVALID_PARAMETER');
        });

        it('should use default type NPC when not specified', async () => {
            const response = await request(app)
                .post('/api/v1/target/set')
                .send({ objectId: 12345, name: 'TestNPC' })
                .expect(200);

            expect(response.body.data.type).toBe('NPC');
        });

        it('should allow PLAYER type targets', async () => {
            const response = await request(app)
                .post('/api/v1/target/set')
                .send({ objectId: 67890, name: 'PlayerName', type: 'PLAYER' })
                .expect(200);

            expect(response.body.data.type).toBe('PLAYER');
            expect(GameStateStore.getCombat().targetType).toBe('PLAYER');
        });
    });

    describe('GET /api/v1/target', () => {
        it('should return null when no target is set', async () => {
            const response = await request(app)
                .get('/api/v1/target')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeNull();
        });

        it('should return current target information', async () => {
            // Set a target
            GameStateStore.setTarget(12345, 'TestTarget', 'NPC');

            const response = await request(app)
                .get('/api/v1/target')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.objectId).toBe(12345);
            expect(response.body.data.name).toBe('TestTarget');
            expect(response.body.data.type).toBe('NPC');
        });

        it('should include NPC details if target is in world', async () => {
            // Spawn an NPC
            const npcData = generateTestNpc(12345, 20101);
            npcData.x = 100000;
            npcData.y = 200000;
            npcData.z = -3500;
            const packetBuffer = createNpcInfoPacket(npcData);
            const reader = new PacketReader(packetBuffer);
            const packet = new NpcInfoPacket();
            packet.decode(reader);

            // Set that NPC as target
            GameStateStore.setTarget(12345, 'NPC 20101', 'NPC');

            const response = await request(app)
                .get('/api/v1/target')
                .expect(200);

            expect(response.body.data.level).toBeDefined();
            expect(response.body.data.hp).toBeDefined();
            expect(response.body.data.position).toBeDefined();
            expect(response.body.data.npcId).toBe(20101);
            expect(response.body.data.isAttackable).toBe(true);
        });
    });

    describe('POST /api/v1/target/clear', () => {
        it('should clear current target', async () => {
            // Set a target first
            GameStateStore.setTarget(12345, 'TestTarget', 'NPC');
            expect(GameStateStore.getCombat().targetObjectId).toBe(12345);

            const response = await request(app)
                .post('/api/v1/target/clear')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toBe('Target cleared');
            expect(GameStateStore.getCombat().targetObjectId).toBe(0);
            expect(GameStateStore.getCombat().targetName).toBe('');
        });
    });

    describe('POST /api/v1/target/next', () => {
        it('should return 503 when not in game', async () => {
            const response = await request(app)
                .post('/api/v1/target/next')
                .send({})
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NOT_IN_GAME');
        });

        it('should return 400 when no NPCs nearby', async () => {
            // Enter game but no NPCs spawned
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .post('/api/v1/target/next')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NO_TARGETS');
        });

        it('should select nearest attackable NPC when available', async () => {
            // Enter game
            const testData = generateTestCharacter();
            testData.x = 100000;
            testData.y = 200000;
            testData.z = -3500;
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            // Spawn an NPC nearby
            const npcData = generateTestNpc(11111, 20101);
            npcData.x = 100100; // Close to character
            npcData.y = 200100;
            npcData.z = -3500;
            const npcBuffer = createNpcInfoPacket(npcData);
            const npcReader = new PacketReader(npcBuffer);
            const npcPacket = new NpcInfoPacket();
            npcPacket.decode(npcReader);

            const response = await request(app)
                .post('/api/v1/target/next')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.objectId).toBe(11111);
            expect(response.body.data.name).toBe('NPC 20101');
        });
    });

    describe('Event Emission', () => {
        it('should emit combat.attack_sent event when attacking', async () => {
            const events: unknown[] = [];
            EventBus.onEvent('combat.attack_sent', (event) => {
                events.push(event);
            });

            // Enter game
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            GameStateStore.updateConnection({ phase: 'IN_GAME' });

            const mockSendPacket = vi.fn();
            const mockClient = {
                sendPacket: mockSendPacket,
                isConnected: () => true
            };
            GameCommandManager.setGameClient(mockClient as unknown as import('../../../src/game/GameClient').GameClient);

            await request(app)
                .post('/api/v1/combat/attack')
                .send({ objectId: 12345 })
                .expect(200);

            await new Promise(resolve => setTimeout(resolve, 10));

            const attackEvent = events.find(e => (e as { type: string }).type === 'combat.attack_sent');
            expect(attackEvent).toBeDefined();
        });
    });
});
