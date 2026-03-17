import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import { GameStateStore } from '../../../src/core/GameStateStore';
import { EventBus } from '../../../src/core/EventBus';
import { MockL2Server } from '../../utils/mockServer';
import { generateTestCharacter } from '../../config';
import { PacketReader } from '../../../src/network/PacketReader';
import { UserInfoPacket } from '../../../src/game/packets/incoming/UserInfoPacket';
import { createUserInfoPacket } from '../../utils/mockServer';

// Import routes directly for testing
import characterRouter from '../../../src/api/routes/character';
import { requestIdMiddleware } from '../../../src/api/middleware/requestId';

describe('Character API Integration', () => {
    let app: Application;
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state
        GameStateStore.reset();
        EventBus.removeAllListeners();

        // Create express app for testing
        app = express();
        app.use(express.json());
        app.use(requestIdMiddleware);
        
        // Mount the character routes
        app.use('/api/v1/character', characterRouter);

        // Start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        await mockServer.stop();
        GameStateStore.reset();
        EventBus.removeAllListeners();
    });

    describe('GET /api/v1/character', () => {
        it('should return 503 when character is not in game', async () => {
            const response = await request(app)
                .get('/api/v1/character')
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NOT_IN_GAME');
        });

        it('should return character data when in game', async () => {
            // Simulate character entering game via UserInfo packet
            const testData = generateTestCharacter('TestHero');
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('TestHero');
            expect(response.body.data.level).toBe(80);
            expect(response.body.data.objectId).toBe(12345678);
        });

        it('should include all character fields', async () => {
            const testData = generateTestCharacter('FullTest');
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            const data = response.body.data;
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('level');
            expect(data).toHaveProperty('race');
            expect(data).toHaveProperty('classId');
            expect(data).toHaveProperty('hp');
            expect(data).toHaveProperty('mp');
            expect(data).toHaveProperty('position');
            expect(data).toHaveProperty('stats');
        });

        it('should include meta information', async () => {
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            expect(response.body.meta).toBeDefined();
            expect(response.body.meta.timestamp).toBeDefined();
            expect(response.body.meta.requestId).toBeDefined();
        });

        it('should reflect character state updates', async () => {
            // First state
            let testData = generateTestCharacter('Initial');
            let packetBuffer = createUserInfoPacket(testData);
            let reader = new PacketReader(packetBuffer);
            let packet = new UserInfoPacket();
            packet.decode(reader);

            let response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            expect(response.body.data.name).toBe('Initial');

            // Update character state
            testData = generateTestCharacter('Updated');
            packetBuffer = createUserInfoPacket(testData);
            reader = new PacketReader(packetBuffer);
            packet = new UserInfoPacket();
            packet.decode(reader);

            response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            expect(response.body.data.name).toBe('Updated');
        });
    });

    describe('GET /api/v1/character/stats', () => {
        it('should return 503 when character is not in game', async () => {
            const response = await request(app)
                .get('/api/v1/character/stats')
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NOT_IN_GAME');
        });

        it('should return lightweight stats when in game', async () => {
            const testData = generateTestCharacter('StatsTest');
            testData.level = 85;
            testData.currentHp = 2500;
            testData.maxHp = 3000;
            testData.currentMp = 1200;
            testData.maxMp = 1500;
            testData.currentCp = 900;
            testData.maxCp = 1000;

            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character/stats')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('StatsTest');
            expect(response.body.data.level).toBe(85);
        });

        it('should include HP, MP, CP in stats', async () => {
            const testData = generateTestCharacter();
            testData.currentHp = 1800;
            testData.maxHp = 2000;
            testData.currentMp = 900;
            testData.maxMp = 1000;
            testData.currentCp = 800;
            testData.maxCp = 1000;

            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character/stats')
                .expect(200);

            expect(response.body.data.hp).toEqual({ current: 1800, max: 2000 });
            expect(response.body.data.mp).toEqual({ current: 900, max: 1000 });
            expect(response.body.data.cp).toEqual({ current: 800, max: 1000 });
        });

        it('should include character stats (str, dex, etc.)', async () => {
            const testData = generateTestCharacter();
            testData.str = 50;
            testData.dex = 40;
            testData.con = 55;

            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character/stats')
                .expect(200);

            expect(response.body.data.stats).toBeDefined();
            expect(response.body.data.stats.str).toBe(50);
            expect(response.body.data.stats.dex).toBe(40);
            expect(response.body.data.stats.con).toBe(55);
        });

        it('should include position in stats', async () => {
            const testData = generateTestCharacter();
            testData.x = 123456;
            testData.y = 654321;
            testData.z = -5000;

            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character/stats')
                .expect(200);

            expect(response.body.data.position).toEqual({
                x: 123456,
                y: 654321,
                z: -5000
            });
        });
    });

    describe('GET /api/v1/character/buffs', () => {
        it('should return 503 when character is not in game', async () => {
            const response = await request(app)
                .get('/api/v1/character/buffs')
                .expect(503);

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('NOT_IN_GAME');
        });

        it('should return empty buffs when no buffs active', async () => {
            const testData = generateTestCharacter();
            const packetBuffer = createUserInfoPacket(testData);
            const reader = new PacketReader(packetBuffer);
            const packet = new UserInfoPacket();
            packet.decode(reader);

            const response = await request(app)
                .get('/api/v1/character/buffs')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.buffs).toEqual([]);
            expect(response.body.data.debuffs).toEqual([]);
        });
    });

    describe('Mock Server Integration', () => {
        it('should reflect character from mock server UserInfo packet', async () => {
            const testData = generateTestCharacter('MockChar');
            mockServer.sendUserInfo(testData);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            expect(response.body.data.name).toBe('MockChar');
        });

        it('should handle rapid character updates', async () => {
            // Send multiple updates
            for (let i = 0; i < 3; i++) {
                const testData = generateTestCharacter(`Char${i}`);
                testData.level = 80 + i;
                mockServer.sendUserInfo(testData);
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 50));

            const response = await request(app)
                .get('/api/v1/character')
                .expect(200);

            // Should reflect the last update
            expect(response.body.data.name).toBe('Char2');
            expect(response.body.data.level).toBe(82);
        });
    });
});
