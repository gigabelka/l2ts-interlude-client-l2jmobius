import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import type { IncomingMessage, Server } from 'http';
import { API_CONFIG } from '../../config';
import { Logger } from '../../logger/Logger';
import { EventBus, type GameEvent, type EventChannel } from '../../core/EventBus';

interface WsClient {
    ws: WebSocket;
    id: string;
    channels: Set<EventChannel>;
    isAlive: boolean;
}

interface SubscribeMessage {
    type: 'subscribe';
    channels: EventChannel[];
}

interface UnsubscribeMessage {
    type: 'unsubscribe';
    channels: EventChannel[];
}

interface PingMessage {
    type: 'ping';
}

type WsMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

export class WsServer {
    private wss: WebSocketServer | null = null;
    private clients: Map<WebSocket, WsClient> = new Map();
    private pingInterval: NodeJS.Timeout | null = null;

    start(server?: Server): void {
        this.wss = new WebSocketServer({
            server,
            verifyClient: (info: { req: IncomingMessage }) => this.verifyClient(info)
        });

        this.wss.on('connection', this.handleConnection.bind(this));

        // Start ping/pong to detect dead connections
        this.pingInterval = setInterval(() => {
            this.clients.forEach((client) => {
                if (!client.isAlive) {
                    client.ws.terminate();
                    this.clients.delete(client.ws);
                    return;
                }
                client.isAlive = false;
                client.ws.ping();
            });
        }, 30000);

        // Subscribe to EventBus
        EventBus.onAny((event: GameEvent) => {
            this.broadcast(event);
        });

        Logger.info('WsServer', `WebSocket server started at ws://localhost:${API_CONFIG.port}/ws`);
    }

    private verifyClient(info: { req: IncomingMessage }): boolean {
        // If no apiKey configured, skip authentication
        if (!API_CONFIG.apiKey) {
            return true;
        }

        const { query } = parse(info.req.url || '', true);
        const token = query.token as string;

        if (!token || token !== API_CONFIG.apiKey) {
            Logger.warn('WsServer', 'WebSocket connection rejected: invalid token');
            return false;
        }

        return true;
    }

    private handleConnection(ws: WebSocket, req: IncomingMessage): void {
        const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        const client: WsClient = {
            ws,
            id: clientId,
            channels: new Set(),
            isAlive: true
        };

        this.clients.set(ws, client);
        Logger.info('WsServer', `Client connected: ${clientId}`);

        // Send welcome message
        this.sendToClient(client, {
            type: 'system.connected',
            channel: 'system',
            data: {
                phase: 'WS_CONNECTED',
                characterName: `Connected to L2TS Event Stream (${clientId})`
            },
            timestamp: new Date().toISOString()
        });

        ws.on('message', (data: Buffer) => {
            this.handleMessage(client, data);
        });

        ws.on('pong', () => {
            client.isAlive = true;
        });

        ws.on('close', () => {
            Logger.info('WsServer', `Client disconnected: ${clientId}`);
            this.clients.delete(ws);
        });

        ws.on('error', (error: Error) => {
            Logger.error('WsServer', `WebSocket error for ${clientId}: ${error.message}`);
        });
    }

    private handleMessage(client: WsClient, data: Buffer): void {
        try {
            const message: WsMessage = JSON.parse(data.toString());

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscribe(client, message.channels);
                    break;

                case 'unsubscribe':
                    this.handleUnsubscribe(client, message.channels);
                    break;

                case 'ping':
                    this.sendToClient(client, {
                        type: 'pong',
                        channel: 'system',
                        data: {},
                        timestamp: new Date().toISOString()
                    });
                    break;

                default:
                    this.sendToClient(client, {
                        type: 'system.error',
                        channel: 'system',
                        data: {
                            code: 'INVALID_MESSAGE',
                            message: `Unknown message type: ${(message as { type: string }).type}`
                        },
                        timestamp: new Date().toISOString()
                    });
            }
        } catch (error) {
            Logger.error('WsServer', `Failed to parse message: ${error}`);
            this.sendToClient(client, {
                type: 'system.error',
                channel: 'system',
                data: {
                    code: 'INVALID_MESSAGE',
                    message: 'Invalid JSON message'
                },
                timestamp: new Date().toISOString()
            });
        }
    }

    private handleSubscribe(client: WsClient, channels: EventChannel[]): void {
        const validChannels: EventChannel[] = ['system', 'character', 'combat', 'chat', 'world', 'movement', 'party'];
        
        for (const channel of channels) {
            if (validChannels.includes(channel)) {
                client.channels.add(channel);
            }
        }

        this.sendToClient(client, {
            type: 'system.subscribed',
            channel: 'system',
            data: {
                channels: Array.from(client.channels)
            },
            timestamp: new Date().toISOString()
        });

        Logger.debug('WsServer', `Client ${client.id} subscribed to: ${Array.from(client.channels).join(', ')}`);
    }

    private handleUnsubscribe(client: WsClient, channels: EventChannel[]): void {
        for (const channel of channels) {
            client.channels.delete(channel);
        }

        this.sendToClient(client, {
            type: 'system.unsubscribed',
            channel: 'system',
            data: {
                channels: Array.from(client.channels)
            },
            timestamp: new Date().toISOString()
        });
    }

    private sendToClient(client: WsClient, event: GameEvent): void {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(event));
        }
    }

    private broadcast(event: GameEvent): void {
        this.clients.forEach((client) => {
            if (client.channels.has(event.channel)) {
                this.sendToClient(client, event);
            }
        });
    }

    stop(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.clients.forEach((client) => {
            client.ws.close();
        });
        this.clients.clear();

        if (this.wss) {
            this.wss.close();
        }

        Logger.info('WsServer', 'WebSocket server stopped');
    }
}
