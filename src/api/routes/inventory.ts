import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import type { InventoryItem } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/inventory
 * Returns character inventory.
 * Query params:
 *   - type: filter by item type
 *   - equipped: boolean, filter equipped items only
 */
router.get('/', (req: Request, res: Response) => {
    const inventory = GameStateStore.getInventory();
    const typeFilter = req.query.type as string | undefined;
    const equippedFilter = req.query.equipped as string | undefined;

    let items = inventory.items || [];

    if (typeFilter) {
        items = items.filter((item: InventoryItem) => item.type === typeFilter);
    }

    if (equippedFilter !== undefined) {
        const equipped = equippedFilter === 'true';
        items = items.filter((item: InventoryItem) => item.equipped === equipped);
    }

    res.json({
        success: true,
        data: {
            adena: inventory.adena || 0,
            weight: inventory.weight || { current: 0, max: 0 },
            items
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
