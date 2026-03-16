import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * UserInfo (OpCode=0x04) — full info about the player character.
 * Receiving this packet confirms the client is fully in-game.
 * 
 * L2 Interlude UserInfo structure:
 * - x, y, z (int32)
 * - heading (int32)
 * - objectId (int32)
 * - name (UTF16 string)
 * - race (int32)
 * - sex (int32)
 * - classId (int32)
 * - level (int32)
 * - exp (int64)
 * - str, dex, con, int, wit, men (int32) - stats
 * - maxHp (int32)
 * - currentHp (double/float depending on protocol)
 * - maxMp (int32)
 * - currentMp (double/float)
 * - sp (int32)
 * - currentLoad (int32)
 * - maxLoad (int32)
 * - etc...
 */
export class UserInfoPacket implements IncomingGamePacket {
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public heading: number = 0;
    public objectId: number = 0;
    public name: string = '';
    public race: number = 0;
    public sex: number = 0;
    public classId: number = 0;
    public level: number = 0;
    public exp: number = 0;
    public str: number = 0;
    public dex: number = 0;
    public con: number = 0;
    public int: number = 0;
    public wit: number = 0;
    public men: number = 0;
    public maxHp: number = 0;
    public currentHp: number = 0;
    public maxMp: number = 0;
    public currentMp: number = 0;
    public maxCp: number = 0;
    public currentCp: number = 0;
    public sp: number = 0;
    public currentLoad: number = 0;
    public maxLoad: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8();  // opcode 0x04

            // Position
            this.x = reader.readInt32LE();
            this.y = reader.readInt32LE();
            this.z = reader.readInt32LE();
            this.heading = reader.readInt32LE();
            
            // Identity
            this.objectId = reader.readInt32LE();
            this.name = reader.readStringUTF16();
            this.race = reader.readInt32LE();
            this.sex = reader.readInt32LE();
            this.classId = reader.readInt32LE();
            this.level = reader.readInt32LE();
            this.exp = Number(reader.readInt64LE());
            
            // Stats
            this.str = reader.readInt32LE();
            this.dex = reader.readInt32LE();
            this.con = reader.readInt32LE();
            this.int = reader.readInt32LE();
            this.wit = reader.readInt32LE();
            this.men = reader.readInt32LE();
            
            // HP/MP - check if we have enough bytes
            const remaining = reader.remaining();
            Logger.debug('UserInfoPacket', `Before HP/MP - remaining: ${remaining} bytes`);
            
            if (remaining >= 8) {
                this.maxHp = reader.readInt32LE();
            } else {
                Logger.warn('UserInfoPacket', 'Not enough data for maxHp');
                this.maxHp = 100;
            }
            
            if (remaining >= 16) {
                this.currentHp = reader.readDouble();
            } else if (remaining >= 12) {
                // Fallback to float if double not available
                this.currentHp = reader.readInt32LE();
            } else {
                this.currentHp = this.maxHp;
            }
            
            if (remaining >= 20) {
                this.maxMp = reader.readInt32LE();
            } else {
                this.maxMp = 100;
            }
            
            if (remaining >= 28) {
                this.currentMp = reader.readDouble();
            } else if (remaining >= 24) {
                this.currentMp = reader.readInt32LE();
            } else {
                this.currentMp = this.maxMp;
            }
            
            // SP and load
            if (reader.remaining() >= 4) {
                this.sp = reader.readInt32LE();
            }
            if (reader.remaining() >= 8) {
                this.currentLoad = reader.readInt32LE();
                this.maxLoad = reader.readInt32LE();
            }
            
            // Try to read CP if available
            if (reader.remaining() >= 12) {
                this.maxCp = reader.readInt32LE();
                if (reader.remaining() >= 8) {
                    this.currentCp = reader.readDouble();
                } else {
                    this.currentCp = this.maxCp;
                }
            }

            // Skip remaining data
            if (reader.remaining() > 0) {
                Logger.debug('UserInfoPacket', `remaining: ${reader.remaining()} bytes skipped`);
                reader.skip(reader.remaining());
            }

