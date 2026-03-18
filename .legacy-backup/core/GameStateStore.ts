import { EventBus } from './EventBus';
import { Logger } from '../logger/Logger';
import type { 
    CharacterStatsChangedEvent
} from './EventBus';

/**
 * @fileoverview GameStateStore - Central state store for all game data
 * 
 * Singleton class that maintains the complete game state including:
 * - Character information (stats, position, skills)
 * - World state (NPCs, players, items)
 * - Inventory contents
 * - Combat state (target, inCombat flag)
 * - Party information
 * - Connection status
 * 
 * State updates automatically emit events via EventBus for real-time updates.
 * 
 * @module core/GameStateStore
 * @example
 * ```typescript
 * import { GameStateStore } from './core/GameStateStore';
 * 
 * // Get character state
 * const character = GameStateStore.getCharacter();
 * console.log(`Character: ${character.name}, Level: ${character.level}`);
 * 
 * // Get nearby NPCs
 * const npcs = GameStateStore.getNearbyNpcs(600, { attackable: true });
 * 
 * // Update character
 * GameStateStore.updateCharacter({ hp: { current: 50, max: 100 } });
 * ```
 */

/**
 * 3D position in the game world.
 */
export interface Position {
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
    /** Z coordinate (height) */
    z: number;
    /** Heading direction (0-65535) */
    heading?: number;
}

/**
 * HP/MP/CP vital statistics with current and maximum values.
 */
export interface HpMpCp {
    /** Current value */
    current: number;
    /** Maximum value */
    max: number;
}

/**
 * Character combat and base statistics.
 */
export interface CharacterStats {
    /** Strength */
    str: number;
    /** Constitution */
    con: number;
    /** Dexterity */
    dex: number;
    /** Intelligence */
    int: number;
    /** Wit */
    wit: number;
    /** Mental */
    men: number;
    /** Physical Attack */
    pAtk: number;
    /** Magic Attack */
    mAtk: number;
    /** Physical Defense */
    pDef: number;
    /** Magic Defense */
    mDef: number;
    /** Attack Speed */
    atkSpd: number;
    /** Casting Speed */
    castSpd: number;
    /** Accuracy */
    accuracy: number;
    /** Evasion */
    evasion: number;
    /** Critical Hit Rate */
    critical: number;
    /** Movement Speed */
    speed: number;
}

/**
 * Active buff/debuff on the character.
 */
export interface Buff {
    /** Skill ID */
    skillId: number;
    /** Buff name */
    name: string;
    /** Buff level */
    level: number;
    /** Remaining duration in seconds */
    remainingTime: number;
    /** Whether this is a debuff */
    isDebuff: boolean;
    /** Icon resource path */
    icon?: string;
}

/**
 * Complete character state.
 */
export interface CharacterState {
    /** Unique object ID */
    objectId: number;
    /** Character name */
    name: string;
    /** Character title */
    title: string;
    /** Class ID */
    classId: number;
    /** Class name (e.g., "Human Fighter") */
    className: string;
    /** Character level */
    level: number;
    /** Race name */
    race: string;
    /** Sex (Male/Female) */
    sex: string;
    /** HP stats */
    hp: HpMpCp;
    /** MP stats */
    mp: HpMpCp;
    /** CP stats */
    cp: HpMpCp;
    /** Experience points */
    exp: number;
    /** Experience percentage (0-100) */
    expPercent: number;
    /** Skill points */
    sp: number;
    /** Karma value */
    karma: number;
    /** PVP kill count */
    pvpKills: number;
    /** PK kill count */
    pkKills: number;
    /** Current position */
    position: Position;
    /** Character statistics */
    stats: Partial<CharacterStats>;
    /** Active buffs */
    buffs: Buff[];
    /** Learned skills */
    skills: SkillInfo[];
    /** Current target object ID */
    targetObjectId?: number;
}

/**
 * Skill information.
 */
export interface SkillInfo {
    /** Skill ID */
    id: number;
    /** Skill level */
    level: number;
    /** Skill name */
    name?: string;
    /** Whether skill is passive */
    isPassive?: boolean;
    /** Alternative skill ID reference */
    skillId?: number;
}

/**
 * NPC information.
 */
