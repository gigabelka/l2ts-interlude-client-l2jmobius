/**
 * @fileoverview Точка входа в приложение (после рефакторинга)
 * Чистая инициализация с разделением ответственности
 * @module index
 */

import { CONFIG } from './config';
import { Logger } from './logger/Logger';

// Core
import { EventBus } from './core/EventBus';
import { characterManager, worldManager } from './core/state';

// Network
import { packetDispatcher, GameOpcode } from './network/protocol/PacketDispatcher';

// Packets
import { CharInfoPacket } from './packets/incoming/game/CharInfoPacket';

// Game
import { LoginClient } from './login/LoginClient';
import { GameClient } from './game/GameClient';
import { GameState } from './game/GameState';

// API
import { ApiServer } from './api/ApiServer';
import { WsServer } from './api/ws/WsServer';

// UI
import { getDashboard } from './ui/Dashboard';

import type { SessionData } from './login/types';

// Импорты для регистрации пакетов (нужно добавить в проект)
import { CryptInitPacket } from './game/packets/incoming/CryptInitPacket';
import { CharSelectInfoPacket } from './game/packets/incoming/CharSelectInfoPacket';
import { CharSelectedPacket } from './game/packets/incoming/CharSelectedPacket';
import { UserInfoPacket } from './game/packets/incoming/UserInfoPacket';
import { NpcInfoPacket } from './game/packets/incoming/NpcInfoPacket';
import { SpawnItemPacket } from './game/packets/incoming/SpawnItemPacket';
import { DropItemPacket } from './game/packets/incoming/DropItemPacket';
import { GetItemPacket } from './game/packets/incoming/GetItemPacket';
import { ItemListPacket } from './game/packets/incoming/ItemListPacket';
import { AttackPacket } from './game/packets/incoming/AttackPacket';
import { StatusUpdatePacket } from './game/packets/incoming/StatusUpdatePacket';
import { MagicSkillUsePacket } from './game/packets/incoming/MagicSkillUsePacket';
import { SkillListPacket } from './game/packets/incoming/SkillListPacket';
import { CreatureSayPacket } from './game/packets/incoming/CreatureSayPacket';
import { MoveToLocationPacket } from './game/packets/incoming/MoveToLocationPacket';
import { NetPingRequestPacket } from './game/packets/incoming/NetPingRequestPacket';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

/**
 * Инициализация логирования
 */
