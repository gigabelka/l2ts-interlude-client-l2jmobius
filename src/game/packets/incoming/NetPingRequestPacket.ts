import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * NetPingRequest (OpCode=0xD3) — server keepalive ping.
 * Must respond with NetPing containing the same pingId.
 */
export class NetPingRequestPacket implements IncomingGamePacket {
    public pingId: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0xD3

        this.pingId = reader.readInt32LE();

        Logger.debug('NetPingRequestPacket', `[PING] received pingId=${this.pingId}`);

        if (reader.remaining() > 0) {
            Logger.debug('NetPingRequestPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
