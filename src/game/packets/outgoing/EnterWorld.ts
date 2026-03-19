import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * EnterWorld (OpCode=0x03) — request to enter game for L2J Mobius CT0.
 *
 * Specific Notes for L2J Mobius CT0 (from client_server_protocol.md):
 * 5. To EnterWorld, the client sends three packets: 0x9D (empty), 0xD0 0x08 0x00, and 0x03 (with 104 bytes of padding).
 */
export class EnterWorld implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x03); // Opcode 0x03 = EnterWorld for L2J Mobius CT0

        // 104 bytes padding (as per documentation)
        for (let i = 0; i < 104; i++) {
            w.writeUInt8(0x00);
        }

        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x03, body);
        Logger.debug('EnterWorld', `Encoded: bodyLen=${body.length}`);
        return body;
    }
}