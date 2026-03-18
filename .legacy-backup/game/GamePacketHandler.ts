/**
 * Game Packet Handler
 * 
 * Opcode router for incoming Game Server packets.
 * Decodes packets and routes them to appropriate handlers.
 * 
 * Features:
 * - State-based packet routing (e.g., 0x04 maps to different packets based on game state)
 * - JSON serialization logging
 * - Automatic state updates and event emission
 * - Statistics tracking
 */

import { PacketReader } from '../network/PacketReader';
import { Logger } from '../logger/Logger';
import { GameState } from './GameState';
import { packetLogger } from './PacketJsonLogger';
import type { IncomingGamePacket } from './packets/incoming/IncomingGamePacket';
import {
  isJsonSerializablePacket,
  isStateUpdatingPacket,
  isEventEmittingPacket,
} from './packets/incoming/PacketSerializer';

// Import all packet handlers
import { CryptInitPacket } from './packets/incoming/CryptInitPacket';
import { CharSelectInfoPacket } from './packets/incoming/CharSelectInfoPacket';
import { CharSelectedPacket } from './packets/incoming/CharSelectedPacket';
import { UserInfoPacket } from './packets/incoming/UserInfoPacket';
import { NetPingRequestPacket } from './packets/incoming/NetPingRequestPacket';
import { SpawnItemPacket } from './packets/incoming/SpawnItemPacket';
import { DropItemPacket } from './packets/incoming/DropItemPacket';
import { GetItemPacket } from './packets/incoming/GetItemPacket';
import { NpcInfoPacket } from './packets/incoming/NpcInfoPacket';
import { CharInfoPacket } from './packets/incoming/CharInfoPacket';
import { StatusUpdatePacket } from './packets/incoming/StatusUpdatePacket';
import { CreatureSayPacket } from './packets/incoming/CreatureSayPacket';
import { Say2Packet } from './packets/incoming/Say2Packet';
import { AttackPacket } from './packets/incoming/AttackPacket';
import { MagicSkillUsePacket } from './packets/incoming/MagicSkillUsePacket';
import { NpcDeletePacket } from './packets/incoming/NpcDeletePacket';
import { ItemListPacket } from './packets/incoming/ItemListPacket';
import { InventoryUpdatePacket } from './packets/incoming/InventoryUpdatePacket';
import { SkillListPacket } from './packets/incoming/SkillListPacket';
import { MoveToLocationPacket } from './packets/incoming/MoveToLocationPacket';
import { PartySmallWindowAllPacket } from './packets/incoming/PartySmallWindowAllPacket';
import { PartySmallWindowAddPacket } from './packets/incoming/PartySmallWindowAddPacket';
import { PartySmallWindowDeletePacket } from './packets/incoming/PartySmallWindowDeletePacket';
import { SSQInfoPacket } from './packets/incoming/SSQInfoPacket';
import { QuestListPacket } from './packets/incoming/QuestListPacket';
import { ExSendManorListPacket } from './packets/incoming/ExSendManorListPacket';

/**
 * Opcode routing configuration
 */
interface OpcodeRoute {
  opcode: number;
  hex: string;
  name: string;
  factory: () => IncomingGamePacket;
  requiresState?: GameState[];
}

/**
 * Packet handler statistics
 */
interface HandlerStats {
  received: number;
  decoded: number;
  errors: number;
  lastReceived: number;
}

/**
 * Game Packet Handler
 * 
 * IMPORTANT: Opcode 0x04 is used for BOTH CharSelectInfo AND UserInfo!
 * - In WAIT_CHAR_LIST state: 0x04 = CharSelectInfo (character list)
 * - In WAIT_USER_INFO/IN_GAME state: 0x04 = UserInfo (player info)
 * 
 * We use state-based routing to disambiguate.
 */
export class GamePacketHandler {
  private stats: Map<number, HandlerStats> = new Map();
  private lastError: { opcode: number; error: string; time: number } | null = null;
  
