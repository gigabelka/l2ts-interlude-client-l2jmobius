import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import type { SessionData } from '../../../login/types';

/**
 * AuthRequest (OpCode=0x08) — request to login to game server for L2J Mobius CT0.
 *
 * Specific Notes for L2J Mobius CT0 (from client_server_protocol.md):
 * 3. AuthRequest (0x08) sends username in UTF-16LE, playOkId2, playOkId1, loginOkId1, loginOkId2, and language (1)
 */
export class AuthRequest implements OutgoingGamePacket {
    constructor(
        private session: SessionData,
        private username: string
    ) { }

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x08); // Opcode for AuthRequest on L2J Mobius CT0

        // Username in UTF-16LE null-terminated
        const usernameUtf16 = Buffer.from(this.username, 'utf16le');
        w.writeBytes(usernameUtf16);
        w.writeUInt16LE(0); // null terminator

        // Session tokens (SPECIFIC ORDER for L2J Mobius CT0)
        w.writeInt32LE(this.session.playOkId2); // playOkId2 FIRST!
        w.writeInt32LE(this.session.playOkId1); // playOkId1 SECOND
        w.writeInt32LE(this.session.loginOkId1);
        w.writeInt32LE(this.session.loginOkId2);

        // Language / Unknown constant (usually 1)
        w.writeInt32LE(1);

        const body = w.toBuffer();
        Logger.info('AuthRequest', `Sending keys (0x08 Mobius): play2=0x${(this.session.playOkId2 >>> 0).toString(16)}, play1=0x${(this.session.playOkId1 >>> 0).toString(16)}, login1=0x${(this.session.loginOkId1 >>> 0).toString(16)}, login2=0x${(this.session.loginOkId2 >>> 0).toString(16)}`);
        Logger.logPacket('SEND', 0x08, body);
        Logger.debug('AuthRequest', `Encoded: bodyLen=${body.length}, username="${this.username}"`);
        return body;
    }
}
