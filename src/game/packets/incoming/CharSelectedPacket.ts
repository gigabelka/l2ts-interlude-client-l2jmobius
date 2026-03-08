import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * CharSelected (OpCode=0x1E) — server confirms which character was selected.
 */
export class CharSelectedPacket implements IncomingGamePacket {
    public charName: string = '';
    public charId: number = 0;
    public title: string = '';
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public level: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0x1E

        this.charName = reader.readStringUTF16();
        this.charId = reader.readInt32LE();
        this.title = reader.readStringUTF16();
        reader.readInt32LE();  // sessionId
        reader.readInt32LE();  // clanId
        reader.skip(4);       // padding
        reader.readInt32LE();  // sex
        reader.readInt32LE();  // race
        reader.readInt32LE();  // classId
        reader.readInt32LE();  // active
        this.x = reader.readInt32LE();
        this.y = reader.readInt32LE();
        this.z = reader.readInt32LE();
        reader.readDouble();   // hp
        reader.readDouble();   // mp
        reader.readInt32LE();  // sp
        reader.readInt64LE();  // exp
        this.level = reader.readInt32LE();
        reader.readInt32LE();  // karma

        if (reader.remaining() > 0) {
            reader.skip(reader.remaining());
        }

        Logger.info('CharSelectedPacket',
            `[CHAR SELECTED] name=${this.charName}  id=${this.charId}  level=${this.level}  pos=(${this.x},${this.y},${this.z})`);

        return this;
    }
}
