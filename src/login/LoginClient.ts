import Connection from '../network/Connection';
import { Logger } from '../logger/Logger';
import { LoginCrypt } from './LoginCrypt';
import { LoginPacketHandler } from './LoginPacketHandler';
import { LoginState, type SessionData, type LoginConfig } from './types';
import type { IncomingLoginPacket } from './packets/incoming/IncomingLoginPacket';
import { InitPacket } from './packets/incoming/InitPacket';
import { GGAuthPacket } from './packets/incoming/GGAuthPacket';
import { LoginOkPacket } from './packets/incoming/LoginOkPacket';
import { LoginFailPacket } from './packets/incoming/LoginFailPacket';
import { ServerListPacket } from './packets/incoming/ServerListPacket';
import { PlayOkPacket } from './packets/incoming/PlayOkPacket';
import { PlayFailPacket } from './packets/incoming/PlayFailPacket';
import { ScrambledRSAKey } from '../crypto/ScrambledRSAKey';
import { RequestGGAuth } from './packets/outgoing/RequestGGAuth';
import { RequestAuthLogin } from './packets/outgoing/RequestAuthLogin';
import { RequestServerList } from './packets/outgoing/RequestServerList';
import { RequestServerLogin } from './packets/outgoing/RequestServerLogin';
import type { OutgoingLoginPacket } from './packets/outgoing/OutgoingLoginPacket';

/**
 * Login Server client — FSM-driven with Blowfish/RSA encryption.
 *
 * Packet flow:
 *   connect -> Init -> RequestGGAuth -> GGAuth -> RequestAuthLogin
 *   -> LoginOk -> RequestServerList -> ServerList -> RequestServerLogin
 *   -> PlayOk -> disconnect -> callback(session)
 */
export class LoginClient extends Connection {
    private state: LoginState = LoginState.IDLE;
    private crypt: LoginCrypt = new LoginCrypt();
    private handler: LoginPacketHandler = new LoginPacketHandler();
    private session: Partial<SessionData> = {};

    constructor(
        private config: LoginConfig,
        private onComplete: (session: SessionData) => void,
    ) {
        super();
    }

    start(): void {
        Logger.logState(this.state, LoginState.CONNECTING);
        this.state = LoginState.CONNECTING;
        this.connect(this.config.LoginIp, this.config.LoginPort);
    }

    protected onConnect(): void {
        Logger.info('LoginClient', 'Connected to Login Server');
        Logger.logState(this.state, LoginState.WAIT_INIT);
        this.state = LoginState.WAIT_INIT;
    }

    protected onClose(): void {
        Logger.info('LoginClient', 'Login Server connection closed');
    }

    protected onError(err: Error): void {
        Logger.error('LoginClient', `Error: ${err.message}`);
        this.state = LoginState.ERROR;
    }

    protected onRawPacket(fullPacket: Buffer): void {
        const body = fullPacket.subarray(2);

        let decrypted: Buffer;

        if (this.state === LoginState.WAIT_INIT) {
            // Init packet is encrypted with static Blowfish key + rolling XOR
            decrypted = this.crypt.decryptInit(body);
        } else {
            decrypted = this.crypt.decrypt(body);
        }

        const opcode = decrypted[0];

        Logger.logPacket('RECV', opcode, fullPacket);
        Logger.hexDump('RECV DECRYPTED', decrypted);

        const packet = this.handler.handle(opcode, decrypted);
        if (packet) this.handlePacket(packet, opcode);
    }

