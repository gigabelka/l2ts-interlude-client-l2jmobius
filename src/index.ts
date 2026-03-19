/**
 * @fileoverview Точка входа в приложение (Clean Architecture)
 * @module index
 */

import { CONFIG } from './config';
import { Logger } from './logger/Logger';

// DI Container
import { getContainer } from './config/di/appContainer';
import { DI_TOKENS } from './config/di/Container';
import type { IEventBus, IPacketProcessor } from './application/ports';
import type { ICharacterRepository, IWorldRepository, IInventoryRepository, IConnectionRepository } from './domain/repositories';

// Game
import { GameClientNew } from './game/GameClient';
import { LoginClientNew } from './login/LoginClient';
import { initGameCommandManager } from './game/GameCommandManager';


// API
import { ApiServer } from './api/ApiServer';
import { WsServerNew } from './api/ws/WsServer';

// UI
import { getDashboard, destroyDashboard } from './ui/Dashboard';

import type { SessionData } from './login/types';

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

/**
 * Инициализация логирования
 */
function initLogging(): void {
    const logLevel = process.env['LOG_LEVEL']?.toUpperCase() || 'ERROR';
    Logger.level = logLevel as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

// Architecture initialization removed - DI container is now lazy-initialized

/**
 * Инициализация API сервера
 */
async function initApiServer(): Promise<{ api: ApiServer; ws: WsServerNew }> {
    const apiServer = new ApiServer();
    const wsServer = new WsServerNew();

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

/**
 * Инициализация Dashboard
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

    // Получаем зависимости из контейнера
    const container = getContainer();
    const eventBus = container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
    const packetProcessor = container.resolve<IPacketProcessor>(DI_TOKENS.PacketProcessor).getOrThrow();
    const charRepo = container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();
    const worldRepo = container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow();
    const invRepo = container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow();
    const connectionRepo = container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();

    // Инициализируем GameCommandManager с зависимостями (DI вместо Service Locator)
    const commandManager = initGameCommandManager({
        characterRepo: charRepo,
        worldRepo,
        eventBus,
    });

    // Запускаем Game Client
    const gameClient = new GameClientNew(session, {
        eventBus,
        packetProcessor,
        characterRepo: charRepo,
        worldRepo,
        inventoryRepo: invRepo,
        connectionRepo,
        commandManager,
    });
    gameClient.start();
}

/**
 * Graceful shutdown
 */
function shutdown(services: { api: ApiServer; ws: WsServerNew }): void {
    Logger.info('Shutdown', 'Shutting down gracefully...');

    services.api.stop();
    services.ws.stop();

    // Очищаем репозитории
    const container = getContainer();
    container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow().reset();
    container.resolve<IWorldRepository>(DI_TOKENS.WorldRepository).getOrThrow().reset();
    container.resolve<IInventoryRepository>(DI_TOKENS.InventoryRepository).getOrThrow().reset();
    container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow().reset();

    // Останавливаем Dashboard
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
    Logger.info('Bootstrap', '🎮 L2 Headless Client — Interlude CT0 (Clean Architecture)');
    Logger.info('Bootstrap', '='.repeat(60));
    Logger.info('Bootstrap', `API Server : http://${CONFIG.LoginIp}:3000`);
    Logger.info('Bootstrap', `Login      : ${CONFIG.LoginIp}:${CONFIG.LoginPort}`);
    Logger.info('Bootstrap', `User       : ${CONFIG.Username}`);
    Logger.info('Bootstrap', `Server     : ${CONFIG.ServerId}`);
    Logger.info('Bootstrap', '='.repeat(60));

    // 2. DI container is lazy-initialized on first use

    // 3. Инициализация API сервера
    const services = await initApiServer();

    // 4. Инициализация Dashboard
    initDashboard();

    // 5. Настройка graceful shutdown
    process.on('SIGINT', () => shutdown(services));
    process.on('SIGTERM', () => shutdown(services));
    process.on('uncaughtException', (err) => {
        Logger.error('Bootstrap', `Uncaught exception: ${err.message}`);
        shutdown(services);
    });

    // 6. Запуск подключения к игре (если включено)
    const autoConnect = process.env['AUTO_CONNECT_GAME'] !== 'false';
    if (autoConnect) {
        Logger.info('Bootstrap', 'Starting Login Client...');

        setTimeout(() => {
            const container = getContainer();
            const eventBus = container.resolve<IEventBus>(DI_TOKENS.EventBus).getOrThrow();
            const connectionRepo = container.resolve<IConnectionRepository>(DI_TOKENS.ConnectionRepository).getOrThrow();

            const loginClient = new LoginClientNew(CONFIG, onLoginComplete, { eventBus, connectionRepo });
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
export { getContainer };
