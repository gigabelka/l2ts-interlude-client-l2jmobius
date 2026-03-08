import { PacketReader } from '../network/PacketReader';
import { Logger } from '../logger/Logger';
import type { IncomingGamePacket } from './packets/incoming/IncomingGamePacket';
import { GameState } from './GameState';
import { CryptInitPacket } from './packets/incoming/CryptInitPacket';
import { CharSelectInfoPacket } from './packets/incoming/CharSelectInfoPacket';
import { CharSelectedPacket } from './packets/incoming/CharSelectedPacket';
import { UserInfoPacket } from './packets/incoming/UserInfoPacket';
import { NetPingRequestPacket } from './packets/incoming/NetPingRequestPacket';

/**
 * Opcode router for incoming Game Server packets.
 * Only packets used by the FSM are decoded; all others are ignored.
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

                case 0xD3:
                    return new NetPingRequestPacket().decode(reader);

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
