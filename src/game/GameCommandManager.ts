import { GameClient } from './GameClient';
import { Logger } from '../logger/Logger';
import { GameStateStore } from '../core/GameStateStore';
import { EventBus } from '../core/EventBus';
import { MoveToLocation, AttackRequest, Action, RequestSocialAction, Say2, ChatType, SocialActions, ChangeWaitType2, UseSkill, UseItem, DropItem, RequestJoinParty } from './packets/outgoing';

/**
 * GameCommandManager - Singleton for sending game commands from API
 * 
 * This class provides an interface for API routes to send commands
 * to the game server through the active GameClient instance.
 */
class GameCommandManagerClass {
    private gameClient: GameClient | null = null;

    /**
     * Register the active GameClient instance
     */
    setGameClient(client: GameClient | null): void {
        this.gameClient = client;
        if (client) {
            Logger.info('GameCommandManager', 'GameClient registered');
        } else {
            Logger.info('GameCommandManager', 'GameClient unregistered');
        }
    }

    /**
     * Check if game client is available and in game
     */
    isReady(): boolean {
        return this.gameClient !== null && GameStateStore.getConnection().phase === 'IN_GAME';
    }

    /**
     * Get current character position
     */
    getPosition(): { x: number; y: number; z: number } | null {
        return GameStateStore.getCharacter().position || null;
    }

    /**
     * Send MoveToLocation packet
     */
    moveTo(x: number, y: number, z: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot move: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot move: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new MoveToLocation(x, y, z, pos.x, pos.y, pos.z, 1));
            Logger.info('GameCommandManager', `MoveTo: ${x}, ${y}, ${z}`);
            
            // Update GameStateStore
            GameStateStore.updatePosition({ x, y, z });
            
