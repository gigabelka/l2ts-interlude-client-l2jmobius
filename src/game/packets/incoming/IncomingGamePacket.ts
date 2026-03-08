import { PacketReader } from '../../../network/PacketReader';

export interface IncomingGamePacket {
    decode(reader: PacketReader): this;
}
