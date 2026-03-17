import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import { Logger } from '../../logger/Logger';

const router = Router();

/**
 * GET /api/v1/target
 * Returns current target information.
 */
router.get('/', (req: Request, res: Response) => {
    const combat = GameStateStore.getCombat();
    const world = GameStateStore.getWorld();

    if (!combat.targetObjectId) {
        res.json({
            success: true,
            data: null,
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Find target in world state
    const npcTarget = world.npcs.get(combat.targetObjectId);
    const playerTarget = world.players.get(combat.targetObjectId);
    const target = npcTarget || playerTarget;

    res.json({
        success: true,
        data: {
            objectId: combat.targetObjectId,
            name: combat.targetName,
            type: combat.targetType,
            ...(target && {
                level: target.level,
                hp: target.hp,
                position: target.position,
                ...(npcTarget && {
                    npcId: npcTarget.npcId,
                    isAttackable: npcTarget.isAttackable,
                    isAggressive: npcTarget.isAggressive
                })
            })
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/target/next
 * Switch to next nearest target (NPC).
 */
router.post('/next', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();
    const combat = GameStateStore.getCombat();

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

    // Get nearby attackable NPCs within 1200 range, sorted by distance
    const nearbyNpcs = GameStateStore.getNearbyNpcs(1200, { attackable: true, alive: true })
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));

    if (nearbyNpcs.length === 0) {
        res.status(400).json({
            success: false,
            error: {
                code: 'NO_TARGETS',
                message: 'No attackable targets nearby'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Find next target
    let nextTarget = nearbyNpcs[0];
    const currentTargetId = combat.targetObjectId;

    if (currentTargetId) {
        const currentIndex = nearbyNpcs.findIndex(npc => npc.objectId === currentTargetId);
        if (currentIndex >= 0 && currentIndex < nearbyNpcs.length - 1) {
            // Select next target in list
            nextTarget = nearbyNpcs[currentIndex + 1];
        } else {
            // Wrap around to first target or keep current if only one
            nextTarget = nearbyNpcs[0];
        }
    }

    // Send Action packet to server to select target
    const actionSuccess = GameCommandManager.action(nextTarget.objectId, false);
    
    // Update local state
    GameStateStore.setTarget(nextTarget.objectId, nextTarget.name, 'NPC');

    Logger.info('TargetRoute', `Next target selected: ${nextTarget.name} (${nextTarget.objectId}) at ${nextTarget.distance?.toFixed(1)}m`);

    res.json({
        success: true,
        data: {
            objectId: nextTarget.objectId,
            name: nextTarget.name,
            level: nextTarget.level,
            npcId: nextTarget.npcId,
            distance: nextTarget.distance,
            hp: nextTarget.hp,
            isAttackable: nextTarget.isAttackable,
            isAggressive: nextTarget.isAggressive,
            actionSent: actionSuccess
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/target/set
 * Set target by objectId.
 */
router.post('/set', (req: Request, res: Response) => {
    const { objectId, name, type } = req.body;

    if (typeof objectId !== 'number') {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_PARAMETER', message: 'objectId must be a number' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
        });
        return;
    }

    // Send Action packet to server to select target
    const actionSuccess = GameCommandManager.action(objectId, false);

    // Update local state
    GameStateStore.setTarget(objectId, name || '', type || 'NPC');

    res.json({
        success: true,
        data: { 
            objectId, 
            name: name || '', 
            type: type || 'NPC',
            actionSent: actionSuccess
        },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
    });
});

/**
 * POST /api/v1/target/clear
 * Clear current target.
 */
router.post('/clear', (req: Request, res: Response) => {
    // Send Action packet with objectId 0 to clear target
    GameCommandManager.action(0, false);
    
    GameStateStore.setTarget(0, '', undefined);

    res.json({
        success: true,
        data: { message: 'Target cleared' },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId }
    });
});

export default router;