function initLogging(): void {
    const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'ERROR';
    Logger.level = logLevel as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

/**
 * Регистрация обработчиков пакетов (вместо гигантского switch)
 */
function registerPacketHandlers(): void {
    Logger.info('Bootstrap', 'Registering packet handlers...');

    // Используем декларативную регистрацию вместо switch-case
    packetDispatcher
        // Auth & Connection
        .register(GameOpcode.CRYPT_INIT_1, CryptInitPacket, { 
            condition: (state) => state === GameState.WAIT_CRYPT_INIT 
        })
        .register(GameOpcode.CRYPT_INIT_2, CryptInitPacket, { 
            condition: (state) => state === GameState.WAIT_CRYPT_INIT 
        })
        
        // Character selection
        .register(GameOpcode.CHAR_SELECT_INFO_1, CharSelectInfoPacket, {
            condition: (state) => state === GameState.WAIT_CHAR_LIST || state === GameState.WAIT_CHAR_SELECTED,
            priority: 10
        })
        .register(GameOpcode.CHAR_SELECTED, CharSelectedPacket)
        
        // Player info
        .register(GameOpcode.USER_INFO, UserInfoPacket, {
            condition: (state) => state === GameState.WAIT_USER_INFO || state === GameState.IN_GAME,
            priority: 10
        })
        
        // Other players
        .register(GameOpcode.CHAR_INFO, CharInfoPacket, {
            condition: (state) => state === GameState.IN_GAME
        })
        
        // NPCs
        .register(GameOpcode.NPC_INFO, NpcInfoPacket, {
            condition: (state) => state === GameState.IN_GAME
        })
        
        // Items
        .register(GameOpcode.SPAWN_ITEM, SpawnItemPacket)
        .register(GameOpcode.DROP_ITEM, DropItemPacket)
        .register(GameOpcode.GET_ITEM, GetItemPacket)
        .register(GameOpcode.ITEM_LIST, ItemListPacket)
        
        // Combat
        .register(GameOpcode.ATTACK, AttackPacket)
        .register(GameOpcode.STATUS_UPDATE, StatusUpdatePacket)
        .register(GameOpcode.MAGIC_SKILL_USE, MagicSkillUsePacket)
        .register(GameOpcode.SKILL_LIST, SkillListPacket)
        
        // Chat
        .register(GameOpcode.CREATURE_SAY, CreatureSayPacket)
        
        // Movement
        .register(GameOpcode.MOVE_TO_LOCATION, MoveToLocationPacket)
        
        // Ping
        .register(GameOpcode.NET_PING, NetPingRequestPacket);

    // Middleware для логирования всех пакетов
    packetDispatcher.use((context, next) => {
        Logger.debug('PacketMiddleware', 
            `Processing opcode 0x${context.opcode.toString(16).padStart(2, '0')} in state ${context.state}`
        );
        next();
    });

    Logger.info('Bootstrap', `Registered ${packetDispatcher.getRegisteredOpcodes().length} packet handlers`);
}

/**
 * Инициализация Event-Driven UI
 */
function initDashboard(): void {
    const dashboard = getDashboard({
        autoRender: true,
        renderInterval: 2000,
        colored: true,
        verbose: Logger.level === 'DEBUG'
    });

    dashboard.start();
}

/**
 * Инициализация API сервера
 */
async function initApiServer(): Promise<{ api: ApiServer; ws: WsServer }> {
    const apiServer = new ApiServer();
    const wsServer = new WsServer();

    return new Promise((resolve, reject) => {
        apiServer.start(() => {
            const httpServer = apiServer.getServer();
            if (!httpServer) {
                reject(new Error('Failed to start API server'));
                return;
            }

            wsServer.start(httpServer);
            Logger.info('Bootstrap', '✅ API Server and WebSocket are ready!');
            
            resolve({ api: apiServer, ws: wsServer });
        });
    });
}

// ============================================================================
// ОБРАБОТКА СОБЫТИЙ
// ============================================================================

/**
 * Обработка завершения логина
 */
function onLoginComplete(session: SessionData): void {
    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', 'Login Server auth successful');
    Logger.info('Bootstrap', `Game Server: ${session.gameServerIp}:${session.gameServerPort}`);
    Logger.info('Bootstrap', '='.repeat(60));

    // Запускаем Game Client
    // Character will be initialized when UserInfo packet is received
    const gameClient = new GameClient(session);
    gameClient.start();
}

/**
 * Graceful shutdown
 */
function shutdown(services: { api: ApiServer; ws: WsServer }): void {
    Logger.info('Shutdown', 'Shutting down gracefully...');
    
    services.api.stop();
    services.ws.stop();
    
    // Очищаем состояние
    characterManager.reset();
    worldManager.clear();
    
    // Останавливаем Dashboard
    const { destroyDashboard } = require('./ui/Dashboard');
    destroyDashboard();

    process.exit(0);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
    // 1. Инициализация логирования
    initLogging();

    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', '🎮 L2 Headless Client — Interlude CT0');
    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', `API Server : http://${CONFIG.LoginIp}:3000`);
    Logger.info('Bootstrap', `Login      : ${CONFIG.LoginIp}:${CONFIG.LoginPort}`);
    Logger.info('Bootstrap', `User       : ${CONFIG.Username}`);
    Logger.info('Bootstrap', `Server     : ${CONFIG.ServerId}`);
    Logger.info('Bootstrap', '='.repeat(60));

    // 2. Регистрация обработчиков пакетов
    registerPacketHandlers();

    // 3. Инициализация API сервера
    const services = await initApiServer();

    // 4. Инициализация Event-Driven UI (подписывается на события)
    initDashboard();

    // 5. Настройка graceful shutdown
    process.on('SIGINT', () => shutdown(services));
    process.on('SIGTERM', () => shutdown(services));
    process.on('uncaughtException', (err) => {
        Logger.error('Bootstrap', `Uncaught exception: ${err.message}`);
        shutdown(services);
    });

    // 6. Запуск подключения к игре (если включено)
    const autoConnect = process.env.AUTO_CONNECT_GAME !== 'false';
    if (autoConnect) {
        Logger.info('Bootstrap', 'Starting Login Client...');
        
        setTimeout(() => {
            const loginClient = new LoginClient(CONFIG, onLoginComplete);
            loginClient.start();
        }, 1000);
    } else {
        Logger.info('Bootstrap', '⏸️  Auto-connect disabled. Set AUTO_CONNECT_GAME=true to enable.');
    }
}

// Запускаем приложение
main().catch((error) => {
    Logger.error('Bootstrap', `Failed to start: ${error}`);
    process.exit(1);
});

// Экспорты для programmatic access
export { packetDispatcher, characterManager, worldManager, getDashboard };
