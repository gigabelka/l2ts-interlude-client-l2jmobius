import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * SSQInfo (OpCode=0xF8) — Seven Signs quest info (sky color).
 * May arrive before CharSelected on some servers.
 */
export class SSQInfoPacket implements IncomingGamePacket {
    public skyColor: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0xF8

        this.skyColor = reader.readUInt16LE();

        const phase = this.skyColor === 0x0101 ? 'Dawn'
                    : this.skyColor === 0x0102 ? 'Dusk'
                    : `Unknown(0x${this.skyColor.toString(16)})`;
        Logger.info('SSQInfoPacket', `[SSQ] skyColor=0x${this.skyColor.toString(16).padStart(4, '0')} -> ${phase}`);

        if (reader.remaining() > 0) {
            Logger.debug('SSQInfoPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
