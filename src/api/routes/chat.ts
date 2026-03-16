import { Router, type Request, type Response } from 'express';

const router = Router();

// In-memory chat history (last 500 messages)
const chatHistory: Array<{
    channel: string;
    senderName: string;
    senderObjectId?: number;
    message: string;
    receivedAt: string;
}> = [];

const MAX_HISTORY = 500;

/**
 * POST /api/v1/chat/send
 * Send a chat message.
 * Body: { channel: string, message: string, target?: string }
 */
router.post('/send', (req: Request, res: Response) => {
    const { channel, message, target } = req.body;

    const validChannels = ['ALL', 'SHOUT', 'TELL', 'PARTY', 'CLAN', 'TRADE', 'HERO'];
    
    if (!validChannels.includes(channel)) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: `Invalid channel. Valid: ${validChannels.join(', ')}`
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    if (channel === 'TELL' && !target) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_TARGET',
                message: 'TELL channel requires target parameter'
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            }
        });
        return;
    }

    // TODO: Send chat packet via GameClient

    res.json({
        success: true,
        data: {
            message: 'Chat message sent',
            channel,
            text: message
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

/**
 * GET /api/v1/chat/history
 * Get chat history.
 * Query params:
 *   - channel: filter by channel
 *   - limit: number (max 100, default 50)
 *   - since: ISO timestamp
 */
router.get('/history', (req: Request, res: Response) => {
    const channel = req.query.channel as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const since = req.query.since as string | undefined;

    let messages = [...chatHistory];

    if (channel) {
        messages = messages.filter(m => m.channel === channel);
    }

    if (since) {
        const sinceDate = new Date(since);
        messages = messages.filter(m => new Date(m.receivedAt) >= sinceDate);
    }

    messages = messages.slice(-limit);

    res.json({
        success: true,
        data: {
            messages
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId
        }
    });
});

export function addChatMessage(message: typeof chatHistory[0]): void {
    chatHistory.push(message);
    if (chatHistory.length > MAX_HISTORY) {
        chatHistory.shift();
    }
}

export default router;
