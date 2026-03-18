import * as net from 'node:net';
import { Logger } from '../logger/Logger';

/**
 * @fileoverview Connection - Abstract TCP client with L2 packet framing
 * 
 * Handles low-level TCP connection management and implements the Lineage 2
 * packet framing protocol. Each packet begins with a 2-byte length header
 * (uint16LE) indicating the total packet size including the header.
 * 
 * Key features:
 * - Automatic packet reassembly from TCP stream
 * - Connection state management (connect, disconnect, error)
 * - Abstract interface for protocol-specific implementations
 * 
 * L2 Packet Format:
 * ```
 * [Length: 2 bytes uint16LE] [Body: Length-2 bytes]
 * ```
 * 
 * Note: Multiple packets may arrive in a single TCP chunk, or a single
 * packet may span multiple chunks. This class handles reassembly automatically.
 * 
 * @module network/Connection
 * @example
 * ```typescript
 * class GameClient extends Connection {
 *   protected onRawPacket(fullPacket: Buffer): void {
 *     const body = fullPacket.subarray(2);
 *     const opcode = body[0];
 *     console.log(`Received packet opcode=${opcode}`);
 *   }
 * 
 *   protected onConnect(): void {
 *     console.log('Connected!');
 *   }
 * 
 *   protected onClose(): void {
 *     console.log('Disconnected!');
 *   }
 * 
 *   protected onError(err: Error): void {
 *     console.error('Error:', err);
 *   }
 * }
 * 
 * const client = new GameClient();
 * client.connect('127.0.0.1', 7777);
 * ```
 */

/**
 * Abstract TCP connection with Lineage 2 packet framing.
 * 
 * Implements the base TCP connection logic including:
 * - Connection establishment and teardown
 * - Packet reassembly from TCP stream
 * - Abstract handlers for protocol-specific processing
 * 
 * Subclasses must implement the abstract handler methods to process
 * packets and handle connection state changes.
 * 
 * @abstract
 * @class Connection
 */
abstract class Connection {
  /** Underlying TCP socket */
  protected socket?: net.Socket;
  /** Receive buffer for packet reassembly */
  private recvBuffer: Buffer = Buffer.alloc(0);
  /** Remote host address */
  private host?: string;
  /** Remote port number */
  private port?: number;
  /** Connection timeout timer */
  private connectTimeout?: NodeJS.Timeout;
  /** Connection timeout in milliseconds */
  private readonly CONNECT_TIMEOUT_MS = 10000;

  /**
   * Establish TCP connection to the specified host and port.
   * 
   * @param {string} host - Remote host address (IP or hostname)
   * @param {number} port - Remote port number
   * @example
   * ```typescript
   * client.connect('192.168.1.100', 7777);
   * ```
   */
  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;

    Logger.info('TCP', `Connecting to ${host}:${port}`);

    this.socket = new net.Socket();

    // Set up connection timeout
    this.connectTimeout = setTimeout(() => {
      const timeoutError = new Error(`Connection timeout after ${this.CONNECT_TIMEOUT_MS}ms`);
      Logger.error('TCP', timeoutError.message);
      this.socket?.destroy();
      this.onError(timeoutError);
    }, this.CONNECT_TIMEOUT_MS);

    this.socket.on('connect', () => {
      // Clear connection timeout on successful connection
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.info('TCP', `Connected to ${host}:${port}`);
      this.onConnect();
    });

    this.socket.on('data', (chunk: Buffer) => {
      this.handleData(chunk);
    });

    this.socket.on('close', (hadError: boolean) => {
      // Clear connection timeout if still pending
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.info('TCP', `Connection to ${host}:${port} closed (${hadError ? 'with error' : 'clean'})`);
      this.onClose();
    });

    this.socket.on('error', (err: Error) => {
      // Clear connection timeout on error
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      Logger.error('TCP', `Socket error: ${err.message}`);
      this.onError(err);
    });

    try {
      this.socket.connect(port, host);
    } catch (err) {
      // Clear connection timeout on synchronous error
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = undefined;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      Logger.error('TCP', `Connection failed: ${error.message}`);
      this.onError(error);
    }
  }

  /**
   * Send raw data over the TCP connection.
   * 
   * @protected
   * @param {Buffer} data - Raw bytes to send
   * @example
   * ```typescript
   * const packet = Buffer.from([0x00, 0x05, 0x01, 0x02, 0x03]);
   * this.sendRaw(packet);
   * ```
   */
  protected sendRaw(data: Buffer): void {
    if (!this.socket || this.socket.destroyed) {
      Logger.error('TCP', 'Cannot send: socket not initialized or destroyed');
      return;
    }
    Logger.info('TCP', `*** SENT ${data.length} bytes to server ***`);
    this.socket.write(data);
  }

  /**
   * Close the TCP connection gracefully.
   * 
   * @example
   * ```typescript
   * client.disconnect();
   * ```
   */
  disconnect(): void {
    // Clear connection timeout if still pending
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = undefined;
    }
    if (this.socket && !this.socket.destroyed) {
      Logger.info('TCP', `Closing connection to ${this.host}:${this.port}`);
      this.socket.end();
      this.socket.destroy();
    } else {
      Logger.debug('TCP', 'Socket already closed');
    }
  }

  /**
   * Reassemble L2 packets from TCP stream data.
   * 
   * The L2 protocol uses a 2-byte length prefix (uint16LE) at the start
   * of each packet. This method accumulates incoming data and extracts
   * complete packets, calling onRawPacket for each one.
   * 
   * @private
   * @param {Buffer} chunk - Raw TCP data chunk
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

  /**
   * Handle a complete packet received from the server.
   * 
   * @abstract
   * @protected
   * @param {Buffer} fullPacket - Complete packet including 2-byte length header
   */
  protected abstract onRawPacket(fullPacket: Buffer): void;

  /**
   * Handle successful connection establishment.
   * Called when the TCP connection is established.
   * 
   * @abstract
   * @protected
   */
  protected abstract onConnect(): void;

  /**
   * Handle connection closure.
   * Called when the TCP connection is closed.
   * 
   * @abstract
   * @protected
   */
  protected abstract onClose(): void;

  /**
   * Handle connection errors.
   * Called when a socket error occurs.
   * 
   * @abstract
   * @protected
   * @param {Error} err - Error object
   */
  protected abstract onError(err: Error): void;
}

export default Connection;
