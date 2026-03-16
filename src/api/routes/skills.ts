import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/skills
 * Returns list of character skills.
 */
router.get('/', (req: Request, res: Response) => {
    // TODO: Get actual skills from GameStateStore
    
    res.json({
        success: true,
        data: {
            skills: []
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/skills/use
 * Use a skill.
 * Body: { skillId: number, level?: number, targetObjectId?: number, ctrlPressed?: boolean, shiftPressed?: boolean }
 */
router.post('/use', (req: Request, res: Response) => {
    const { skillId, level, targetObjectId, ctrlPressed, shiftPressed } = req.body;

    // TODO: Validate skill exists and send packet via GameClient

    res.json({
        success: true,
        data: {
            message: 'Skill use command sent',
            skillId,
            level,
            targetObjectId,
            ctrlPressed: ctrlPressed || false,
            shiftPressed: shiftPressed || false
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/skills/shortcuts
 * Returns skill shortcuts (hotkeys).
 */
router.get('/shortcuts', (req: Request, res: Response) => {
    // TODO: Get shortcuts from GameStateStore
    
    res.json({
        success: true,
        data: {
            shortcuts: []
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
