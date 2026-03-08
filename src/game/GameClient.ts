import Connection from '../network/Connection';
import { Logger } from '../logger/Logger';
import { GamePacketHandler } from './GamePacketHandler';
import { GameState } from './GameState';
import type { SessionData } from '../login/types';
import type { IncomingGamePacket } from './packets/incoming/IncomingGamePacket';
import { CryptInitPacket } from './packets/incoming/CryptInitPacket';
import { CharSelectedPacket } from './packets/incoming/CharSelectedPacket';
import { UserInfoPacket } from './packets/incoming/UserInfoPacket';
import { NetPingRequestPacket } from './packets/incoming/NetPingRequestPacket';
import { ProtocolVersion } from './packets/outgoing/ProtocolVersion';
import { CharacterSelected } from './packets/outgoing/CharacterSelected';
import { AuthRequest } from './packets/outgoing/AuthRequest';
import { GameCrypt } from './GameCrypt';
import { CONFIG } from '../config';
import { OutgoingGamePacket } from './packets/outgoing/OutgoingGamePacket';

export class GameClient extends Connection {
    private state: GameState = GameState.IDLE;
    private crypt: GameCrypt = new GameCrypt();
    private handler: GamePacketHandler = new GamePacketHandler();

    constructor(
        private session: SessionData,
    ) {
        super();
    }

    start(): void {
        Logger.logState(this.state, GameState.CONNECTING);
        Logger.info('GameClient', `Connecting to Game Server: ${this.session.gameServerIp}:${this.session.gameServerPort}`);
        this.state = GameState.CONNECTING;
        this.connect(this.session.gameServerIp, this.session.gameServerPort);
    }

    protected onConnect(): void {
        Logger.info('GameClient', 'Connected to Game Server');
        Logger.logState(this.state, GameState.WAIT_CRYPT_INIT);
        this.state = GameState.WAIT_CRYPT_INIT;
        const pv = new ProtocolVersion();
        this.sendPacketRawBuffer(pv.encode());
    }

    protected onClose(): void {
        Logger.info('GameClient', '*** GAME SERVER CONNECTION CLOSED ***');
    }

    protected onError(err: Error): void {
        Logger.error('GameClient', `*** GAME SERVER ERROR: ${err.message} ***`);
        this.state = GameState.ERROR;
    }

    protected onRawPacket(fullPacket: Buffer): void {
        const encryptedBody = fullPacket.subarray(2);
        const body = this.crypt.decrypt(encryptedBody);
        
        const opcode = body[0];
        Logger.logPacket('RECV', opcode, fullPacket);
        Logger.debug('GameClient', `[state=${this.state}] opcode=0x${opcode.toString(16).padStart(2, '0')} bodyLen=${body.length}`);

        Logger.hexDump('RECV DECRYPTED', body, Math.min(body.length, 64));

        const packet = this.handler.handle(opcode, body, this.state);

        if (packet !== null) {
            this.handlePacket(packet, opcode);
        } else {
            Logger.warn('GameClient', `Unknown opcode=0x${opcode.toString(16).padStart(2, '0')}, bodyLen=${body.length}`);
        }
    }

    private handlePacket(packet: IncomingGamePacket, opcode: number): void {
        switch (this.state) {
            case GameState.WAIT_CRYPT_INIT: {
                if (opcode !== 0x00 && opcode !== 0x2D) {
                    Logger.warn('GameClient', `Expected CryptInit, got 0x${opcode.toString(16)}`);
                    return;
                }
                const p = packet as CryptInitPacket;
                if (p.result !== 1) {
                    Logger.error('GameClient', `ProtocolVersion rejected by server! result=${p.result}`);
                    return;
                }

                // Initialize crypto
                this.crypt.initKey(p.xorKeyData, p.useEncryption);
                Logger.info('GameCrypt', `XOR keys initialized. Encryption will be used: ${p.useEncryption}`);

                Logger.info('GameClient', 'Sending AuthLogin (0x08)...');
                this.sendPacket(new AuthRequest(this.session, CONFIG.Username));

                Logger.logState(this.state, GameState.WAIT_CHAR_LIST);
                this.state = GameState.WAIT_CHAR_LIST;
                return;
            }

            case GameState.WAIT_CHAR_LIST: {
                if (opcode === 0x04 || opcode === 0x13 || opcode === 0x2C) {
                    const charInfo = packet as import('./packets/incoming/CharSelectInfoPacket').CharSelectInfoPacket;
                    Logger.info('GameClient', `CharSelectInfo received: ${charInfo.charCount} character(s)`);
                    
                    // Select character
                    Logger.info('GameClient', `Sending CharacterSelect for slot ${CONFIG.CharSlotIndex}...`);
                    this.sendPacket(new CharacterSelected(CONFIG.CharSlotIndex));
                    
                    Logger.logState(this.state, GameState.WAIT_CHAR_SELECTED);
                    this.state = GameState.WAIT_CHAR_SELECTED;
                }
                return;
            }

            case GameState.WAIT_CHAR_SELECTED: {
                if (opcode === 0x15) {
                    Logger.info('GameClient', 'CharSelected confirmation received');
                    this.handleCharSelected(packet as CharSelectedPacket);
                    return;
                }
                return;
            }

            case GameState.WAIT_USER_INFO: {
                if (opcode === 0x04) {
                    const p = packet as UserInfoPacket;
                    Logger.info('GameClient', `ENTERED GAME WORLD AS: ${p.name}`);
                    Logger.logState(this.state, GameState.IN_GAME);
                    this.state = GameState.IN_GAME;
                }
                break;
            }

            case GameState.IN_GAME: {
                if (opcode === 0xD3) {
                    const p = packet as NetPingRequestPacket;
                    Logger.debug('GameClient', `pingId=${p.pingId} -> Pong`);
                    this.sendPacketRawBuffer(Buffer.from([0xA8, p.pingId])); // Not sure if ping should be encrypted
                }
                break;
            }

            default:
                Logger.warn('GameClient', `Packet in state ${this.state}, opcode=0x${opcode.toString(16)}`);
        }
    }

    private handleCharSelected(p: CharSelectedPacket): void {
        Logger.info('GameClient', `CharSelected: ${p.charName}  id=${p.charId}`);
        Logger.logState(this.state, GameState.WAIT_USER_INFO);
        this.state = GameState.WAIT_USER_INFO;

        // Send EnterWorld sequence (three packets from Wireshark capture)
        // Part 1: 0x9D (empty)
        this.sendPacketRawBuffer(Buffer.from([0x9D]));

        // Part 2: 0xD0 0x08 0x00
        this.sendPacketRawBuffer(Buffer.from([0xD0, 0x08, 0x00]));

        // Part 3: EnterWorld (0x03) with 104 bytes padding
        const enterWorldPayload = Buffer.alloc(105, 0);
        enterWorldPayload[0] = 0x03;
        this.sendPacketRawBuffer(enterWorldPayload);
    }

    private sendPacket(packet: OutgoingGamePacket): void {
        const body = packet.encode();
        const encrypted = this.crypt.encrypt(body);
        this.sendPacketRawBuffer(encrypted);
    }

    private sendPacketRawBuffer(buffer: Buffer): void {
        Logger.debug('GameClient', `-> Buffer len=${buffer.length}`);
        const totalLen = buffer.length + 2;
        const out = Buffer.allocUnsafe(totalLen);
        out.writeUInt16LE(totalLen, 0);
        buffer.copy(out, 2);
        this.sendRaw(out);
    }
}
