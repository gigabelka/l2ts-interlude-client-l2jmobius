import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { combatRateLimitMiddleware } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/combat/attack
 * Attack current or specified target.
 * Body: { objectId?: number, shiftClick?: boolean }
 */
router.post('/attack', combatRateLimitMiddleware, (req: Request, res: Response) => {
    const { objectId, shiftClick } = req.body;
    const combat = GameStateStore.getCombat();

    // Use provided objectId or current target
    const targetId = objectId || combat.targetObjectId;

    if (!targetId) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'No target specified or selected'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // TODO: Send attack packet via GameClient
    // For now, just return success placeholder
    res.json({
        success: true,
        data: {
            message: 'Attack command sent',
            targetId,
            shiftClick: shiftClick || false
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/combat/stop
 * Stop auto-attack.
 */
router.post('/stop', combatRateLimitMiddleware, (req: Request, res: Response) => {
    // TODO: Send stop packet via GameClient
    GameStateStore.setInCombat(false);

    res.json({
        success: true,
        data: {
            message: 'Stop attack command sent'
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
