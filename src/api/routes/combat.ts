import { Router, type Request, type Response } from 'express';
import { GameCommandManager } from '../../game/GameCommandManager';
import { combatRateLimitMiddleware } from '../middleware/rateLimiter';
import { architectureBridge } from '../../infrastructure/integration/NewArchitectureBridge';
import { DI_TOKENS } from '../../config/di/Container';
import type { ICharacterRepository } from '../../domain/repositories';

const router = Router();

// Repository accessors
const container = architectureBridge.getContainer();
const getCharRepo = () => container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository).getOrThrow();

/**
 * POST /api/v1/combat/attack
 * Attack current or specified target.
 * Body: { objectId?: number, shiftClick?: boolean }
 */
router.post('/attack', combatRateLimitMiddleware, (req: Request, res: Response) => {
    const { objectId, shiftClick } = req.body;
    const char = getCharRepo().get();
    const targetId = objectId || char?.targetId;

    // Use provided objectId or current target

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

    // Send attack command via GameCommandManager
    const success = GameCommandManager.attack(targetId, shiftClick || false);
    
    if (success) {
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
    } else {
        res.status(503).json({
            success: false,
            error: {
                code: 'COMMAND_FAILED',
                message: 'Failed to send attack command - not in game'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/combat/stop
 * Stop auto-attack.
 */
router.post('/stop', combatRateLimitMiddleware, (req: Request, res: Response) => {
    const char = getCharRepo().get();
    if (char) {
        char.setInCombat(false);
    }

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
