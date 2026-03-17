import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';
import { GameCommandManager } from '../../game/GameCommandManager';
import { Logger } from '../../logger/Logger';

const router = Router();

/**
 * GET /api/v1/skills
 * Returns list of character skills.
 */
router.get('/', (req: Request, res: Response) => {
    const character = GameStateStore.getCharacter();
    const skills = character.skills || [];

    res.json({
        success: true,
        data: {
            skills
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
 * Body: { skillId: number, ctrlPressed?: boolean, shiftPressed?: boolean }
 */
router.post('/use', (req: Request, res: Response) => {
    const { skillId, ctrlPressed, shiftPressed } = req.body;

    if (typeof skillId !== 'number') {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PARAMETER',
                message: 'skillId is required and must be a number'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    const character = GameStateStore.getCharacter();
    const skills = character.skills || [];
    
    // Validate skill exists in character's skill list
    const skill = skills.find((s: { id: number }) => s.id === skillId);
    if (!skill) {
        res.status(400).json({
            success: false,
            error: {
                code: 'SKILL_NOT_FOUND',
                message: `Skill ${skillId} not found in character skill list`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // Send skill use command via GameCommandManager
    const success = GameCommandManager.useSkill(skillId, ctrlPressed || false, shiftPressed || false);

    if (success) {
        Logger.info('SkillsRoute', `Skill use command sent: ${skillId} (${skill.name || 'Unknown'})`);
        res.json({
            success: true,
            data: {
                message: 'Skill use command sent',
                skillId,
                skillName: skill.name || 'Unknown',
                ctrlPressed: ctrlPressed || false,
                shiftPressed: shiftPressed || false
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
                message: 'Failed to send skill use command - not in game'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
    }
});

/**
 * GET /api/v1/skills/shortcuts
 * Returns skill shortcuts (hotkeys).
 */
router.get('/shortcuts', (req: Request, res: Response) => {
    // TODO: Implement shortcuts storage in GameStateStore
    // For now, return empty array
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