export interface NpcInfo {
    /** Unique object ID */
    objectId: number;
    /** NPC template ID */
    npcId: number;
    /** NPC name */
    name: string;
    /** NPC level */
    level: number;
    /** HP stats */
    hp: HpMpCp;
    /** Whether NPC can be attacked */
    isAttackable: boolean;
    /** Whether NPC is aggressive */
    isAggressive: boolean;
    /** Current position */
    position: Position;
    /** Distance from player (calculated) */
    distance?: number;
}

/**
 * Player (other character) information.
 */
export interface PlayerInfo {
    /** Unique object ID */
    objectId: number;
    /** Player name */
    name: string;
    /** Player level */
    level: number;
    /** Class ID */
    classId: number;
    /** HP stats */
    hp: HpMpCp;
    /** Current position */
    position: Position;
    /** Distance from player (calculated) */
    distance?: number;
}

/**
 * Dropped item in the world.
 */
export interface ItemDrop {
    /** Unique object ID */
    objectId: number;
    /** Item template ID */
    itemId: number;
    /** Item name */
    name: string;
    /** Stack count */
    count: number;
    /** Current position */
    position: Position;
}

/**
 * Item in character inventory.
 */
export interface InventoryItem {
    /** Unique object ID */
    objectId: number;
    /** Item template ID */
    itemId: number;
    /** Item name */
    name: string;
    /** Stack count */
    count: number;
    /** Item type */
    type: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
    /** Whether item is equipped */
    equipped: boolean;
    /** Inventory slot number */
    slot: number;
    /** Enchant level */
    enchant: number;
    /** Mana (for shadow items) */
    mana: number;
    /** Item grade (No, D, C, B, A, S) */
    grade?: 'No' | 'D' | 'C' | 'B' | 'A' | 'S';
}

/**
 * Complete inventory state.
 */
export interface InventoryState {
    /** Adena (gold) amount */
    adena: number;
    /** Weight information */
    weight: { current: number; max: number };
    /** Inventory items */
    items: InventoryItem[];
}

/**
 * Combat state.
 */
export interface CombatState {
    /** Current target object ID */
    targetObjectId?: number;
    /** Target name */
    targetName?: string;
    /** Target type */
    targetType?: 'NPC' | 'PLAYER';
    /** Last attack timestamp */
    lastAttackTime?: number;
    /** Whether in combat */
    inCombat: boolean;
}

/**
 * Party member information.
 */
export interface PartyMember {
    /** Unique object ID */
    objectId: number;
    /** Member name */
    name: string;
    /** Class ID */
    classId: number;
    /** Member level */
    level: number;
    /** HP stats */
    hp: HpMpCp;
    /** MP stats */
    mp: HpMpCp;
    /** CP stats */
    cp: HpMpCp;
    /** Whether member is online */
    isOnline: boolean;
}

/**
 * Party state.
 */
export interface PartyState {
    /** Whether in a party */
    inParty: boolean;
    /** Whether local player is party leader */
    isLeader: boolean;
    /** Party members */
    members: PartyMember[];
}

/**
 * World state containing all entities.
 */
export interface WorldState {
    /** NPCs by object ID */
    npcs: Map<number, NpcInfo>;
    /** Players by object ID */
    players: Map<number, PlayerInfo>;
    /** Dropped items by object ID */
    items: Map<number, ItemDrop>;
}

/**
 * Connection state information.
 */
export interface ConnectionState {
    /** Current connection phase */
    phase: string;
    /** Login server connection info */
    loginServer: { connected: boolean; host: string; port: number };
    /** Game server connection info */
    gameServer: { connected: boolean; host: string; port: number };
    /** Connection uptime in seconds */
    uptime: number;
    /** Last ping time in ms */
    pingMs?: number;
}

/**
 * Central state store for all game data.
 * 
 * This singleton class maintains the complete game state and provides
 * methods for reading and updating state. All state changes automatically
 * emit events via EventBus for real-time updates.
 * 
 * @class GameStateStoreClass
 */
class GameStateStoreClass {
    private character: Partial<CharacterState> = {};
    private world: WorldState = {
        npcs: new Map(),
        players: new Map(),
        items: new Map()
    };
    private inventory: Partial<InventoryState> = { adena: 0, weight: { current: 0, max: 0 }, items: [] };
    private combat: CombatState = { inCombat: false };
    private party: PartyState = { inParty: false, isLeader: false, members: [] };
    private connection: Partial<ConnectionState> = { phase: 'DISCONNECTED' };

