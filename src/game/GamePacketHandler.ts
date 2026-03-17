import { PacketReader } from '../network/PacketReader';
import { Logger } from '../logger/Logger';
import type { IncomingGamePacket } from './packets/incoming/IncomingGamePacket';
import { GameState } from './GameState';
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
import { AttackPacket } from './packets/incoming/AttackPacket';
import { MagicSkillUsePacket } from './packets/incoming/MagicSkillUsePacket';
import { NpcDeletePacket } from './packets/incoming/NpcDeletePacket';
import { ItemListPacket } from './packets/incoming/ItemListPacket';
import { SkillListPacket } from './packets/incoming/SkillListPacket';
import { MoveToLocationPacket } from './packets/incoming/MoveToLocationPacket';
import { PartySmallWindowAllPacket } from './packets/incoming/PartySmallWindowAllPacket';
import { PartySmallWindowAddPacket } from './packets/incoming/PartySmallWindowAddPacket';
import { PartySmallWindowDeletePacket } from './packets/incoming/PartySmallWindowDeletePacket';

/**
 * Opcode router for incoming Game Server packets.
 * All packets are decoded and sent to WebSocket via EventBus.
 *
 * IMPORTANT: Opcode 0x04 is used for BOTH CharSelectInfo AND UserInfo!
 * - In WAIT_CHAR_LIST state: 0x04 = CharSelectInfo (character list)
 * - In WAIT_USER_INFO/IN_GAME state: 0x04 = UserInfo (player info)
 *
 * We use state-based routing to disambiguate.
 */
export class GamePacketHandler {
    handle(opcode: number, body: Buffer, state?: GameState): IncomingGamePacket | null {
        const reader = new PacketReader(body);

        try {
            switch (opcode) {
                case 0x00:  // CryptInit (some servers use 0x00)
                case 0x2D:  // KeyPacket (L2J Mobius standard)
                    return new CryptInitPacket().decode(reader);

                case 0x04:
                    // CRITICAL: 0x04 is ambiguous - use state to decide
                    // WAIT_CHAR_LIST = CharSelectInfo (server sends character list)
                    // WAIT_USER_INFO or IN_GAME = UserInfo (player info)
                    if (state === GameState.WAIT_CHAR_LIST || state === GameState.WAIT_CHAR_SELECTED) {
                        Logger.info('GamePacketHandler', `Routing opcode 0x04 as CharSelectInfo (state=${state})`);
                        return new CharSelectInfoPacket().decode(reader);
                    } else {
                        Logger.info('GamePacketHandler', `Routing opcode 0x04 as UserInfo (state=${state})`);
                        return new UserInfoPacket().decode(reader);
                    }

                case 0x13:  // CharSelectionInfo
                case 0x2C:  // CharacterSelectionInfo (L2J Mobius standard)
                    return new CharSelectInfoPacket().decode(reader);

                case 0x15:  // CharSelected
                    return new CharSelectedPacket().decode(reader);

                case 0xD3:  // NetPing
                    return new NetPingRequestPacket().decode(reader);

                // Items
                case 0x0B:  // SpawnItem
                    return new SpawnItemPacket().decode(reader);
                case 0x0C:  // DropItem
                    return new DropItemPacket().decode(reader);
                case 0x0D:  // GetItem
                    return new GetItemPacket().decode(reader);
                case 0x1B:  // ItemList (inventory)
                    return new ItemListPacket().decode(reader);

                // NPCs and Players
                case 0x0C:  // NpcDelete
                    return new NpcDeletePacket().decode(reader);
                case 0x16:  // NpcInfo
                    return new NpcInfoPacket().decode(reader);
                case 0x03:  // CharInfo (other players)
                    return new CharInfoPacket().decode(reader);
                case 0x2E:  // MoveToLocation
                    return new MoveToLocationPacket().decode(reader);

                // Status and Combat
                case 0x0E:  // StatusUpdate
                    return new StatusUpdatePacket().decode(reader);
                case 0x05:  // Attack
                    return new AttackPacket().decode(reader);
                case 0x48:  // MagicSkillUse
                    return new MagicSkillUsePacket().decode(reader);
                case 0x58:  // SkillList
                    return new SkillListPacket().decode(reader);

                // Chat
                case 0x4A:  // CreatureSay
                    return new CreatureSayPacket().decode(reader);

                // Party
                case 0x4E:  // PartySmallWindowAll
                    return new PartySmallWindowAllPacket().decode(reader);
                case 0x4F:  // PartySmallWindowAdd
                    return new PartySmallWindowAddPacket().decode(reader);
                case 0x50:  // PartySmallWindowDelete
                    return new PartySmallWindowDeletePacket().decode(reader);

                default:
                    Logger.debug('GamePacketHandler',
                        `Ignoring OpCode=0x${opcode.toString(16).padStart(2, '0')} size=${body.length}`);
                    return null;
            }
        } catch (error) {
            Logger.error('GamePacketHandler',
                `Decode error OpCode=0x${opcode.toString(16)}: ${error}`);
            Logger.hexDump('ERROR PACKET', body);
            return null;
        }
    }
}
