import { CONFIG } from './config';
import { Logger } from './logger/Logger';
import { LoginClient } from './login/LoginClient';
import { GameClient } from './game/GameClient';
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

process.on('uncaughtException', (err: Error) => {
    Logger.error('PROCESS', `uncaughtException: ${err.message}`);
    Logger.error('PROCESS', err.stack ?? '(no stack)');
    process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
    Logger.error('PROCESS', `unhandledRejection: ${String(reason)}`);
    process.exit(1);
});

function onLoginComplete(session: SessionData): void {
    Logger.info('MAIN', '='.repeat(60));
    Logger.info('MAIN', 'Login Server auth successful');
    Logger.info('MAIN', `Game   : ${session.gameServerIp}:${session.gameServerPort}`);
    Logger.info('MAIN', `LOkId1 : 0x${session.loginOkId1.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `LOkId2 : 0x${session.loginOkId2.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `POkId1 : 0x${session.playOkId1.toString(16).toUpperCase()}`);
    Logger.info('MAIN', `POkId2 : 0x${session.playOkId2.toString(16).toUpperCase()}`);
    Logger.info('MAIN', '='.repeat(60));

    const gameClient = new GameClient(session);
    gameClient.start();
}

Logger.info('MAIN', 'Waiting 1 second before connecting...');
setTimeout(() => {
    Logger.info('MAIN', 'Starting Login Client...');
    const loginClient = new LoginClient(CONFIG, onLoginComplete);
    loginClient.start();
}, 1000);
