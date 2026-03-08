import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';

/**
 * CharacterSelect (OpCode=0x0D) — select a character by slot index.
 *
 * Packet structure (per Wireshark frame 230):
 *   opcode=0x0D
 *   slot index (4 bytes, LE)
 *   padding (14 bytes of 0x00)
 */
export class CharacterSelected implements OutgoingGamePacket {
    private slotIndex: number;

    constructor(slotIndex: number) {
        this.slotIndex = slotIndex;
    }

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x0D);              // opcode
        w.writeInt32LE(this.slotIndex);  // slot index (4 bytes, LE)

        // 14 bytes padding
        for (let i = 0; i < 14; i++) {
            w.writeUInt8(0x00);
        }

        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x0D, body);
        Logger.debug('CharacterSelected', `Encoded: slot=${this.slotIndex}, bodyLen=${body.length}`);
        return body;
    }
}