            // Emit event
            EventBus.emitEvent({
                type: 'movement.position_changed',
                channel: 'movement',
                data: {
                    objectId: GameStateStore.getCharacter().objectId || 0,
                    position: { x, y, z },
                    speed: GameStateStore.getCharacter().stats?.speed || 0,
                    isRunning: true
                },
                timestamp: new Date().toISOString()
            });
            
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Move failed: ${error}`);
            return false;
        }
    }

    /**
     * Send AttackRequest packet
     */
    attack(objectId: number, shiftClick: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot attack: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot attack: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new AttackRequest(objectId, pos.x, pos.y, pos.z, shiftClick));
            Logger.info('GameCommandManager', `Attack: ${objectId}, shift=${shiftClick}`);
            
            // Update combat state
            GameStateStore.setInCombat(true);
            
            // Emit event
            EventBus.emitEvent({
                type: 'combat.attack_sent',
                channel: 'combat',
                data: {
                    attackerObjectId: GameStateStore.getCharacter().objectId || 0,
                    targetObjectId: objectId,
                    damage: 0, // Unknown at this point
                    isCritical: false,
                    isMiss: false,
                    attackType: 'MELEE'
                },
                timestamp: new Date().toISOString()
            });
            
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Attack failed: ${error}`);
            return false;
        }
    }

    /**
     * Send Action packet (for targeting)
     */
    action(objectId: number, shiftClick: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot action: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot action: position unknown');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new Action(objectId, pos.x, pos.y, pos.z, shiftClick));
            Logger.info('GameCommandManager', `Action: ${objectId}, shift=${shiftClick}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Action failed: ${error}`);
            return false;
        }
    }

    /**
     * Send RequestSocialAction packet
     */
    socialAction(actionId: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot social action: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new RequestSocialAction(actionId));
            Logger.info('GameCommandManager', `SocialAction: ${actionId}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Social action failed: ${error}`);
            return false;
        }
    }

    /**
     * Toggle sit/stand
     * true = Stand, false = Sit
     */
    toggleSit(stand: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot toggle sit: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new ChangeWaitType2(stand));
            Logger.info('GameCommandManager', `ChangeWaitType2: ${stand ? 'Stand' : 'Sit'}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Toggle sit failed: ${error}`);
            return false;
        }
    }

    /**
     * Send Say2 packet (chat message)
     */
    sendChat(message: string, chatType: ChatType = ChatType.ALL, target: string = ''): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot send chat: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new Say2(message, chatType, target));
            Logger.info('GameCommandManager', `Chat [${chatType}]: ${message.substring(0, 50)}`);
            
            // Emit event
            EventBus.emitEvent({
                type: 'chat.message',
                channel: 'chat',
                data: {
                    channel: ChatType[chatType],
                    message,
                    senderName: GameStateStore.getCharacter().name || 'Unknown',
                    senderObjectId: GameStateStore.getCharacter().objectId,
                    receivedAt: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            });
            
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Chat failed: ${error}`);
            return false;
        }
    }

    /**
     * Pickup item from ground
     * In L2 Interlude, need to click (Action) on item to pick it up
     */
    async pickupItem(objectId: number): Promise<boolean> {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot pickup: not in game');
            return false;
        }

        // Find item in world state
        const world = GameStateStore.getWorld();
        const item = world.items.get(objectId);
        
        if (!item) {
            Logger.warn('GameCommandManager', `Item ${objectId} not found`);
            return false;
        }

        // Move to item location first
        const moveSuccess = this.moveTo(item.position.x, item.position.y, item.position.z);
        
        if (moveSuccess) {
            Logger.info('GameCommandManager', `Moving to pickup: ${item.name} (${objectId}) at ${item.position.x},${item.position.y},${item.position.z}`);
            
            // Emit event
            EventBus.emitEvent({
                type: 'world.item_picking_up',
                channel: 'world',
                data: {
                    objectId: item.objectId,
                    itemId: item.itemId,
                    name: item.name,
                    count: item.count
                },
                timestamp: new Date().toISOString()
            });
            
            // Send Action packet on item to pick it up (click on item)
            // Small delay to ensure we arrived
            setTimeout(() => {
                this.action(objectId, false);
                Logger.info('GameCommandManager', `Clicked on item ${objectId} to pickup`);
            }, 500);
            
            return true;
        }
        
        return false;
    }

    /**
     * Pickup nearest item
     */
    async pickupNearestItem(radius: number = 200): Promise<boolean> {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot pickup: not in game');
            return false;
        }

        const items = GameStateStore.getNearbyItems(radius);
        
        if (items.length === 0) {
            Logger.info('GameCommandManager', 'No items nearby to pickup');
            return false;
        }

        // Pickup closest item
        const item = items[0];
        return this.pickupItem(item.objectId);
    }

    /**
     * Send UseSkill packet
     */
    useSkill(skillId: number, ctrlPressed: boolean = false, shiftPressed: boolean = false): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot use skill: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new UseSkill(skillId, ctrlPressed, shiftPressed));
            Logger.info('GameCommandManager', `UseSkill: ${skillId}, ctrl=${ctrlPressed}, shift=${shiftPressed}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Use skill failed: ${error}`);
            return false;
        }
    }

    /**
     * Send UseItem packet
     */
    useItem(objectId: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot use item: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new UseItem(objectId));
            Logger.info('GameCommandManager', `UseItem: ${objectId}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Use item failed: ${error}`);
            return false;
        }
    }

    /**
     * Send DropItem packet
     */
    dropItem(objectId: number, count: number, x?: number, y?: number, z?: number): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot drop item: not in game');
            return false;
        }

        // Use current position if coords not provided
        let dropX = x;
        let dropY = y;
        let dropZ = z;

        if (dropX === undefined || dropY === undefined || dropZ === undefined) {
            const pos = this.getPosition();
            if (!pos) {
                Logger.warn('GameCommandManager', 'Cannot drop item: position unknown');
                return false;
            }
            dropX = pos.x;
            dropY = pos.y;
            dropZ = pos.z;
        }

        try {
            this.gameClient!.sendPacket(new DropItem(objectId, count, dropX, dropY, dropZ));
            Logger.info('GameCommandManager', `DropItem: ${objectId} x${count} at ${dropX},${dropY},${dropZ}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Drop item failed: ${error}`);
            return false;
        }
    }

    /**
     * Send RequestJoinParty - invite player to party
     */
    inviteToParty(playerName: string): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot invite to party: not in game');
            return false;
        }

        try {
            this.gameClient!.sendPacket(new RequestJoinParty(playerName));
            Logger.info('GameCommandManager', `InviteToParty: ${playerName}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Invite to party failed: ${error}`);
            return false;
        }
    }

    /**
     * Leave party - uses /leaveparty chat command
     * Note: L2 Interlude doesn't have a specific leave party packet
     */
    leaveParty(): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot leave party: not in game');
            return false;
        }

        try {
            // Send /leaveparty command via ALL chat
            this.gameClient!.sendPacket(new Say2('/leaveparty', ChatType.ALL, ''));
            Logger.info('GameCommandManager', 'LeaveParty command sent');
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Leave party failed: ${error}`);
            return false;
        }
    }

    /**
     * Stop movement - handled locally (StopMove packet not available in Interlude)
     */
    stopMove(): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot stop move: not in game');
            return false;
        }

        const pos = this.getPosition();
        if (!pos) {
            Logger.warn('GameCommandManager', 'Cannot stop move: position unknown');
            return false;
        }

        try {
            // StopMove packet doesn't exist in Interlude protocol
            // Just log the action for now - client stops locally
            Logger.info('GameCommandManager', `StopMove at ${pos.x},${pos.y},${pos.z}`);
            return true;
        } catch (error) {
            Logger.error('GameCommandManager', `Stop move failed: ${error}`);
            return false;
        }
    }

    /**
     * Follow target - simplified implementation using Action packet
     */
    follow(objectId: number, minDistance: number = 100): boolean {
        if (!this.isReady()) {
            Logger.warn('GameCommandManager', 'Cannot follow: not in game');
            return false;
        }

        const world = GameStateStore.getWorld();
        const target = world.npcs.get(objectId) || world.players.get(objectId);

        if (!target) {
            Logger.warn('GameCommandManager', `Cannot follow: target ${objectId} not found`);
            return false;
        }

        // Store target in GameStateStore
        GameStateStore.setTarget(objectId, target.name, world.npcs.has(objectId) ? 'NPC' : 'PLAYER');

        Logger.info('GameCommandManager', `Follow ${target.name} (${objectId}) with minDistance=${minDistance}`);
        return true;
    }
}

export const GameCommandManager = new GameCommandManagerClass();
