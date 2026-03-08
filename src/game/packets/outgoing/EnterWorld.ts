import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * EnterWorld (OpCode=0x03)
 * Interlude (protocol 746) — no payload.
 */
export class EnterWorld implements OutgoingGamePacket {
    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x11); // opcode 0x11 = EnterWorld (Interlude / L2J)
        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x11, body);
        Logger.debug('EnterWorld', `Encoded: bodyLen=${body.length}`);
        return body;
    }
}