/**
 * UserInfo (OpCode=0x04) - Full player character information
 * 
 * This packet is received when entering the game world after character selection.
 * Receiving this packet confirms the client is fully in-game.
 * 
 * L2J Mobius Interlude Protocol 746 structure:
 * - Position: x(int32), y(int32), z(int32)
 * - Vehicle ID: vehicleId(int32) - 0 if not in vehicle
 * - Identity: objectId(int32), name(UTF16), race(int32), sex(int32), classId(int32)
 * - Level/XP: level(int32), exp(int64), sp(int32)
 * - Stats: str, dex, con, int, wit, men (all int32)
 * - Vitals: maxHp(int32), currentHp(int32), maxMp(int32), currentMp(int32)
 * - Load: currentLoad(int32), maxLoad(int32)
 * ... plus additional equipment and stats data
 */

import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import {
  BaseGamePacket,
  PacketJsonOutput,
  StateUpdatingPacket,
  EventEmittingPacket,
} from './PacketSerializer';
import {
  ClassId,
  RaceId,
  Sex,
  getClassName,
  getRaceName,
  getSexName,
  isMageClass,
} from '../../../data/constants';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

// =============================================================================
// Raw Data Interface
// =============================================================================

interface RawUserInfo {
  // Position
  x: number;
  y: number;
  z: number;
  vehicleId: number;
  
  // Identity
  objectId: number;
  name: string;
  race: RaceId;
  sex: Sex;
  classId: ClassId;
  
  // Level/XP
  level: number;
  exp: bigint;
  
  // Base Stats
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
  
  // Vitals
  maxHp: number;
  currentHp: number;
  maxMp: number;
  currentMp: number;
  maxCp: number;
  currentCp: number;
  
  // Resources
  sp: number;
  currentLoad: number;
  maxLoad: number;
}

// =============================================================================
// JSON Output Interfaces
// =============================================================================

export interface BaseStatInfo {
  base: number;
  bonus: number;
  total: number;
}

export interface UserInfoJson {
  identity: {
    objectId: number;
    name: string;
    race: { id: RaceId; name: string };
    sex: { id: Sex; name: string };
  };
  progression: {
    level: number;
    class: { id: ClassId; name: string; isMage: boolean };
    experience: {
      current: string;
      forLevel: number;
      toNextLevel: number;
      percent: number;
    };
    sp: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
    inVehicle: boolean;
    vehicleId: number;
  };
  stats: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wit: number;
    men: number;
  };
  vitals: {
    hp: { current: number; max: number; percent: number };
    mp: { current: number; max: number; percent: number };
    cp: { current: number; max: number; percent: number };
  };
  load: {
    current: number;
    max: number;
    percent: number;
    weightStatus: 'light' | 'medium' | 'heavy' | 'overloaded';
  };
  status: {
    isInCombat: boolean;
    isDead: boolean;
    isSitting: boolean;
    isRunning: boolean;
    isInVehicle: boolean;
  };
}

// =============================================================================
// Packet Parser
// =============================================================================

