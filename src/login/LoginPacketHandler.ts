import { Logger } from '../logger/Logger';
import type { IncomingLoginPacket } from './packets/incoming/IncomingLoginPacket';
import { PacketReader } from './packets/incoming/IncomingLoginPacket';
import { InitPacket } from './packets/incoming/InitPacket';
import { GGAuthPacket } from './packets/incoming/GGAuthPacket';
import { LoginOkPacket } from './packets/incoming/LoginOkPacket';
import { LoginFailPacket } from './packets/incoming/LoginFailPacket';
import { ServerListPacket } from './packets/incoming/ServerListPacket';
import { PlayOkPacket } from './packets/incoming/PlayOkPacket';
import { PlayFailPacket } from './packets/incoming/PlayFailPacket';

/**
 * Opcode router for incoming Login Server packets.
 */
export class LoginPacketHandler {
  handle(opcode: number, body: Buffer): IncomingLoginPacket | null {
    const reader = new PacketReader(body);

    try {
      switch (opcode) {
        case 0x00: return new InitPacket().decode(reader);
        case 0x0B: return new GGAuthPacket().decode(reader);
        case 0x03: return new LoginOkPacket().decode(reader);
        case 0x01: return new LoginFailPacket().decode(reader);
        case 0x04: return new ServerListPacket().decode(reader);
        case 0x07: return new PlayOkPacket().decode(reader);
        case 0x06: return new PlayFailPacket().decode(reader);
        default:
          Logger.warn('LoginPacketHandler', `Unknown OpCode: 0x${opcode.toString(16)}`);
          Logger.hexDump('UNKNOWN PACKET', body);
          return null;
      }
    } catch (error) {
      Logger.error('LoginPacketHandler', `Decode error OpCode=0x${opcode.toString(16)}: ${error}`);
      Logger.hexDump('ERROR PACKET BODY', body);
      return null;
    }
  }
}
