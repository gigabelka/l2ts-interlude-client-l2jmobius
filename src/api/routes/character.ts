import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/character
 * Returns full character state.
 */
router.get('/', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();

    if (!character.objectId) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_IN_GAME',
                message: 'Character not in game or data not yet received'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    res.json({
        success: true,
        data: character,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/character/stats
 * Returns character stats only (lightweight).
 */
router.get('/stats', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();

    if (!character.objectId) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_IN_GAME',
                message: 'Character not in game or data not yet received'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    res.json({
        success: true,
        data: {
            objectId: character.objectId,
            name: character.name,
            level: character.level,
            hp: character.hp,
            mp: character.mp,
            cp: character.cp,
            stats: character.stats,
            position: character.position
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/character/buffs
 * Returns active buffs and debuffs.
 */
router.get('/buffs', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();

    if (!character.objectId) {
        res.status(503).json({
            success: false,
            error: {
                code: 'NOT_IN_GAME',
                message: 'Character not in game or data not yet received'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const buffs = character.buffs?.filter(b => !b.isDebuff) || [];
    const debuffs = character.buffs?.filter(b => b.isDebuff) || [];

    res.json({
        success: true,
        data: { buffs, debuffs },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