            Logger.info('UserInfoPacket',
                `ENTERED GAME: ${this.name} (ObjectID=${this.objectId} Lvl=${this.level} Class=${this.classId} ` +
                `HP=${Math.round(this.currentHp)}/${this.maxHp} MP=${Math.round(this.currentMp)}/${this.maxMp} ` +
                `Pos=${this.x},${this.y},${this.z})`);

            // Update GameStateStore with full character info
            this.updateGameState();

        } catch (error) {
            Logger.error('UserInfoPacket', `Decode error: ${error}`);
            // Still update with what we have
            this.updateGameState();
        }

        return this;
    }

    private updateGameState(): void {
        const prevChar = GameStateStore.getCharacter();
        
        // Calculate XP percentage for level
        const expPercent = this.calculateExpPercent();

        // Update character state
        GameStateStore.updateCharacter({
            objectId: this.objectId,
            name: this.name,
            race: this.getRaceName(this.race),
            sex: this.sex === 0 ? 'Male' : 'Female',
            classId: this.classId,
            level: this.level,
            exp: this.exp,
            expPercent: expPercent,
            sp: this.sp,
            hp: { current: Math.round(this.currentHp), max: this.maxHp },
            mp: { current: Math.round(this.currentMp), max: this.maxMp },
            cp: { current: Math.round(this.currentCp) || 0, max: this.maxCp || 0 },
            position: { x: this.x, y: this.y, z: this.z, heading: this.heading },
            stats: {
                str: this.str,
                dex: this.dex,
                con: this.con,
                int: this.int,
                wit: this.wit,
                men: this.men
            }
        });

        // Emit stats changed event for real-time dashboard updates
        const eventData: any = {};
        
        if (prevChar.hp?.current !== Math.round(this.currentHp) || prevChar.hp?.max !== this.maxHp) {
            eventData.hp = { 
                current: Math.round(this.currentHp), 
                max: this.maxHp,
                delta: Math.round(this.currentHp) - (prevChar.hp?.current || 0)
            };
        }
        
        if (prevChar.mp?.current !== Math.round(this.currentMp) || prevChar.mp?.max !== this.maxMp) {
            eventData.mp = { 
                current: Math.round(this.currentMp), 
                max: this.maxMp,
                delta: Math.round(this.currentMp) - (prevChar.mp?.current || 0)
            };
        }
        
        if (this.maxCp > 0 && (prevChar.cp?.current !== Math.round(this.currentCp) || prevChar.cp?.max !== this.maxCp)) {
            eventData.cp = { 
                current: Math.round(this.currentCp), 
                max: this.maxCp,
                delta: Math.round(this.currentCp) - (prevChar.cp?.current || 0)
            };
        }

        if (Object.keys(eventData).length > 0) {
            EventBus.emitEvent({
                type: 'character.stats_changed',
                channel: 'character',
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }

        // Emit position changed event
        if (prevChar.position?.x !== this.x || prevChar.position?.y !== this.y || prevChar.position?.z !== this.z) {
            EventBus.emitEvent({
                type: 'movement.position_changed',
                channel: 'movement',
                data: {
                    objectId: this.objectId,
                    position: { x: this.x, y: this.y, z: this.z, heading: this.heading },
                    speed: 0,
                    isRunning: false
                },
                timestamp: new Date().toISOString()
            });
        }
    }

    private calculateExpPercent(): number {
        // Approximate XP values for Interlude
        const expForLevel = this.getExpForLevel(this.level);
        const expForNextLevel = this.getExpForLevel(this.level + 1);
        const expInLevel = this.exp - expForLevel;
        const expNeeded = expForNextLevel - expForLevel;
        return expNeeded > 0 ? Math.min(100, Math.max(0, (expInLevel / expNeeded) * 100)) : 0;
    }

    private getRaceName(raceId: number): string {
        const races: Record<number, string> = {
            0: 'Human',
            1: 'Elf',
            2: 'Dark Elf',
            3: 'Orc',
            4: 'Dwarf',
            5: 'Kamael'
        };
        return races[raceId] || `Race ${raceId}`;
    }

    // Approximate XP values for Interlude (C1 rates)
    private getExpForLevel(level: number): number {
        const baseExp = [0, 0, 68, 363, 1168, 2994, 6374, 12133, 20914, 33615];
        if (level < 10) return baseExp[level] || 0;
        return Math.floor(Math.pow(level, 3.5) * 50);
    }
}
