import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import type { InventoryItem } from '../../core/GameStateStore';
import { Logger } from '../../logger/Logger';

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

    // Direct access to check if items exist
    const rawInventory = (GameStateStore as any).inventory;
    Logger.info('InventoryAPI', `Raw inventory from store: ${JSON.stringify({ itemsLength: rawInventory?.items?.length, adena: rawInventory?.adena })}`);
    
    let items = inventory.items || [];
    
    Logger.info('InventoryAPI', `Inventory object: ${JSON.stringify({ itemsCount: items.length, adena: inventory.adena, hasItems: !!inventory.items })}`);
    Logger.info('InventoryAPI', `Returning ${items.length} items, adena=${inventory.adena || 0}`);
    if (items.length > 0) {
        Logger.info('InventoryAPI', `First item: ${JSON.stringify(items[0])}`);
    }

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

/**
 * POST /api/v1/inventory/use
 * Use an item from inventory.
 * Body: { objectId: number }
 */
router.post('/use', (req: Request, res: Response) => {
    const { objectId } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'objectId is required and must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const inventory = GameStateStore.getInventory();
    const items = inventory.items || [];

    // Validate item exists in inventory
    const item = items.find((i: InventoryItem) => i.objectId === objectId);
    if (!item) {
        res.status(400).json({
            success: false,
            error: {
                code: 'ITEM_NOT_FOUND',
                message: `Item with objectId ${objectId} not found in inventory`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send use item command via GameCommandManager
    const success = GameCommandManager.useItem(objectId);

    if (success) {
        Logger.info('InventoryRoute', `Use item command sent: ${item.name} (${objectId})`);
        res.json({
            success: true,
            data: {
                message: 'Use item command sent',
                objectId,
                itemName: item.name,
                itemId: item.itemId
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
                message: 'Failed to send use item command - not in game'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/inventory/drop
 * Drop an item on the ground.
 * Body: { objectId: number, count: number, position?: { x: number, y: number, z: number } }
 */
router.post('/drop', (req: Request, res: Response) => {
    const { objectId, count, position } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'objectId is required and must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    if (typeof count !== 'number' || count <= 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'count is required and must be a positive number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate position if provided
    if (position !== undefined) {
        if (typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
            res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAMETER',
                    message: 'position must have x, y, z as numbers'
                },
                meta: {
                    timestamp: new Date().toISOString(),
                    requestId: req.requestId
                }
            });
            return;
        }
    }

    const inventory = GameStateStore.getInventory();
    const items = inventory.items || [];

    // Validate item exists in inventory
    const item = items.find((i: InventoryItem) => i.objectId === objectId);
    if (!item) {
        res.status(400).json({
            success: false,
            error: {
                code: 'ITEM_NOT_FOUND',
                message: `Item with objectId ${objectId} not found in inventory`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Validate count doesn't exceed available
    if (count > item.count) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INSUFFICIENT_COUNT',
                message: `Cannot drop ${count} of ${item.name}, only ${item.count} available`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send drop item command via GameCommandManager
    const success = GameCommandManager.dropItem(objectId, count, position);

    if (success) {
        Logger.info('InventoryRoute', `Drop item command sent: ${item.name} x${count} (${objectId})`);
        res.json({
            success: true,
            data: {
                message: 'Drop item command sent',
                objectId,
                itemName: item.name,
                itemId: item.itemId,
                count,
                position: position || GameStateStore.getCharacter().position
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
                message: 'Failed to send drop item command - not in game or position unknown'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

export default router;
