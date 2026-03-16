import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { moveRateLimitMiddleware } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/move/to
 * Move to coordinates.
 * Body: { x: number, y: number, z: number, validateRange?: boolean }
 */
router.post('/to', moveRateLimitMiddleware, (req: Request, res: Response) => {
    const { x, y, z, validateRange } = req.body;
    const character = GameStateStore.getCharacter();

    if (!character.position) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_IN_GAME',
                message: 'Character position not available'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate range if requested
    if (validateRange) {
        const dx = x - character.position.x;
        const dy = y - character.position.y;
        const dz = z - character.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > 50000) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'MOVEMENT_BLOCKED',
                    message: 'Destination too far from current position'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
            return;
        }
    }

    // TODO: Send move packet via GameClient
    // For now, just return success placeholder
    res.json({
        success: true,
        data: {
            message: 'Move command sent',
            destination: { x, y, z },
            estimatedTimeMs: 4200 // Placeholder
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/move/stop
 * Stop movement.
 */
router.post('/stop', moveRateLimitMiddleware, (req: Request, res: Response) => {
    // TODO: Send stop packet via GameClient

    res.json({
        success: true,
        data: {
            message: 'Stop movement command sent'
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/move/status
 * Get current movement status.
 */
router.get('/status', (req: Request, res: Response) => {
    // TODO: Get actual movement status from GameStateStore
    
    res.json({
        success: true,
        data: {
            isMoving: false,
            destination: null,
            speed: GameStateStore.getCharacter().stats?.speed || 0
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
