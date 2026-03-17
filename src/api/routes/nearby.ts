import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';

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

/**
 * POST /api/v1/nearby/pickup
 * Pickup an item from ground.
 * Body: { objectId: number }
 * OR pickup nearest if no objectId provided
 */
router.post('/pickup', async (req: Request, res: Response) => {
    const { objectId } = req.body;

    let success: boolean;
    let itemInfo: any = null;

    if (typeof objectId === 'number') {
        // Pickup specific item
        success = await GameCommandManager.pickupItem(objectId);
        
        const world = GameStateStore.getWorld();
        const item = world.items.get(objectId);
        if (item) {
            itemInfo = {
                objectId: item.objectId,
                itemId: item.itemId,
                name: item.name,
                count: item.count
            };
        }
    } else {
        // Pickup nearest item
        const items = GameStateStore.getNearbyItems(200);
        if (items.length > 0) {
            const nearestItem = items[0];
            success = await GameCommandManager.pickupItem(nearestItem.objectId);
            itemInfo = {
                objectId: nearestItem.objectId,
                itemId: nearestItem.itemId,
                name: nearestItem.name,
                count: nearestItem.count
            };
        } else {
            success = false;
        }
    }

    if (success) {
        res.json({
            success: true,
            data: {
                message: 'Moving to pickup item',
                item: itemInfo
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
                code: 'PICKUP_FAILED',
                message: objectId 
                    ? 'Failed to pickup item - not in game or item not found' 
                    : 'No items nearby to pickup'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

export default router;
