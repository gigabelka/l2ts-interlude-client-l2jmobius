import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * CryptInit / KeyPacket (OpCode=0x00) — first packet from game server.
 *
 * Format from L2J Mobius:
 * - opcode (1 byte) = 0x00
 * - result (1 byte) = 0 = wrong protocol, 1 = protocol ok
 * - key (8 bytes) = XOR key seed
 * - useBlowfish (4 bytes) = packet encryption flag
 * - serverId (4 bytes) = server ID
 * - 1 (1 byte) = unknown
 * - obfuscationKey (4 bytes) = obfuscation key
 *
 * This packet arrives UNENCRYPTED.
 */
export class CryptInitPacket implements IncomingGamePacket {
    public xorKeyData: Buffer = Buffer.alloc(8);
    public result: number = 0;
    public useEncryption: boolean = false;

    decode(reader: PacketReader): this {
        reader.readUInt8();  // opcode 0x00

        this.result = reader.readUInt8();  // 0 = wrong protocol, 1 = ok

        Logger.info('CryptInitPacket', `result: ${this.result}`);

        this.xorKeyData = reader.readBytes(8);

        const useBlowfish = reader.readInt32LE();  // use blowfish flag
        this.useEncryption = useBlowfish !== 0;

        reader.readInt32LE();  // server id

        Logger.hexDump('CryptInit xorKeyData', this.xorKeyData);
        Logger.info('CryptInitPacket', `useEncryption: ${this.useEncryption} (flag: ${useBlowfish})`);

        if (reader.remaining() > 0) {
            Logger.debug('CryptInitPacket', `remaining: ${reader.remaining()}`);
        }

        return this;
    }
}
