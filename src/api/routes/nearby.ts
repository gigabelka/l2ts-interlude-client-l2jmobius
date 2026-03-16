import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/nearby/npcs
 * Returns NPCs in visible range.
 * Query params:
 *   - radius: number (default 600, max 2000)
 *   - attackable: boolean
 *   - alive: boolean (default true)
 */
router.get('/npcs', (req: Request, res: Response) => {
    const radius = Math.min(parseInt(req.query.radius as string) || 600, 2000);
    const attackable = req.query.attackable !== undefined 
        ? req.query.attackable === 'true' 
        : undefined;
    const alive = req.query.alive !== undefined 
        ? req.query.alive === 'true' 
        : true;

    const npcs = GameStateStore.getNearbyNpcs(radius, { attackable, alive });

    res.json({
        success: true,
        data: {
            count: npcs.length,
            npcs
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/players
 * Returns players in visible range.
 * Query params:
 *   - radius: number (default 600, max 2000)
 */
router.get('/players', (req: Request, res: Response) => {
    const radius = Math.min(parseInt(req.query.radius as string) || 600, 2000);

    const players = GameStateStore.getNearbyPlayers(radius);

    res.json({
        success: true,
        data: {
            count: players.length,
            players
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/nearby/items
 * Returns items on ground in visible range.
 * Query params:
 *   - radius: number (default 600, max 2000)
 */
router.get('/items', (req: Request, res: Response) => {
    const radius = Math.min(parseInt(req.query.radius as string) || 600, 2000);

    const items = GameStateStore.getNearbyItems(radius);

    res.json({
        success: true,
        data: {
            count: items.length,
            items
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
