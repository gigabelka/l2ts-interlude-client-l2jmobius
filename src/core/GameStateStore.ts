import { EventBus } from './EventBus';
import { Logger } from '../logger/Logger';
import type { 
    CharacterStatsChangedEvent, 
    WorldNpcSpawnedEvent, 
    WorldNpcDespawnedEvent,
    MovementPositionChangedEvent 
} from './EventBus';

// Interfaces for state structures
export interface Position {
    x: number;
    y: number;
    z: number;
    heading?: number;
}

export interface HpMpCp {
    current: number;
    max: number;
}

export interface CharacterStats {
    str: number;
    con: number;
    dex: number;
    int: number;
    wit: number;
    men: number;
    pAtk: number;
    mAtk: number;
    pDef: number;
    mDef: number;
    atkSpd: number;
    castSpd: number;
    accuracy: number;
    evasion: number;
    critical: number;
    speed: number;
}

export interface Buff {
    skillId: number;
    name: string;
    level: number;
    remainingTime: number;
    isDebuff: boolean;
    icon?: string;
}

export interface CharacterState {
    objectId: number;
    name: string;
    title: string;
    classId: number;
    className: string;
    level: number;
    race: string;
    sex: string;
    hp: HpMpCp;
    mp: HpMpCp;
    cp: HpMpCp;
    exp: number;
    expPercent: number;
    sp: number;
    karma: number;
    pvpKills: number;
    pkKills: number;
    position: Position;
    stats: Partial<CharacterStats>;
    buffs: Buff[];
    skills: SkillInfo[];
    targetObjectId?: number;
}

export interface SkillInfo {
    id: number;
    level: number;
    name?: string;
    isPassive?: boolean;
    skillId?: number;
}

export interface NpcInfo {
    objectId: number;
    npcId: number;
    name: string;
    level: number;
    hp: HpMpCp;
    isAttackable: boolean;
    isAggressive: boolean;
    position: Position;
    distance?: number;
}

export interface PlayerInfo {
    objectId: number;
    name: string;
    level: number;
    classId: number;
    hp: HpMpCp;
    position: Position;
    distance?: number;
}

export interface ItemDrop {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    position: Position;
}

export interface InventoryItem {
    objectId: number;
    itemId: number;
    name: string;
    count: number;
    type: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
    equipped: boolean;
    slot: number;
    enchant: number;
    mana: number;
    grade?: 'No' | 'D' | 'C' | 'B' | 'A' | 'S';
}

export interface InventoryState {
    adena: number;
    weight: { current: number; max: number };
    items: InventoryItem[];
}

export interface CombatState {
    targetObjectId?: number;
    targetName?: string;
    targetType?: 'NPC' | 'PLAYER';
    lastAttackTime?: number;
    inCombat: boolean;
}

export interface PartyMember {
    objectId: number;
    name: string;
    classId: number;
    level: number;
    hp: HpMpCp;
    mp: HpMpCp;
    cp: HpMpCp;
    isOnline: boolean;
}

export interface PartyState {
    inParty: boolean;
    isLeader: boolean;
    members: PartyMember[];
}

export interface WorldState {
    npcs: Map<number, NpcInfo>;
    players: Map<number, PlayerInfo>;
    items: Map<number, ItemDrop>;
}

export interface ConnectionState {
    phase: string;
    loginServer: { connected: boolean; host: string; port: number };
    gameServer: { connected: boolean; host: string; port: number };
    uptime: number;
    pingMs?: number;
}

