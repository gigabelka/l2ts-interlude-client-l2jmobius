import { PacketReader } from '../../../network/PacketReader';
import { Logger } from '../../../logger/Logger';
import { IncomingGamePacket } from './IncomingGamePacket';

/**
 * CryptInit / KeyPacket (OpCode=0x00 or 0x2D) — first packet from game server.
 *
 * Format variants:
 * 
 * OpCode 0x00 (Legacy):
 * - opcode (1 byte) = 0x00
 * - result (1 byte) = 0 = wrong protocol, 1 = protocol ok
 * - key (8 bytes) = XOR key seed
 * - useBlowfish (4 bytes) = packet encryption flag
 * - serverId (4 bytes) = server ID
 *
 * OpCode 0x2D (KeyPacket / L2J Mobius):
 * - opcode (1 byte) = 0x2D
 * - result (1 byte) = 0 = wrong protocol, 1 = protocol ok
 * - key (8 bytes) = XOR key seed
 * - useEncryption (4 bytes) = 0 or 1
 *
 * OpCode 0x2D can also be shorter in some implementations.
 * This packet arrives UNENCRYPTED.
 */
export class CryptInitPacket implements IncomingGamePacket {
    public xorKeyData: Buffer = Buffer.alloc(8);
    public result: number = 0;
    public useEncryption: boolean = false;

    decode(reader: PacketReader): this {
        const opcode = reader.readUInt8();  // opcode 0x00 or 0x2D
        
        this.result = reader.readUInt8();  // 0 = wrong protocol, 1 = ok
        
        Logger.info('CryptInitPacket', `OpCode=0x${opcode.toString(16).padStart(2, '0')}, result: ${this.result}`);

        // Read XOR key (8 bytes) - this is required
        const remaining = reader.remaining();
        if (remaining < 8) {
            // Some servers send shorter keys - pad with zeros
            const availableKey = reader.readBytes(remaining);
            this.xorKeyData = Buffer.alloc(8, 0);
            availableKey.copy(this.xorKeyData);
            Logger.warn('CryptInitPacket', `Short key received (${remaining} bytes), padded to 8`);
        } else {
            this.xorKeyData = reader.readBytes(8);
        }

        // Read encryption flag if available
        if (reader.remaining() >= 4) {
            const useEncryptionFlag = reader.readInt32LE();
            this.useEncryption = useEncryptionFlag !== 0;
            Logger.info('CryptInitPacket', `useEncryption: ${this.useEncryption} (flag: ${useEncryptionFlag})`);
        } else {
            // Default to encryption enabled if result is OK
            this.useEncryption = this.result === 1;
            Logger.info('CryptInitPacket', `useEncryption: ${this.useEncryption} (default)`);
        }

        // Skip any remaining data (server ID, obfuscation key, etc.)
        if (reader.remaining() > 0) {
            Logger.debug('CryptInitPacket', `skipping ${reader.remaining()} remaining bytes`);
            reader.skip(reader.remaining());
        }

        Logger.hexDump('CryptInit xorKeyData', this.xorKeyData);

        return this;
    }
}
