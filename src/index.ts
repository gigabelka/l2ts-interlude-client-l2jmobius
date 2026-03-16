import { CONFIG } from './config';
import { Logger } from './logger/Logger';
import { LoginClient } from './login/LoginClient';
import { GameClient } from './game/GameClient';
import { ApiServer } from './api/ApiServer';
import { WsServer } from './api/ws/WsServer';
import { GameStateStore } from './core/GameStateStore';
import { EventBus } from './core/EventBus';
import type { SessionData } from './login/types';

const logLevel = process.env.LOG_LEVEL?.toUpperCase() || 'ERROR';
Logger.level = logLevel as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

Logger.info('MAIN', '='.repeat(60));
Logger.info('MAIN', 'L2 Headless Client — Interlude CT0');
Logger.info('MAIN', '='.repeat(60));
Logger.info('MAIN', `Login      : ${CONFIG.LoginIp}:${CONFIG.LoginPort}`);
Logger.info('MAIN', `User       : ${CONFIG.Username}`);
Logger.info('MAIN', `Server     : ${CONFIG.ServerId}`);
Logger.info('MAIN', `Protocol   : ${CONFIG.Protocol}`);
Logger.info('MAIN', `Slot       : ${CONFIG.CharSlotIndex}`);
Logger.info('MAIN', '='.repeat(60));

// Initialize API server
const apiServer = new ApiServer();
const wsServer = new WsServer();

// Handle process events
process.on('uncaughtException', (err: Error) => {
    Logger.error('PROCESS', `uncaughtException: ${err.message}`);
    Logger.error('PROCESS', err.stack ?? '(no stack)');
    shutdown();
});

process.on('unhandledRejection', (reason: unknown) => {
    Logger.error('PROCESS', `unhandledRejection: ${String(reason)}`);
    shutdown();
});

process.on('SIGINT', () => {
    Logger.info('PROCESS', 'SIGINT received, shutting down...');
    shutdown();
});

process.on('SIGTERM', () => {
    Logger.info('PROCESS', 'SIGTERM received, shutting down...');
    shutdown();
});

function shutdown(): void {
    apiServer.stop();
    wsServer.stop();
    process.exit(0);
}

// EventBus debug logging
if (Logger.level === 'DEBUG') {
    EventBus.onAny((event) => {
        Logger.debug('EventBus', `[${event.channel}] ${event.type}`);
    });
}

function onLoginComplete(session: SessionData): void {
    Logger.info('MAIN', '='.repeat(60));
    Logger.info('MAIN', 'Login Server auth successful');
    Logger.info('MAIN', `Game   : ${session.gameServerIp}:${session.gameServerPort}`);
    Logger.info('MAIN', `LOkId1 : 0x${session.loginOkId1.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `LOkId2 : 0x${session.loginOkId2.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `POkId1 : 0x${session.playOkId1.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `POkId2 : 0x${session.playOkId2.toString(16).toUpperCase()}`);
    Logger.info('MAIN', '='.repeat(60));

    // Update connection state
    GameStateStore.updateConnection({
        phase: 'LOGIN_COMPLETE',
        loginServer: { connected: true, host: CONFIG.LoginIp, port: CONFIG.LoginPort }
    });

    const gameClient = new GameClient(session);
    gameClient.start();
}

// Start API server first, then attach WebSocket to the same HTTP server
apiServer.start(() => {
    const httpServer = apiServer.getServer();
    if (httpServer) {
        wsServer.start(httpServer);
    }
});

// Start L2 client after a short delay
Logger.info('MAIN', 'Waiting 1 second before connecting to game server...');
setTimeout(() => {
    Logger.info('MAIN', 'Starting Login Client...');
    
    // Update connection state
    GameStateStore.updateConnection({
        phase: 'LOGIN_CONNECTING',
        loginServer: { connected: false, host: CONFIG.LoginIp, port: CONFIG.LoginPort }
    });
    
    const loginClient = new LoginClient(CONFIG, onLoginComplete);
    loginClient.start();
}, 1000);
