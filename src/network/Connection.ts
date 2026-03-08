import * as net from 'node:net';
import { Logger } from '../logger/Logger';

/**
 * Abstract TCP client with L2 packet framing.
 *
 * L2 protocol: each packet starts with uint16LE total length (including
 * the 2-byte header itself). Multiple packets may arrive in one TCP chunk;
 * one packet may span multiple chunks.
 */
abstract class Connection {
  protected socket?: net.Socket;
  private recvBuffer: Buffer = Buffer.alloc(0);
  private host?: string;
  private port?: number;

  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;

    Logger.info('TCP', `Connecting to ${host}:${port}`);

    this.socket = new net.Socket();

    this.socket.on('connect', () => {
      Logger.info('TCP', `Connected to ${host}:${port}`);
      this.onConnect();
    });

    this.socket.on('data', (chunk: Buffer) => {
      this.handleData(chunk);
    });

    this.socket.on('close', (hadError: boolean) => {
      Logger.info('TCP', `Connection to ${host}:${port} closed (${hadError ? 'with error' : 'clean'})`);
      this.onClose();
    });

    this.socket.on('error', (err: Error) => {
      Logger.error('TCP', `Socket error: ${err.message}`);
      this.onError(err);
    });

    try {
      this.socket.connect(port, host);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error('TCP', `Connection failed: ${error.message}`);
      this.onError(error);
    }
  }

  protected sendRaw(data: Buffer): void {
    if (!this.socket || this.socket.destroyed) {
      Logger.error('TCP', 'Cannot send: socket not initialized or destroyed');
      return;
    }
    Logger.info('TCP', `*** SENT ${data.length} bytes to server ***`);
    this.socket.write(data);
  }

  disconnect(): void {
    if (this.socket && !this.socket.destroyed) {
      Logger.info('TCP', `Closing connection to ${this.host}:${this.port}`);
      this.socket.end();
      this.socket.destroy();
    } else {
      Logger.debug('TCP', 'Socket already closed');
    }
  }

  /**
   * Reassemble L2 packets from TCP stream.
   * uint16LE at the start of each packet defines full length (including the 2-byte header).
   */
  private handleData(chunk: Buffer): void {
    this.recvBuffer = Buffer.concat([this.recvBuffer, chunk]);
    Logger.info('TCP', `*** RAW TCP DATA RECEIVED: ${chunk.length} bytes ***`);
    Logger.debug('TCP', `Data received: ${chunk.length} bytes, buffer total: ${this.recvBuffer.length} bytes`);

    while (this.recvBuffer.length >= 2) {
      const packetLen = this.recvBuffer.readUInt16LE(0);
      Logger.debug('TCP', `Packet length field: ${packetLen}, available: ${this.recvBuffer.length}`);

      if (this.recvBuffer.length < packetLen) {
        Logger.debug('TCP', `Incomplete packet: need ${packetLen}, have ${this.recvBuffer.length}`);
        break;
      }

      const fullPacket = this.recvBuffer.subarray(0, packetLen);
      this.recvBuffer  = this.recvBuffer.subarray(packetLen);

      Logger.debug('TCP', `Packet assembled: ${fullPacket.length} bytes, buffer remaining: ${this.recvBuffer.length} bytes`);
      this.onRawPacket(fullPacket);
    }
  }

  protected abstract onRawPacket(fullPacket: Buffer): void;

  protected abstract onConnect(): void;

  protected abstract onClose(): void;

  protected abstract onError(err: Error): void;
}

export default Connection;
