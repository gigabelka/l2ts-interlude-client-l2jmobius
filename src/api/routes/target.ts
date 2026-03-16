import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

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

export default router;
