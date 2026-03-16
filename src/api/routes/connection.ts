import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * POST /api/v1/connect
 * Initiate connection to server.
 * Body: { overrideConfig?: { host?, loginPort?, login?, password?, characterSlot? } }
 */
router.post('/', (req: Request, res: Response) => {
    const { overrideConfig } = req.body;

    // TODO: Implement connection logic with optional override config
    // For now, return accepted status

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
});

/**
 * POST /api/v1/disconnect
 * Gracefully disconnect from server.
 */
router.post('/disconnect', (req: Request, res: Response) => {
    // TODO: Send logout packet and close connections

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
});

/**
 * POST /api/v1/reconnect
 * Reconnect with current configuration.
 * Body: { delayMs?: number }
 */
router.post('/reconnect', (req: Request, res: Response) => {
    const { delayMs } = req.body;

    // TODO: Implement reconnect logic

    res.json({
        success: true,
        data: {
            message: 'Reconnect scheduled',
            delayMs: delayMs || 3000
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
