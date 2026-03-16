import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/status
 * Returns current connection status and client phase.
 */
router.get('/', (req: Request, res: Response) => {
    const connection = GameStateStore.getConnection();

    res.json({
        success: true,
        data: {
            phase: connection.phase || 'DISCONNECTED',
            loginServer: connection.loginServer || { connected: false, host: '', port: 0 },
            gameServer: connection.gameServer || { connected: false, host: '', port: 0 },
            uptime: connection.uptime || 0,
            pingMs: connection.pingMs
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
