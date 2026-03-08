import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * UserInfo (OpCode=0x04) — full info about the player character.
 * Receiving this packet confirms the client is fully in-game.
 */
export class UserInfoPacket implements IncomingGamePacket {
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;
    public objectId: number = 0;
    public name: string = '';
    public level: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0x04

        this.x = reader.readInt32LE();
        this.y = reader.readInt32LE();
        this.z = reader.readInt32LE();
        reader.readInt32LE();  // heading
        this.objectId = reader.readInt32LE();
        this.name = reader.readStringUTF16();
        reader.readInt32LE();  // race
        reader.readInt32LE();  // sex
        reader.readInt32LE();  // classId
        this.level = reader.readInt32LE();
        reader.readInt64LE();  // exp

        if (reader.remaining() > 0) {
            Logger.debug('UserInfoPacket', `remaining: ${reader.remaining()} bytes skipped`);
            reader.skip(reader.remaining());
        }

        Logger.info('UserInfoPacket',
            `ENTERED GAME: ${this.name}  (ObjectID=${this.objectId}  Lvl=${this.level}  Pos=${this.x},${this.y},${this.z})`);

        return this;
    }
}
