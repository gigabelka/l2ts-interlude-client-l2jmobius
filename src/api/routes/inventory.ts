import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import { InventoryService } from '../../services/InventoryService';
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
/**
 * GET /api/v1/inventory
 * Returns character inventory with optional filtering.
 * Returns empty inventory when not connected to game server.
 * Query params:
 *   - type: filter by item type (weapon, armor, consumable, material, quest, etc)
 *   - equipped: boolean, filter equipped items only
 *   - format: 'full' | 'compact' | 'stats' (default: 'full')
 */
router.get('/', (req: Request, res: Response) => {
    const format = (req.query.format as string) || 'full';
    const typeFilter = req.query.type as string | undefined;
    const equippedFilter = req.query.equipped as string | undefined;
    
    const connection = GameStateStore.getConnection();
    const character = GameStateStore.getCharacter();
    
    // Return empty inventory when not in game
    if (connection.phase !== 'IN_GAME' || !character.objectId) {
        res.json({
            success: true,
            data: {
                adena: 0,
                weight: { current: 0, max: 0 },
                items: [],
                equipment: {},
                stats: { totalItems: 0, equippedItems: 0, totalValue: 0 },
                inGame: false
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format
            }
        });
        return;
    }

    // Return different formats based on query param
    if (format === 'compact') {
        // Compact format for dashboard updates
        res.json({
            success: true,
            data: JSON.parse(InventoryService.getCompactInventoryJson()),
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format: 'compact'
            }
        });
        return;
    }

    if (format === 'stats') {
        // Statistics only
        res.json({
            success: true,
            data: InventoryService.getInventoryStats(),
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                format: 'stats'
            }
        });
        return;
    }

    // Full format (default)
    const inventory = InventoryService.getInventoryData();
    let items = inventory.items || [];

    // Apply filters
    if (typeFilter) {
        items = items.filter((item) => item.type === typeFilter);
    }

    if (equippedFilter !== undefined) {
        const equipped = equippedFilter === 'true';
        items = items.filter((item) => item.equipped === equipped);
    }

    Logger.info('InventoryAPI', `Returning ${items.length} items (format=${format}), adena=${inventory.adena}`);

    res.json({
        success: true,
        data: {
            adena: inventory.adena,
            weight: inventory.weight,
            items,
            equipment: inventory.equipment,
            stats: InventoryService.getInventoryStats(),
            inGame: true
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            format: 'full'
        }
    });
});

/**
 * GET /api/v1/inventory/equipment
 * Returns equipped items only
 */
router.get('/equipment', (req: Request, res: Response) => {
    const equipped = InventoryService.getEquippedItems();
    
    res.json({
        success: true,
        data: {
            equipped,
            count: equipped.length,
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/inventory/search
 * Search items by name
 * Query params:
 *   - q: search query
 */
router.get('/search', (req: Request, res: Response) => {
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'Search query must be at least 2 characters'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const results = InventoryService.searchItems(query);
    
    res.json({
        success: true,
        data: {
            query,
            results,
            count: results.length,
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