/**
 * Central state store for all game data.
 * Updated by incoming packets, read by API endpoints.
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

    // Character methods
    getCharacter(): Partial<CharacterState> {
        return { ...this.character };
    }

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

    // World methods
    getWorld(): WorldState {
        return {
            npcs: new Map(this.world.npcs),
            players: new Map(this.world.players),
            items: new Map(this.world.items)
        };
    }

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

    removeNpc(objectId: number): void {
        this.world.npcs.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.npc_despawned',
            channel: 'world',
            data: { objectId },
            timestamp: new Date().toISOString()
        });
    }

    updateNpc(objectId: number, data: Partial<NpcInfo>): void {
        const npc = this.world.npcs.get(objectId);
        if (npc) {
            this.world.npcs.set(objectId, { ...npc, ...data });
        }
    }

    addPlayer(player: PlayerInfo): void {
        this.world.players.set(player.objectId, player);
    }

    removePlayer(objectId: number): void {
        this.world.players.delete(objectId);
    }

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

    removeItemDrop(objectId: number, pickedByObjectId?: number): void {
        this.world.items.delete(objectId);
        
        EventBus.emitEvent({
            type: 'world.item_picked_up',
            channel: 'world',
            data: { objectId, pickedByObjectId: pickedByObjectId || 0 },
            timestamp: new Date().toISOString()
        });
    }

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

    getNearbyPlayers(radius: number = 600): PlayerInfo[] {
        const characterPos = this.character.position;
        if (!characterPos) return [];

        return Array.from(this.world.players.values()).filter(player => {
            const distance = this.calculateDistance(characterPos, player.position);
            return distance <= radius;
        }).map(player => ({ ...player, distance: this.calculateDistance(characterPos, player.position) }));
    }

    getNearbyItems(radius: number = 600): ItemDrop[] {
        const characterPos = this.character.position;
        if (!characterPos) return [];

        return Array.from(this.world.items.values()).filter(item => {
            const distance = this.calculateDistance(characterPos, item.position);
            return distance <= radius;
        });
    }

    // Inventory methods
    getInventory(): InventoryState {
        return {
            adena: this.inventory.adena || 0,
            weight: this.inventory.weight || { current: 0, max: 0 },
            items: this.inventory.items || []
        };
    }

    updateInventory(data: Partial<InventoryState>): void {
        this.inventory = { ...this.inventory, ...data };
        Logger.debug('GameStateStore', `Inventory updated: ${data.items?.length || 0} items, adena=${data.adena || this.inventory.adena}`);
    }

    /**
     * Добавляет или обновляет предмет в инвентаре (точечное обновление)
     */
    addOrUpdateInventoryItem(item: InventoryItem): void {
        const items = this.inventory.items || [];
        const existingIndex = items.findIndex(i => i.objectId === item.objectId);
        
        if (existingIndex >= 0) {
            // Обновляем существующий предмет
            items[existingIndex] = item;
            Logger.debug('GameStateStore', `Updated item: ${item.name} (objectId=${item.objectId})`);
        } else {
            // Добавляем новый предмет
            items.push(item);
            Logger.debug('GameStateStore', `Added item: ${item.name} (objectId=${item.objectId})`);
        }
        
        this.inventory.items = items;
        
        // Эмитим событие изменения инвентаря
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
     * Удаляет предмет из инвентаря по objectId (точечное удаление)
     */
    removeInventoryItem(objectId: number): InventoryItem | null {
        const items = this.inventory.items || [];
        const index = items.findIndex(i => i.objectId === objectId);
        
        if (index >= 0) {
            const removedItem = items[index];
            items.splice(index, 1);
            this.inventory.items = items;
            
            Logger.debug('GameStateStore', `Removed item: ${removedItem.name} (objectId=${objectId})`);
            
            // Эмитим событие удаления
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
     * Получает предмет по objectId
     */
    getInventoryItemByObjectId(objectId: number): InventoryItem | undefined {
        return (this.inventory.items || []).find(i => i.objectId === objectId);
    }

    /**
     * Получает предметы по itemId
     */
    getInventoryItemsByItemId(itemId: number): InventoryItem[] {
        return (this.inventory.items || []).filter(i => i.itemId === itemId);
    }

    /**
     * Получает экипированные предметы
     */
    getEquippedItems(): InventoryItem[] {
        return (this.inventory.items || []).filter(i => i.equipped);
    }

    /**
     * Получает предмет в определённом слоте экипировки
     */
    getEquippedItemBySlot(slot: number): InventoryItem | undefined {
        return (this.inventory.items || []).find(i => i.equipped && i.slot === slot);
    }

    /**
     * Обновляет только количество адены
     */
    updateAdena(amount: number): void {
        const oldAdena = this.inventory.adena || 0;
        this.inventory.adena = amount;
        
        // Эмитим событие изменения адены
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
     * Полностью очищает инвентарь и эмитит событие
     * Вызывается при отключении от игры
     */
    clearInventory(): void {
        this.inventory = { adena: 0, weight: { current: 0, max: 0 }, items: [] };
        
        // Эмитим событие очистки инвентаря для дашборда
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

    // Combat methods
    getCombat(): CombatState {
        return { ...this.combat };
    }

    setTarget(objectId?: number, name?: string, type?: 'NPC' | 'PLAYER'): void {
        this.combat.targetObjectId = objectId;
        this.combat.targetName = name;
        this.combat.targetType = type;
    }

    clearTarget(): void {
        this.combat.targetObjectId = undefined;
        this.combat.targetName = undefined;
        this.combat.targetType = undefined;
    }

    setInCombat(inCombat: boolean): void {
        this.combat.inCombat = inCombat;
    }

    // Party methods
    getParty(): PartyState {
        return { ...this.party };
    }

    updateParty(data: Partial<PartyState>): void {
        this.party = { ...this.party, ...data };
    }

    addPartyMember(member: PartyMember): void {
        const existingIndex = this.party.members.findIndex(m => m.objectId === member.objectId);
        if (existingIndex >= 0) {
            this.party.members[existingIndex] = member;
        } else {
            this.party.members.push(member);
        }
        this.party.inParty = this.party.members.length > 0;
    }

    removePartyMember(objectId: number): void {
        this.party.members = this.party.members.filter(m => m.objectId !== objectId);
        this.party.inParty = this.party.members.length > 0;
        if (!this.party.inParty) {
            this.party.isLeader = false;
        }
    }

    // Skills methods
    updateSkills(skills: SkillInfo[]): void {
        this.character.skills = skills;
    }

    getSkills(): SkillInfo[] {
        return this.character.skills || [];
    }

    /**
     * Очищает список скиллов и эмитит событие
     * Вызывается при отключении от игры
     */
    clearSkills(): void {
        this.character.skills = [];
        
        // Эмитим событие очистки скиллов для дашборда
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

    // Connection methods
    getConnection(): Partial<ConnectionState> {
        return {
            ...this.connection,
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    updateConnection(data: Partial<ConnectionState>): void {
        this.connection = { ...this.connection, ...data };
    }

    // Utility methods
    private calculateDistance(pos1: Position, pos2: Position): number {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    reset(): void {
        this.character = {};
        this.world = { npcs: new Map(), players: new Map(), items: new Map() };
        this.inventory = { adena: 0, weight: { current: 0, max: 0 }, items: [] };
        this.combat = { inCombat: false };
        this.party = { inParty: false, isLeader: false, members: [] };
        this.connection = { phase: 'DISCONNECTED' };
        this.startTime = Date.now();
        
        // Эмитим событие очистки скиллов
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

export const GameStateStore = new GameStateStoreClass();
