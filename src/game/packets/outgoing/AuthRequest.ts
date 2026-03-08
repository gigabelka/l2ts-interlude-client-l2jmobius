import { PacketWriter } from '../../../network/PacketWriter';
import { Logger } from '../../../logger/Logger';
import { OutgoingGamePacket } from './OutgoingGamePacket';
import type { SessionData } from '../../../login/types';

/**
 * AuthLogin (OpCode=0x08) — request to login to game server.
 *
 * Format from Wireshark packet 199: 
 * opcode (1) + username (UTF-16LE + null) + playOk2 (4) + playOk1 (4) + loginOk1 (4) + loginOk2 (4) + language (4)
 */
export class AuthRequest implements OutgoingGamePacket {
    constructor(
        private session: SessionData,
        private username: string
    ) { }

    encode(): Buffer {
        const w = new PacketWriter();
        w.writeUInt8(0x08); // Opcode

        // Username in UTF-16LE null-terminated
        const usernameUtf16 = Buffer.from(this.username, 'utf16le');
        w.writeBytes(usernameUtf16);
        w.writeUInt16LE(0); // null terminator

        // Session tokens
        w.writeInt32LE(this.session.playOkId2);
        w.writeInt32LE(this.session.playOkId1);
        w.writeInt32LE(this.session.loginOkId1);
        w.writeInt32LE(this.session.loginOkId2);

        // Language / Unknown constant (0x01000000)
        w.writeInt32LE(1);

        const body = w.toBuffer();
        Logger.logPacket('SEND', 0x08, body);
        Logger.debug('AuthRequest', `Encoded: bodyLen=${body.length}, username="${this.username}"`);
        return body;
    }
}