  /**
   * Route table for opcodes
   */
  private readonly routeTable: OpcodeRoute[] = [
    // Connection & Encryption
    { opcode: 0x00, hex: '0x00', name: 'CryptInit', factory: () => new CryptInitPacket() },
    { opcode: 0x2D, hex: '0x2D', name: 'CryptInit', factory: () => new CryptInitPacket() },
    
    // Character Selection (ambiguous - handled specially)
    { opcode: 0x04, hex: '0x04', name: 'CharSelectInfo/UserInfo', factory: () => new CharSelectInfoPacket() },
    { opcode: 0x13, hex: '0x13', name: 'CharSelectInfo', factory: () => new CharSelectInfoPacket() },
    { opcode: 0x2C, hex: '0x2C', name: 'CharSelectInfo', factory: () => new CharSelectInfoPacket() },
    { opcode: 0x15, hex: '0x15', name: 'CharSelected', factory: () => new CharSelectedPacket() },
    
    // Items
    { opcode: 0x0B, hex: '0x0B', name: 'SpawnItem', factory: () => new SpawnItemPacket() },
    { opcode: 0x0C, hex: '0x0C', name: 'DropItem', factory: () => new DropItemPacket() },
    { opcode: 0x0D, hex: '0x0D', name: 'GetItem', factory: () => new GetItemPacket() },
    { opcode: 0x1B, hex: '0x1B', name: 'ItemList', factory: () => new ItemListPacket() },
    { opcode: 0x19, hex: '0x19', name: 'InventoryUpdate', factory: () => new InventoryUpdatePacket() },
    
    // NPCs and Players
    { opcode: 0x16, hex: '0x16', name: 'NpcInfo', factory: () => new NpcInfoPacket() },
    { opcode: 0x03, hex: '0x03', name: 'CharInfo', factory: () => new CharInfoPacket() },
    
    // Status and Combat
    { opcode: 0x0E, hex: '0x0E', name: 'StatusUpdate', factory: () => new StatusUpdatePacket() },
    { opcode: 0x05, hex: '0x05', name: 'Attack', factory: () => new AttackPacket() },
    { opcode: 0x48, hex: '0x48', name: 'MagicSkillUse', factory: () => new MagicSkillUsePacket() },
    { opcode: 0x58, hex: '0x58', name: 'SkillList', factory: () => new SkillListPacket() },
    
    // Movement
    { opcode: 0x2E, hex: '0x2E', name: 'MoveToLocation', factory: () => new MoveToLocationPacket() },
    
    // World
    { opcode: 0x0C, hex: '0x0C-NPC', name: 'NpcDelete', factory: () => new NpcDeletePacket() },
    
    // Chat
    { opcode: 0x2F, hex: '0x2F', name: 'Say2', factory: () => new Say2Packet() },
    { opcode: 0x4A, hex: '0x4A', name: 'CreatureSay', factory: () => new CreatureSayPacket() },
    
    // Party
    { opcode: 0x4E, hex: '0x4E', name: 'PartySmallWindowAll', factory: () => new PartySmallWindowAllPacket() },
    { opcode: 0x4F, hex: '0x4F', name: 'PartySmallWindowAdd', factory: () => new PartySmallWindowAddPacket() },
    { opcode: 0x50, hex: '0x50', name: 'PartySmallWindowDelete', factory: () => new PartySmallWindowDeletePacket() },
    
    // System
    { opcode: 0xD3, hex: '0xD3', name: 'NetPing', factory: () => new NetPingRequestPacket() },
    { opcode: 0x73, hex: '0x73', name: 'SSQInfo', factory: () => new SSQInfoPacket() },
    { opcode: 0x80, hex: '0x80', name: 'QuestList', factory: () => new QuestListPacket() },
    { opcode: 0xFE, hex: '0xFE', name: 'ExSendManorList', factory: () => new ExSendManorListPacket() },
  ];
  
