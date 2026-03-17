import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import { LoginClient } from '../../login/LoginClient';
import { GameClient } from '../../game/GameClient';
import { Logger } from '../../logger/Logger';
import { CONFIG } from '../../config';
import type { SessionData } from '../../login/types';

const router = Router();

// Track active clients for connection management
let activeLoginClient: LoginClient | null = null;
let activeGameClient: GameClient | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

/**
 * Login configuration interface
 */
interface LoginConfig {
    Username: string;
    Password: string;
    LoginIp: string;
    LoginPort: number;
    GamePort: number;
    Protocol: number;
    ServerId: number;
    CharSlotIndex: number;
}

/**
 * Helper function to create a new game session
 */
function createGameSession(overrideConfig?: Partial<LoginConfig>): void {
    const config: LoginConfig = overrideConfig ? { ...CONFIG, ...overrideConfig } as LoginConfig : { ...CONFIG } as unknown as LoginConfig;

    Logger.info('ConnectionRoute', 'Creating new game session...');
    Logger.info('ConnectionRoute', `Login: ${config.LoginIp}:${config.LoginPort}`);
    Logger.info('ConnectionRoute', `User: ${config.Username}`);
    Logger.info('ConnectionRoute', `Server: ${config.ServerId}`);

    // Update connection state
    GameStateStore.updateConnection({
        phase: 'LOGIN_CONNECTING',
        loginServer: { connected: false, host: config.LoginIp, port: config.LoginPort }
    });

    activeLoginClient = new LoginClient(config as unknown as typeof CONFIG, (session: SessionData) => {
        Logger.info('ConnectionRoute', 'Login Server auth successful');
        Logger.info('ConnectionRoute', `Game Server: ${session.gameServerIp}:${session.gameServerPort}`);

        // Update connection state
        GameStateStore.updateConnection({
            phase: 'LOGIN_COMPLETE',
            loginServer: { connected: true, host: config.LoginIp, port: config.LoginPort }
        });

        // Create and start GameClient
        activeGameClient = new GameClient(session);
        activeGameClient.start();
    });

    activeLoginClient.start();
}

/**
 * POST /api/v1/connect
 * Initiate connection to server.
 * Body: { overrideConfig?: { host?, loginPort?, login?, password?, characterSlot? } }
 */
router.post('/connect', (req: Request, res: Response) => {
    const { overrideConfig } = req.body;
    const connection = GameStateStore.getConnection();

    // Check if already connected or connecting
    if (connection.phase === 'IN_GAME' || connection.phase === 'LOGIN_CONNECTING' || connection.phase === 'GAME_CONNECTING') {
        res.status(409).json({
            success: false,
            error: {
                code: 'ALREADY_CONNECTING',
                message: `Already in ${connection.phase} phase`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    try {
        // Clear any pending reconnect
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        // Build override config from request
        const configOverride: Partial<LoginConfig> = {};
        if (overrideConfig) {
            if (overrideConfig.host) configOverride.LoginIp = overrideConfig.host;
            if (overrideConfig.loginPort) configOverride.LoginPort = overrideConfig.loginPort;
            if (overrideConfig.login) configOverride.Username = overrideConfig.login;
            if (overrideConfig.password) configOverride.Password = overrideConfig.password;
            if (typeof overrideConfig.characterSlot === 'number') configOverride.CharSlotIndex = overrideConfig.characterSlot;
        }

        // Start connection process
        createGameSession(configOverride);

        res.status(202).json({
            success: true,
            data: {
                message: 'Connection initiated',
                phase: 'LOGIN_CONNECTING',
                overrideConfig: overrideConfig || null
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } catch (error) {
        Logger.error('ConnectionRoute', `Failed to initiate connection: ${error}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'CONNECTION_FAILED',
                message: `Failed to initiate connection: ${error}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/disconnect
 * Gracefully disconnect from server.
 */
router.post('/disconnect', (req: Request, res: Response) => {
    const connection = GameStateStore.getConnection();

    if (connection.phase === 'DISCONNECTED') {
        res.status(400).json({
            success: false,
            error: {
                code: 'NOT_CONNECTED',
                message: 'Not currently connected'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    try {
        // Clear any pending reconnect
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        // Disconnect game client first (if connected)
        if (activeGameClient) {
            Logger.info('ConnectionRoute', 'Disconnecting GameClient...');
            activeGameClient.disconnect();
            activeGameClient = null;
        }

        // Disconnect login client if still connected
        if (activeLoginClient) {
            Logger.info('ConnectionRoute', 'Disconnecting LoginClient...');
            activeLoginClient.disconnect();
            activeLoginClient = null;
        }

        // Unregister from command manager
        GameCommandManager.setGameClient(null);

        // Update connection state
        GameStateStore.updateConnection({
            phase: 'DISCONNECTED',
            gameServer: { connected: false, host: '', port: 0 },
            loginServer: { connected: false, host: '', port: 0 }
        });

        // Reset game state
        GameStateStore.reset();

        res.json({
            success: true,
            data: {
                message: 'Disconnected gracefully'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    } catch (error) {
        Logger.error('ConnectionRoute', `Error during disconnect: ${error}`);
        res.status(500).json({
            success: false,
            error: {
                code: 'DISCONNECT_ERROR',
                message: `Error during disconnect: ${error}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/reconnect
 * Reconnect with current configuration.
 * Body: { delayMs?: number }
 */
router.post('/reconnect', (req: Request, res: Response) => {
    const { delayMs } = req.body;
    const delay = delayMs || 3000;

    const connection = GameStateStore.getConnection();

    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Disconnect current connection if any
    if (activeGameClient) {
        activeGameClient.disconnect();
        activeGameClient = null;
    }
    if (activeLoginClient) {
        activeLoginClient.disconnect();
        activeLoginClient = null;
    }

    // Unregister from command manager
    GameCommandManager.setGameClient(null);

    // Reset game state
    GameStateStore.reset();

    // Schedule reconnect
    reconnectTimeout = setTimeout(() => {
        Logger.info('ConnectionRoute', 'Executing scheduled reconnect...');
        createGameSession();
    }, delay);

    Logger.info('ConnectionRoute', `Reconnect scheduled in ${delay}ms`);

    res.json({
        success: true,
        data: {
            message: 'Reconnect scheduled',
            delayMs: delay,
            previousPhase: connection.phase
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
