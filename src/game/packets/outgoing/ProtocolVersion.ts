import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import { CONFIG } from '../../../config';

/**
 * ProtocolVersion (OpCode=0x00 for Game Server) — first packet sent to game server.
 *
 * Format: opcode (1 byte) + protocol version (4 bytes INT32)
 */
export class ProtocolVersion implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x00);  // opcode
        w.writeInt32LE(CONFIG.Protocol);  // Protocol version (746) as INT32!
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x00, body);
        Logger.debug('ProtocolVersion', `Encoded: protocol=${CONFIG.Protocol}, bodyLen=${body.length}`);
        return body;
    }

    /** Create packet - just protocol version */
    static encodeWithSession(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x00);  // opcode for game server
        w.writeInt32LE(CONFIG.Protocol);  // Protocol version as INT32 (4 bytes!)

        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x00, body);
        Logger.debug('ProtocolVersion', `Encoded: protocol=${CONFIG.Protocol}, bodyLen=${body.length}`);
        return body;
    }
}
