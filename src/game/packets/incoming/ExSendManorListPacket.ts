import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * ExSendManorList (OpCode=0xFE, sub=0x001B) — manor zone list.
 * Response to RequestManorList; arrives after client enters IN_GAME state.
 */
export class ExSendManorListPacket implements IncomingGamePacket {
    public subOpcode: number = 0;
    public zoneCount: number = 0;
    public zones: Array<{ zoneId: number; zoneName: string }> = [];

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0xFE

        this.subOpcode = reader.readUInt16LE();

        if (this.subOpcode !== 0x001B) {
            Logger.warn('ExSendManorListPacket', `Unexpected sub-opcode: 0x${this.subOpcode.toString(16)}`);
        }

        this.zoneCount = reader.readInt32LE();

        for (let i = 0; i < this.zoneCount; i++) {
            const zoneId = reader.readInt32LE();
            const zoneName = reader.readStringUTF16();
            this.zones.push({ zoneId, zoneName });
        }

        Logger.info('ExSendManorListPacket', `[MANOR] zones: ${this.zoneCount}`);

        if (reader.remaining() > 0) {
            Logger.debug('ExSendManorListPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