export class UserInfoPacket
  extends BaseGamePacket<UserInfoJson>
  implements StateUpdatingPacket, EventEmittingPacket
{
  protected opcode = 0x04;
  
  // Raw data storage
  public raw: Partial<RawUserInfo> = {};
  
  // Track if state has been updated (to prevent double updates)
  private stateUpdated = false;
  private eventsEmitted = false;
  
  // Backwards compatibility getters
  get x(): number { return this.raw.x || 0; }
  get y(): number { return this.raw.y || 0; }
  get z(): number { return this.raw.z || 0; }
  get objectId(): number { return this.raw.objectId || 0; }
  get name(): string { return this.raw.name || ''; }
  get level(): number { return this.raw.level || 0; }
  get race(): number { return this.raw.race || 0; }
  get sex(): number { return this.raw.sex || 0; }
  get classId(): number { return this.raw.classId || 0; }
  get str(): number { return this.raw.str || 0; }
  get dex(): number { return this.raw.dex || 0; }
  get con(): number { return this.raw.con || 0; }
  get int(): number { return this.raw.int || 0; }
  get wit(): number { return this.raw.wit || 0; }
  get men(): number { return this.raw.men || 0; }
  get maxHp(): number { return this.raw.maxHp || 0; }
  get currentHp(): number { return this.raw.currentHp || 0; }
  get maxMp(): number { return this.raw.maxMp || 0; }
  get currentMp(): number { return this.raw.currentMp || 0; }
  
  // XP table for Interlude
  private static readonly EXP_TABLE: number[] = [
    0, 0, 68, 363, 1168, 2994, 6374, 12133, 20914, 33615,
    50777, 73725, 103136, 139764, 184984, 240269, 307297, 387973,
    484431, 598074, 731670, 887268, 1069125, 1283445, 1535565,
    1830000, 2172180, 2568330, 3024560, 3548030, 4146950, 4830800,
    5610660, 6498520, 7507460, 8652710, 9950780, 11420700, 13096640,
    15000000, 17156580, 19594200, 22342890, 25436100, 28910550,
    32806200, 37166000, 42036000, 47466000, 53510000, 60236000
  ];
  
  /**
   * Reset state flags (for testing with rapid updates)
   */
  reset(): void {
    this.stateUpdated = false;
    this.eventsEmitted = false;
    this.raw = {};
  }
  
  decode(reader: PacketReader): this {
    this.startParsing();
    this.bodyLength = reader.getBuffer().length;
    
    try {
      reader.readUInt8(); // Skip opcode
      
      // Position
      this.raw.x = reader.readInt32LE();
      this.raw.y = reader.readInt32LE();
      this.raw.z = reader.readInt32LE();
      
      // Vehicle ID (0 if not in vehicle)
      this.raw.vehicleId = reader.readInt32LE();
      
      // Identity
      this.raw.objectId = reader.readInt32LE();
      this.raw.name = reader.readStringUTF16();
      this.raw.race = reader.readInt32LE() as RaceId;
      this.raw.sex = reader.readInt32LE() as Sex;
      this.raw.classId = reader.readInt32LE() as ClassId;
      
      // Level & XP
      this.raw.level = reader.readInt32LE();
      this.raw.exp = reader.readInt64LE();
      
      // Base Stats
      this.raw.str = reader.readInt32LE();
      this.raw.dex = reader.readInt32LE();
      this.raw.con = reader.readInt32LE();
      this.raw.int = reader.readInt32LE();
      this.raw.wit = reader.readInt32LE();
      this.raw.men = reader.readInt32LE();
      
      // Vitals (in Interlude these are Int32, NOT Double!)
      this.raw.maxHp = reader.readInt32LE();
      this.raw.currentHp = reader.readInt32LE();
      this.raw.maxMp = reader.readInt32LE();
      this.raw.currentMp = reader.readInt32LE();
      
      // SP and Load
      this.raw.sp = reader.readInt32LE();
      this.raw.currentLoad = reader.readInt32LE();
      this.raw.maxLoad = reader.readInt32LE();
      
      // Skip remaining data (equipment, additional stats, etc.)
      const remaining = reader.remaining();
      if (remaining > 0) {
        this.addWarning(`${remaining} bytes remaining (equipment data skipped)`);
        reader.skip(remaining);
      }
      
      Logger.info('UserInfoPacket',
        `ENTERED GAME: ${this.raw.name} (ObjectID=${this.raw.objectId} ` +
        `Lvl=${this.raw.level} Class=${getClassName(this.raw.classId!)} ` +
        `HP=${this.raw.currentHp}/${this.raw.maxHp} ` +
        `MP=${this.raw.currentMp}/${this.raw.maxMp} ` +
        `Pos=${this.raw.x},${this.raw.y},${this.raw.z})`
      );
      
    } catch (error) {
      this.addWarning(`Decode error: ${error}`);
      Logger.error('UserInfoPacket', `Failed to decode: ${error}`);
    }
    
    // Update state and emit events for backwards compatibility
    // (when used without GamePacketHandler)
    this.updateState();
    this.emitEvents();
    
    return this;
  }
  
  toJSON(): PacketJsonOutput<UserInfoJson> {
    const raw = this.raw as RawUserInfo;
    
    const expForLevel = this.getExpForLevel(raw.level);
    const expForNext = this.getExpForLevel(raw.level + 1);
    const expInLevel = Number(raw.exp) - expForLevel;
    const expNeeded = expForNext - expForLevel;
    const expPercent = expNeeded > 0
      ? Math.min(100, Math.max(0, (expInLevel / expNeeded) * 100))
      : 0;
    
    const loadPercent = raw.maxLoad > 0
      ? Math.min(100, Math.round((raw.currentLoad / raw.maxLoad) * 100))
      : 0;
    
    const data: UserInfoJson = {
      identity: {
        objectId: raw.objectId,
        name: raw.name,
        race: { id: raw.race, name: getRaceName(raw.race) },
        sex: { id: raw.sex, name: getSexName(raw.sex) },
      },
      progression: {
        level: raw.level,
        class: {
          id: raw.classId,
          name: getClassName(raw.classId),
          isMage: isMageClass(raw.classId),
        },
        experience: {
          current: raw.exp.toString(),
          forLevel: expForLevel,
          toNextLevel: expNeeded,
          percent: Math.round(expPercent * 100) / 100,
        },
        sp: raw.sp,
      },
      position: {
        x: raw.x,
        y: raw.y,
        z: raw.z,
        inVehicle: raw.vehicleId !== 0,
        vehicleId: raw.vehicleId,
      },
      stats: {
        str: raw.str,
        dex: raw.dex,
        con: raw.con,
        int: raw.int,
        wit: raw.wit,
        men: raw.men,
      },
      vitals: {
        hp: {
          current: raw.currentHp,
          max: raw.maxHp,
          percent: this.calculatePercent(raw.currentHp, raw.maxHp),
        },
        mp: {
          current: raw.currentMp,
          max: raw.maxMp,
          percent: this.calculatePercent(raw.currentMp, raw.maxMp),
        },
        cp: {
          current: raw.currentCp || 0,
          max: raw.maxCp || 0,
          percent: this.calculatePercent(raw.currentCp || 0, raw.maxCp || 0),
        },
      },
      load: {
        current: raw.currentLoad,
        max: raw.maxLoad,
        percent: loadPercent,
        weightStatus: this.getWeightStatus(loadPercent),
      },
      status: {
        isInCombat: false,
        isDead: raw.currentHp <= 0,
        isSitting: false,
        isRunning: true,
        isInVehicle: raw.vehicleId !== 0,
      },
    };
    
    return {
      meta: this.createMetadata(),
      data,
      _debug: this.createDebugInfo(),
    };
  }
  
  private getExpForLevel(level: number): number {
    if (level < UserInfoPacket.EXP_TABLE.length) {
      return UserInfoPacket.EXP_TABLE[level] ?? 0;
    }
    return Math.floor(Math.pow(level, 3.5) * 50);
  }
  
  private getWeightStatus(percent: number): 'light' | 'medium' | 'heavy' | 'overloaded' {
    if (percent >= 80) return 'overloaded';
    if (percent >= 50) return 'heavy';
    if (percent >= 30) return 'medium';
    return 'light';
  }
  
  /**
   * Update GameStateStore with player info
   */
  updateState(): void {
    if (this.stateUpdated) return; // Prevent double update
    this.stateUpdated = true;
    const raw = this.raw as RawUserInfo;
    if (!raw.objectId) return;
    
    GameStateStore.updateCharacter({
      objectId: raw.objectId,
      name: raw.name,
      race: getRaceName(raw.race),
      sex: getSexName(raw.sex),
      classId: raw.classId,
      level: raw.level,
      exp: Number(raw.exp),
      expPercent: this.calculateExpPercent(raw.level, Number(raw.exp)),
      sp: raw.sp,
      hp: { current: raw.currentHp, max: raw.maxHp },
      mp: { current: raw.currentMp, max: raw.maxMp },
      cp: { current: raw.currentCp || 0, max: raw.maxCp || 0 },
      position: { x: raw.x, y: raw.y, z: raw.z },
      stats: {
        str: raw.str,
        dex: raw.dex,
        con: raw.con,
        int: raw.int,
        wit: raw.wit,
        men: raw.men,
      },
    });
    
    Logger.info('UserInfoPacket', `State updated for ${raw.name}`);
  }
  
  /**
   * Emit events for stat changes
   */
  emitEvents(): void {
    if (this.eventsEmitted) return; // Prevent double emission
    this.eventsEmitted = true;
    const raw = this.raw as RawUserInfo;
    const prevChar = GameStateStore.getCharacter();
    
    const eventData: Record<string, unknown> = {};
    
    // Check HP changes
    if (prevChar.hp?.current !== raw.currentHp || prevChar.hp?.max !== raw.maxHp) {
      eventData['hp'] = {
        current: raw.currentHp,
        max: raw.maxHp,
        delta: raw.currentHp - (prevChar.hp?.current || 0),
      };
    }
    
    // Check MP changes
    if (prevChar.mp?.current !== raw.currentMp || prevChar.mp?.max !== raw.maxMp) {
      eventData['mp'] = {
        current: raw.currentMp,
        max: raw.maxMp,
        delta: raw.currentMp - (prevChar.mp?.current || 0),
      };
    }
    
    // Check CP changes
    if (raw.maxCp > 0 && (prevChar.cp?.current !== raw.currentCp || prevChar.cp?.max !== raw.maxCp)) {
      eventData['cp'] = {
        current: raw.currentCp || 0,
        max: raw.maxCp || 0,
        delta: (raw.currentCp || 0) - (prevChar.cp?.current || 0),
      };
    }
    
    // Emit stats changed event
    if (Object.keys(eventData).length > 0) {
      EventBus.emitEvent({
        type: 'character.stats_changed',
        channel: 'character',
        data: eventData,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Emit position changed event
    if (prevChar.position?.x !== raw.x || prevChar.position?.y !== raw.y || prevChar.position?.z !== raw.z) {
      EventBus.emitEvent({
        type: 'movement.position_changed',
        channel: 'movement',
        data: {
          objectId: raw.objectId,
          position: { x: raw.x, y: raw.y, z: raw.z },
          speed: 0,
          isRunning: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Emit entered game event
    EventBus.emitEvent({
      type: 'character.entered_game',
      channel: 'system',
      data: {
        objectId: raw.objectId,
        name: raw.name,
        level: raw.level,
        className: getClassName(raw.classId),
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  private calculateExpPercent(level: number, exp: number): number {
    const expForLevel = this.getExpForLevel(level);
    const expForNext = this.getExpForLevel(level + 1);
    const expInLevel = exp - expForLevel;
    const expNeeded = expForNext - expForLevel;
    return expNeeded > 0 ? Math.min(100, Math.max(0, (expInLevel / expNeeded) * 100)) : 0;
  }
}