    /** FSM: route packets by current state. */
    private handlePacket(packet: IncomingLoginPacket, opcode: number): void {
        switch (this.state) {

            case LoginState.WAIT_INIT: {
                if (opcode === 0x01) {
                    const pkt = packet as LoginFailPacket;
                    Logger.error('LoginClient', `Init error: ${LoginFailPacket.getReasonMessage(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                    this.disconnect();
                    return;
                }
                if (opcode !== 0x00) {
                    Logger.warn('LoginClient',
                        `Expected Init(0x00), got 0x${opcode.toString(16)}`);
                    return;
                }
                const pkt = packet as InitPacket;
                this.session.sessionId = pkt.sessionId;
                this.session.rsaPublicKey = ScrambledRSAKey.unscramble(pkt.scrambledRsaKey);
                this.crypt.setSessionKey(pkt.blowfishKey);

                Logger.logState(this.state, LoginState.WAIT_GG_AUTH);
                this.state = LoginState.WAIT_GG_AUTH;
                this.sendPacket(new RequestGGAuth(this.session.sessionId));
                break;
            }

            case LoginState.WAIT_GG_AUTH: {
                if (opcode !== 0x0B) {
                    Logger.debug('LoginClient',
                        `WAIT_GG_AUTH: ignoring 0x${opcode.toString(16)}`);
                    return;
                }
                const pkt = packet as GGAuthPacket;
                this.session.ggAuthResponse = pkt.ggAuthResponse;

                Logger.logState(this.state, LoginState.WAIT_LOGIN_OK);
                this.state = LoginState.WAIT_LOGIN_OK;
                this.sendPacket(new RequestAuthLogin(
                    this.config.Username,
                    this.config.Password,
                    this.session.rsaPublicKey!,
                    this.session.ggAuthResponse,
                ));
                break;
            }

            case LoginState.WAIT_LOGIN_OK: {
                if (opcode === 0x03) {
                    const pkt = packet as LoginOkPacket;
                    this.session.loginOkId1 = pkt.loginOkId1;
                    this.session.loginOkId2 = pkt.loginOkId2;

                    Logger.logState(this.state, LoginState.WAIT_SERVER_LIST);
                    this.state = LoginState.WAIT_SERVER_LIST;
                    this.sendPacket(new RequestServerList(
                        this.session.loginOkId1,
                        this.session.loginOkId2,
                    ));
                } else if (opcode === 0x01) {
                    const pkt = packet as LoginFailPacket;
                    Logger.error('LoginClient',
                        `Auth failed: ${LoginFailPacket.getReasonMessage(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                    this.disconnect();
                } else {
                    Logger.debug('LoginClient',
                        `WAIT_LOGIN_OK: ignoring 0x${opcode.toString(16)}`);
                }
                break;
            }

            case LoginState.WAIT_SERVER_LIST: {
                if (opcode !== 0x04) {
                    Logger.debug('LoginClient',
                        `WAIT_SERVER_LIST: ignoring 0x${opcode.toString(16)}`);
                    return;
                }
                const pkt = packet as ServerListPacket;
                const server = pkt.servers.find(s => s.serverId === this.config.ServerId);

                if (!server) {
                    Logger.error('LoginClient',
                        `Server ID=${this.config.ServerId} not found in list`);
                    this.state = LoginState.ERROR;
                    this.disconnect();
                    return;
                }

                this.session.gameServerIp = server.ip;
                this.session.gameServerPort = server.port;
                Logger.info('LoginClient',
                    `Selected server: ID=${server.serverId} IP=${server.ip}:${server.port}`);

                Logger.logState(this.state, LoginState.WAIT_PLAY_OK);
                this.state = LoginState.WAIT_PLAY_OK;
                this.sendPacket(new RequestServerLogin(
                    this.session.loginOkId1!,
                    this.session.loginOkId2!,
                    this.config.ServerId,
                ));
                break;
            }

            case LoginState.WAIT_PLAY_OK: {
                if (opcode === 0x07) {
                    const pkt = packet as PlayOkPacket;
                    this.session.playOkId1 = pkt.playOkId1;
                    this.session.playOkId2 = pkt.playOkId2;

                    Logger.info('LoginClient',
                        'PlayOk received, Login Server auth complete');
                    this.disconnect();
                    this.state = LoginState.DONE;
                    this.session.username = this.config.Username;
                    this.onComplete(this.session as SessionData);
                } else if (opcode === 0x06) {
                    const pkt = packet as PlayFailPacket;
                    Logger.error('LoginClient',
                        `PlayFail: ${PlayFailPacket.getReasonMessage(pkt.reason)}`);
                    this.state = LoginState.ERROR;
                } else {
                    Logger.debug('LoginClient',
                        `WAIT_PLAY_OK: ignoring 0x${opcode.toString(16)}`);
                }
                break;
            }

            default:
                Logger.warn('LoginClient',
                    `Packet in state ${this.state}, opcode=0x${opcode.toString(16)}`);
        }
    }

    private sendPacket(packet: OutgoingLoginPacket): void {
        const body = packet.encode();
        Logger.logPacket('SEND', body[0], body);

        const encrypted = this.crypt.prepareOutgoing(body);
        const len = encrypted.length + 2;
        const out = Buffer.allocUnsafe(len);
        out.writeUInt16LE(len, 0);
        encrypted.copy(out, 2);
        Logger.hexDump('SEND FINAL (with length)', out);
        this.sendRaw(out);
    }
}
