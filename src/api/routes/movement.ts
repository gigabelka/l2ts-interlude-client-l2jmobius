import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import { moveRateLimitMiddleware } from '../middleware/rateLimiter';
import { Logger } from '../../logger/Logger';

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

    // Send move command via GameCommandManager
    const success = GameCommandManager.moveTo(x, y, z);
    
    if (success) {
        res.json({
            success: true,
            data: {
                message: 'Move command sent',
                destination: { x, y, z },
                from: character.position
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
                message: 'Failed to send move command - not in game or position unknown'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * POST /api/v1/move/stop
 * Stop movement.
 */
router.post('/stop', moveRateLimitMiddleware, (req: Request, res: Response) => {
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

    // Send stop movement command via GameCommandManager
    const success = GameCommandManager.stopMove();

    if (success) {
        Logger.info('MovementRoute', `Stop movement command sent at ${character.position.x},${character.position.y},${character.position.z}`);
        res.json({
            success: true,
            data: {
                message: 'Stop movement command sent',
                position: character.position
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
                message: 'Failed to send stop movement command - not in game or position unknown'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * GET /api/v1/move/status
 * Get current movement status.
 */
router.get('/status', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();
    const connection = GameStateStore.getConnection();
    
    // Determine if character is moving based on connection phase and position availability
    const isInGame = connection.phase === 'IN_GAME';
    const hasPosition = character.position !== undefined && character.position !== null;
    
    // TODO: In future, track actual movement state when we have MoveToLocation packets
    const isMoving = false;

    res.json({
        success: true,
        data: {
            isMoving,
            isInGame,
            hasPosition,
            position: character.position || null,
            speed: character.stats?.speed || 0
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/move/follow
 * Follow a target.
 * Body: { objectId: number, minDistance?: number }
 */
router.post('/follow', moveRateLimitMiddleware, (req: Request, res: Response) => {
    const { objectId, minDistance } = req.body;

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

    const world = GameStateStore.getWorld();
    
    // Validate target exists
    const npcTarget = world.npcs.get(objectId);
    const playerTarget = world.players.get(objectId);
    const target = npcTarget || playerTarget;

    if (!target) {
        res.status(400).json({
            success: false,
            error: {
                code: 'TARGET_NOT_FOUND',
                message: `Target with objectId ${objectId} not found in world`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const distance = minDistance || 100;

    // Send follow command via GameCommandManager
    const success = GameCommandManager.follow(objectId, distance);

    if (success) {
        Logger.info('MovementRoute', `Follow command sent: ${target.name} (${objectId}) at distance ${distance}`);
        res.json({
            success: true,
            data: {
                message: 'Follow command sent',
                objectId,
                targetName: target.name,
                targetType: npcTarget ? 'NPC' : 'PLAYER',
                minDistance: distance,
                targetPosition: target.position
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
                message: 'Failed to send follow command - not in game or position unknown'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

export default router;