  /**
   * Handle incoming packet
   * @param opcode - Packet opcode
   * @param body - Packet body (without length header)
   * @param state - Current game state (for disambiguation)
   * @returns Parsed packet or null if not handled
   */
  handle(opcode: number, body: Buffer, state?: GameState): IncomingGamePacket | null {
    this.updateStats(opcode, 'received');
    
    const reader = new PacketReader(body);
    
    try {
      // Find route for this opcode
      const route = this.findRoute(opcode, state);
      
      if (!route) {
        // Unknown opcode
        Logger.debug('GamePacketHandler',
          `Ignoring OpCode=0x${opcode.toString(16).padStart(2, '0')} size=${body.length}`
        );
        packetLogger.logRaw(opcode, body, state);
        return null;
      }
      
      // Create packet instance
      const packet = route.factory();
      
      // Set game state context if supported
      if (isJsonSerializablePacket(packet) && state && packet.setGameState) {
        packet.setGameState(state);
      }
      
      // Decode packet
      packet.decode(reader);
      this.updateStats(opcode, 'decoded');
      
      // Log to JSON logger if supported
      if (isJsonSerializablePacket(packet)) {
        packetLogger.log(packet.toJSON());
      }
      
      // Update state if supported
      if (isStateUpdatingPacket(packet) && 'updateState' in packet) {
        (packet as unknown as { updateState(): void }).updateState();
      }
      
      // Emit events if supported
      if (isEventEmittingPacket(packet) && 'emitEvents' in packet) {
        (packet as unknown as { emitEvents(): void }).emitEvents();
      }
      
      return packet;
      
    } catch (error) {
      this.updateStats(opcode, 'error');
      this.lastError = { opcode, error: String(error), time: Date.now() };
      
      Logger.error('GamePacketHandler',
        `Decode error OpCode=0x${opcode.toString(16)}: ${error}`
      );
      Logger.hexDump('ERROR PACKET', body);
      
      return null;
    }
  }
  
  /**
   * Find route for opcode
   */
  private findRoute(opcode: number, state?: GameState): OpcodeRoute | undefined {
    // Special handling for ambiguous opcodes
    if (opcode === 0x04) {
      return this.handleAmbiguous04(state);
    }
    
    // Standard lookup
    return this.routeTable.find(r => r.opcode === opcode);
  }
  
  /**
   * Handle opcode 0x04 ambiguity (CharSelectInfo vs UserInfo)
   */
  private handleAmbiguous04(state?: GameState): OpcodeRoute | undefined {
    const isCharSelectState = state === GameState.WAIT_CHAR_LIST || 
                               state === GameState.WAIT_CHAR_SELECTED;
    
    if (isCharSelectState) {
      Logger.debug('GamePacketHandler', `Routing 0x04 as CharSelectInfo (state=${state})`);
      return {
        opcode: 0x04,
        hex: '0x04',
        name: 'CharSelectInfo',
        factory: () => new CharSelectInfoPacket(),
      };
    } else {
      Logger.debug('GamePacketHandler', `Routing 0x04 as UserInfo (state=${state})`);
      return {
        opcode: 0x04,
        hex: '0x04',
        name: 'UserInfo',
        factory: () => new UserInfoPacket(),
      };
    }
  }
  
  /**
   * Update statistics
   */
  private updateStats(opcode: number, type: 'received' | 'decoded' | 'error'): void {
    let stat = this.stats.get(opcode);
    if (!stat) {
      stat = { received: 0, decoded: 0, errors: 0, lastReceived: 0 };
      this.stats.set(opcode, stat);
    }
    
    stat.lastReceived = Date.now();
    
    switch (type) {
      case 'received':
        stat.received++;
        break;
      case 'decoded':
        stat.decoded++;
        break;
      case 'error':
        stat.errors++;
        break;
    }
  }
  
  /**
   * Get handler statistics
   */
  getStats(): { opcode: number; received: number; decoded: number; errors: number }[] {
    return Array.from(this.stats.entries())
      .map(([opcode, stat]) => ({
        opcode,
        received: stat.received,
        decoded: stat.decoded,
        errors: stat.errors,
      }))
      .sort((a, b) => b.received - a.received);
  }
  
  /**
   * Get last error
   */
  getLastError(): { opcode: number; error: string; time: number } | null {
    return this.lastError;
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.clear();
    this.lastError = null;
  }
  
  /**
   * Get supported opcodes
   */
  getSupportedOpcodes(): { opcode: number; hex: string; name: string }[] {
    return this.routeTable
      .filter((route, index, self) => 
        // Remove duplicates (e.g., 0x00 and 0x2D both map to CryptInit)
        self.findIndex(r => r.opcode === route.opcode) === index
      )
      .map(route => ({
        opcode: route.opcode,
        hex: route.hex,
        name: route.name,
      }))
      .sort((a, b) => a.opcode - b.opcode);
  }
}
