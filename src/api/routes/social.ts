import { Router, type Request, type Response } from 'express';
import { Logger } from '../../logger/Logger';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * POST /api/v1/social/action
 * Perform a social action (sit, stand, wave, etc.)
 * 
 * Action IDs:
 * 0 - Sit/Stand toggle
 * 1 - Wave
 * 2 - Victory
 * 3 - Dance
 * 4 - Hello
 * 5 - Charge
 * etc.
 */
router.post('/action', (req: Request, res: Response) => {
    const { actionId } = req.body;

    if (typeof actionId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'actionId must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Check if character is in game
    const character = GameStateStore.getCharacter();
    if (!character.objectId) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_IN_GAME',
                message: 'Character not in game'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Action names for logging
    const actionNames: Record<number, string> = {
        0: 'Sit/Stand',
        1: 'Wave',
        2: 'Victory',
        3: 'Dance',
        4: 'Hello',
        5: 'Charge',
        6: 'Sorrow',
        7: 'Unmount'
    };

    const actionName = actionNames[actionId] || `Action ${actionId}`;
    Logger.info('SocialRoute', `Social action requested: ${actionName} (${actionId})`);

    // TODO: Implement actual social action packet sending to game server
    // For now, return success (client-side toggle only)
    
    res.json({
        success: true,
        data: {
            actionId,
            actionName,
            performed: true,
            timestamp: new Date().toISOString()
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/social/actions
 * Get list of available social actions
 */
router.get('/actions', (req: Request, res: Response) => {
    const actions = [
        { id: 0, name: 'Sit/Stand', description: 'Toggle sitting/standing position' },
        { id: 1, name: 'Wave', description: 'Wave hand' },
        { id: 2, name: 'Victory', description: 'Victory pose' },
        { id: 3, name: 'Dance', description: 'Dance' },
        { id: 4, name: 'Hello', description: 'Greeting' },
        { id: 5, name: 'Charge', description: 'Battle cry' },
        { id: 6, name: 'Sorrow', description: 'Express sadness' },
        { id: 7, name: 'Unmount', description: 'Dismount from pet/strider' }
    ];

    res.json({
        success: true,
        data: actions,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