    private startTime: number = Date.now();

    // ==================== Character Methods ====================

    /**
     * Get the current character state.
     * @returns {Partial<CharacterState>} Copy of character state
     */
    getCharacter(): Partial<CharacterState> {
        return { ...this.character };
    }

    /**
     * Update character state with partial data.
     * Automatically emits 'character.stats_changed' event if HP/MP/CP change.
     * 
     * @param {Partial<CharacterState>} data - Data to merge into character state
     */
    updateCharacter(data: Partial<CharacterState>): void {
        const prevHp = this.character.hp;
        const prevMp = this.character.mp;
        const prevCp = this.character.cp;

        this.character = { ...this.character, ...data };

        // Emit stats changed event if HP/MP/CP changed
        if (data.hp || data.mp || data.cp) {
            const eventData: CharacterStatsChangedEvent['data'] = {};
            
            if (data.hp && prevHp) {
                eventData.hp = { 
                    ...data.hp, 
                    delta: data.hp.current - prevHp.current 
                };
            }
            if (data.mp && prevMp) {
                eventData.mp = { 
                    ...data.mp, 
                    delta: data.mp.current - prevMp.current 
                };
            }
            if (data.cp && prevCp) {
                eventData.cp = { 
                    ...data.cp, 
                    delta: data.cp.current - prevCp.current 
                };
            }

            EventBus.emitEvent({
                type: 'character.stats_changed',
                channel: 'character',
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Update character position and emit movement event.
     * @param {Position} position - New position
     */
    updatePosition(position: Position): void {
        this.character.position = position;
        
        EventBus.emitEvent({
            type: 'movement.position_changed',
            channel: 'movement',
            data: {
                objectId: this.character.objectId || 0,
                position,
                speed: this.character.stats?.speed || 0,
                isRunning: true
            },
            timestamp: new Date().toISOString()
        });
    }

    // ==================== World Methods ====================

    /**
     * Get the current world state (NPCs, players, items).
     * @returns {WorldState} Copy of world state with new Maps
     */
    getWorld(): WorldState {
        return {
            npcs: new Map(this.world.npcs),
            players: new Map(this.world.players),
            items: new Map(this.world.items)
        };
    }

    /**
     * Add an NPC to the world and emit spawn event.
     * @param {NpcInfo} npc - NPC to add
     */
    addNpc(npc: NpcInfo): void {
        this.world.npcs.set(npc.objectId, npc);
        
        EventBus.emitEvent({
            type: 'world.npc_spawned',
            channel: 'world',
            data: {
                objectId: npc.objectId,
                npcId: npc.npcId,
                name: npc.name,
                level: npc.level,
                position: npc.position,
                isAttackable: npc.isAttackable
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Remove an NPC from the world and emit despawn event.
     * @param {number} objectId - Object ID of NPC to remove
     */
    removeNpc(objectId: number): void {
        this.world.npcs.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.npc_despawned',
            channel: 'world',
            data: { objectId },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Update an existing NPC with partial data.
     * @param {number} objectId - Object ID of NPC to update
     * @param {Partial<NpcInfo>} data - Data to merge
     */
    updateNpc(objectId: number, data: Partial<NpcInfo>): void {
        const npc = this.world.npcs.get(objectId);
        if (npc) {
            this.world.npcs.set(objectId, { ...npc, ...data });
        }
    }

    /**
     * Add a player to the world.
     * @param {PlayerInfo} player - Player to add
     */
    addPlayer(player: PlayerInfo): void {
        this.world.players.set(player.objectId, player);
    }

    /**
     * Remove a player from the world.
     * @param {number} objectId - Object ID of player to remove
     */
    removePlayer(objectId: number): void {
        this.world.players.delete(objectId);
    }

    /**
     * Add a dropped item to the world and emit event.
     * @param {ItemDrop} item - Item to add
     */
    addItemDrop(item: ItemDrop): void {
        this.world.items.set(item.objectId, item);
        
        EventBus.emitEvent({
            type: 'world.item_dropped',
            channel: 'world',
            data: {
                objectId: item.objectId,
                itemId: item.itemId,
                name: item.name,
                count: item.count,
                position: item.position
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Remove a dropped item from the world and emit event.
     * @param {number} objectId - Object ID of item to remove
     * @param {number} [pickedByObjectId] - Object ID of entity that picked up the item
     */
    removeItemDrop(objectId: number, pickedByObjectId?: number): void {
        this.world.items.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.item_picked_up',
            channel: 'world',
            data: { objectId, pickedByObjectId: pickedByObjectId || 0 },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get nearby NPCs within specified radius.
     * 
     * @param {number} [radius=600] - Search radius in game units
     * @param {Object} [options] - Filter options
     * @param {boolean} [options.attackable] - Filter by attackable flag
     * @param {boolean} [options.alive] - Filter by alive status (HP > 0)
     * @returns {NpcInfo[]} Array of nearby NPCs with distance property
     */
    getNearbyNpcs(radius: number = 600, options?: { attackable?: boolean; alive?: boolean }): NpcInfo[] {
        const characterPos = this.character.position;
        if (!characterPos) return [];

        return Array.from(this.world.npcs.values()).filter(npc => {
            const distance = this.calculateDistance(characterPos, npc.position);
            if (distance > radius) return false;
            if (options?.attackable !== undefined && npc.isAttackable !== options.attackable) return false;
            if (options?.alive !== undefined) {
                const isAlive = npc.hp.current > 0;
                if (isAlive !== options.alive) return false;
            }
            return true;
        }).map(npc => ({ ...npc, distance: this.calculateDistance(characterPos, npc.position) }));
    }

    /**
     * Get nearby players within specified radius.
     * @param {number} [radius=600] - Search radius in game units
     * @returns {PlayerInfo[]} Array of nearby players with distance property
     */
    getNearbyPlayers(radius: number = 600): PlayerInfo[] {
        const characterPos = this.character.position;
        if (!characterPos) return [];

        return Array.from(this.world.players.values()).filter(player => {
            const distance = this.calculateDistance(characterPos, player.position);
            return distance <= radius;
        }).map(player => ({ ...player, distance: this.calculateDistance(characterPos, player.position) }));
    }

    /**
     * Get nearby dropped items within specified radius.
     * @param {number} [radius=600] - Search radius in game units
     * @returns {ItemDrop[]} Array of nearby items
     */
    getNearbyItems(radius: number = 600): ItemDrop[] {
        const characterPos = this.character.position;
        if (!characterPos) return [];

        return Array.from(this.world.items.values()).filter(item => {
            const distance = this.calculateDistance(characterPos, item.position);
            return distance <= radius;
        });
    }

    // ==================== Inventory Methods ====================

    /**
     * Get the current inventory state.
     * @returns {InventoryState} Copy of inventory state
     */
    getInventory(): InventoryState {
        return {
            adena: this.inventory.adena || 0,
            weight: this.inventory.weight || { current: 0, max: 0 },
            items: this.inventory.items || []
        };
    }

    /**
     * Update inventory with partial data.
     * @param {Partial<InventoryState>} data - Data to merge
     */
    updateInventory(data: Partial<InventoryState>): void {
        this.inventory = { ...this.inventory, ...data };
        Logger.debug('GameStateStore', `Inventory updated: ${data.items?.length || 0} items, adena=${data.adena || this.inventory.adena}`);
    }

    /**
     * Add or update a single item in inventory.
     * Emits 'inventory.changed' event.
     * @param {InventoryItem} item - Item to add or update
     */
    addOrUpdateInventoryItem(item: InventoryItem): void {
        const items = this.inventory.items || [];
        const existingIndex = items.findIndex(i => i.objectId === item.objectId);
        
        if (existingIndex >= 0) {
            items[existingIndex] = item;
            Logger.debug('GameStateStore', `Updated item: ${item.name} (objectId=${item.objectId})`);
        } else {
            items.push(item);
            Logger.debug('GameStateStore', `Added item: ${item.name} (objectId=${item.objectId})`);
        }
        
        this.inventory.items = items;
        
        EventBus.emitEvent({
            type: 'inventory.changed',
            channel: 'character',
            data: {
                action: existingIndex >= 0 ? 'updated' : 'added',
                item: {
                    objectId: item.objectId,
                    itemId: item.itemId,
                    name: item.name,
                    count: item.count,
                    equipped: item.equipped,
                    enchant: item.enchant,
                    slot: item.slot,
                }
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Remove an item from inventory by object ID.
     * Emits 'inventory.changed' event.
     * @param {number} objectId - Object ID of item to remove
     * @returns {InventoryItem | null} Removed item or null if not found
     */
    removeInventoryItem(objectId: number): InventoryItem | null {
        const items = this.inventory.items || [];
        const index = items.findIndex(i => i.objectId === objectId);
        
        if (index >= 0) {
            const removedItem = items[index]!;
            items.splice(index, 1);
            this.inventory.items = items;
            
            Logger.debug('GameStateStore', `Removed item: ${removedItem.name} (objectId=${objectId})`);
            
            EventBus.emitEvent({
                type: 'inventory.changed',
                channel: 'character',
                data: {
                    action: 'removed',
                    objectId: objectId,
                    itemId: removedItem.itemId,
                    name: removedItem.name,
                },
                timestamp: new Date().toISOString()
            });
            
            return removedItem;
        }
        
        return null;
    }

    /**
     * Get a single item by object ID.
     * @param {number} objectId - Object ID to search for
     * @returns {InventoryItem | undefined} Found item or undefined
     */
    getInventoryItemByObjectId(objectId: number): InventoryItem | undefined {
        return (this.inventory.items || []).find(i => i.objectId === objectId);
    }

    /**
     * Get all items matching a specific item ID.
     * @param {number} itemId - Item template ID to search for
     * @returns {InventoryItem[]} Array of matching items
     */
    getInventoryItemsByItemId(itemId: number): InventoryItem[] {
        return (this.inventory.items || []).filter(i => i.itemId === itemId);
    }

    /**
     * Get all equipped items.
     * @returns {InventoryItem[]} Array of equipped items
     */
    getEquippedItems(): InventoryItem[] {
        return (this.inventory.items || []).filter(i => i.equipped);
    }

    /**
     * Get equipped item in a specific slot.
     * @param {number} slot - Equipment slot number
     * @returns {InventoryItem | undefined} Found item or undefined
     */
    getEquippedItemBySlot(slot: number): InventoryItem | undefined {
        return (this.inventory.items || []).find(i => i.equipped && i.slot === slot);
    }

    /**
     * Update adena (gold) amount and emit event.
     * @param {number} amount - New adena amount
     */
    updateAdena(amount: number): void {
        const oldAdena = this.inventory.adena || 0;
        this.inventory.adena = amount;
        
        EventBus.emitEvent({
            type: 'inventory.adena_changed',
            channel: 'character',
            data: {
                oldAmount: oldAdena,
                newAmount: amount,
                delta: amount - oldAdena,
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Clear all inventory data and emit event.
     * Called on disconnect.
     */
    clearInventory(): void {
        this.inventory = { adena: 0, weight: { current: 0, max: 0 }, items: [] };
        
        EventBus.emitEvent({
            type: 'inventory.cleared',
            channel: 'character',
            data: {
                items: [],
                adena: 0,
                reason: 'disconnected'
            },
            timestamp: new Date().toISOString()
        });
        
        Logger.debug('GameStateStore', 'Inventory cleared');
    }

    // ==================== Combat Methods ====================

    /**
     * Get current combat state.
     * @returns {CombatState} Copy of combat state
     */
    getCombat(): CombatState {
        return { ...this.combat };
    }

    /**
     * Set the current target.
     * @param {number} [objectId] - Target object ID
     * @param {string} [name] - Target name
     * @param {'NPC' | 'PLAYER'} [type] - Target type
     */
    setTarget(objectId?: number, name?: string, type?: 'NPC' | 'PLAYER'): void {
        this.combat.targetObjectId = objectId;
        this.combat.targetName = name;
        this.combat.targetType = type;
    }

    /**
     * Clear the current target.
     */
    clearTarget(): void {
        this.combat.targetObjectId = undefined;
        this.combat.targetName = undefined;
        this.combat.targetType = undefined;
    }

    /**
     * Set the in-combat flag.
     * @param {boolean} inCombat - Whether in combat
     */
    setInCombat(inCombat: boolean): void {
        this.combat.inCombat = inCombat;
    }

    // ==================== Party Methods ====================

    /**
     * Get current party state.
     * @returns {PartyState} Copy of party state
     */
    getParty(): PartyState {
        return { ...this.party };
    }

    /**
     * Update party state with partial data.
     * @param {Partial<PartyState>} data - Data to merge
     */
    updateParty(data: Partial<PartyState>): void {
        this.party = { ...this.party, ...data };
    }

    /**
     * Add or update a party member.
     * @param {PartyMember} member - Member to add or update
     */
    addPartyMember(member: PartyMember): void {
        const existingIndex = this.party.members.findIndex(m => m.objectId === member.objectId);
        if (existingIndex >= 0) {
            this.party.members[existingIndex] = member;
        } else {
            this.party.members.push(member);
        }
        this.party.inParty = this.party.members.length > 0;
    }

    /**
     * Remove a party member.
     * @param {number} objectId - Object ID of member to remove
     */
    removePartyMember(objectId: number): void {
        this.party.members = this.party.members.filter(m => m.objectId !== objectId);
        this.party.inParty = this.party.members.length > 0;
        if (!this.party.inParty) {
            this.party.isLeader = false;
        }
    }

    // ==================== Skills Methods ====================

    /**
     * Update character skills.
     * @param {SkillInfo[]} skills - New skills array
     */
    updateSkills(skills: SkillInfo[]): void {
        this.character.skills = skills;
    }

    /**
     * Get character skills.
     * @returns {SkillInfo[]} Copy of skills array
     */
    getSkills(): SkillInfo[] {
        return this.character.skills || [];
    }

    /**
     * Clear all skills and emit event.
     * Called on disconnect.
     */
    clearSkills(): void {
        this.character.skills = [];
        
        EventBus.emitEvent({
            type: 'character.skills_cleared',
            channel: 'character',
            data: {
                skills: [],
                totalCount: 0,
                activeCount: 0,
                passiveCount: 0,
                reason: 'disconnected'
            },
            timestamp: new Date().toISOString()
        });
        
        Logger.debug('GameStateStore', 'Skills cleared due to disconnect');
    }

    // ==================== Connection Methods ====================

    /**
     * Get current connection state.
     * @returns {Partial<ConnectionState>} Copy of connection state with uptime
     */
    getConnection(): Partial<ConnectionState> {
        return {
            ...this.connection,
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    /**
     * Update connection state with partial data.
     * @param {Partial<ConnectionState>} data - Data to merge
     */
    updateConnection(data: Partial<ConnectionState>): void {
        this.connection = { ...this.connection, ...data };
    }

    // ==================== Utility Methods ====================

    /**
     * Calculate Euclidean distance between two positions.
     * @private
     * @param {Position} pos1 - First position
     * @param {Position} pos2 - Second position
     * @returns {number} Distance in game units
     */
    private calculateDistance(pos1: Position, pos2: Position): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Reset all state to initial values.
     * Called on disconnect or for testing.
     */
    reset(): void {
        this.character = {};
        this.world = { npcs: new Map(), players: new Map(), items: new Map() };
        this.inventory = { adena: 0, weight: { current: 0, max: 0 }, items: [] };
        this.combat = { inCombat: false };
        this.party = { inParty: false, isLeader: false, members: [] };
        this.connection = { phase: 'DISCONNECTED' };
        this.startTime = Date.now();
        
        EventBus.emitEvent({
            type: 'character.skills_cleared',
            channel: 'character',
            data: {
                skills: [],
                totalCount: 0,
                activeCount: 0,
                passiveCount: 0,
                reason: 'reset'
            },
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Global singleton instance of GameStateStore.
 * Use this for all state operations.
 * 
 * @example
 * ```typescript
 * import { GameStateStore } from './core/GameStateStore';
 * 
 * // Read state
 * const char = GameStateStore.getCharacter();
 * const npcs = GameStateStore.getNearbyNpcs(600);
 * 
 * // Update state
 * GameStateStore.updateCharacter({ level: 20 });
 * GameStateStore.addNpc({ objectId: 1, name: 'NPC', ... });
 * ```
 */
export const GameStateStore = new GameStateStoreClass();
