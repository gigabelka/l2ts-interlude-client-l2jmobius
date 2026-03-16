import { Router, type Request, type Response } from 'express';
import { GameStateStore } from '../../core/GameStateStore';

const router = Router();

/**
 * GET /api/v1/party
 * Returns party information.
 */
router.get('/', (req: Request, res: Response) => {
    const party = GameStateStore.getParty();

    res.json({
        success: true,
        data: party,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/party/invite
 * Invite player to party.
 * Body: { playerName: string }
 */
router.post('/invite', (req: Request, res: Response) => {
    const { playerName } = req.body;

    if (!playerName) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'playerName is required'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // TODO: Send party invite packet

    res.json({
        success: true,
        data: {
            message: 'Party invite sent',
            playerName
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * POST /api/v1/party/leave
 * Leave current party.
 */
router.post('/leave', (req: Request, res: Response) => {
    // TODO: Send leave party packet

    res.json({
        success: true,
        data: {
            message: 'Left party'
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export default router;
