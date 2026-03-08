export interface IncomingLoginPacket {
  decode(reader: PacketReader): this;
}

/**
 * Simple binary reader for Login Server packets.
 * Separate from network/PacketReader because login packets use a different
 * naming convention (readInt32 vs readInt32LE) and have login-specific helpers.
 */
export class PacketReader {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readInt32(): number {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for int32 at offset ${this.offset}`);
    }
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt8(): number {
    if (this.offset + 1 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for uint8 at offset ${this.offset}`);
    }
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for int16 at offset ${this.offset}`);
    }
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt16(): number {
    if (this.offset + 2 > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for uint16 at offset ${this.offset}`);
    }
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readBytes(length: number): Buffer {
    if (this.offset + length > this.buffer.length) {
      throw new Error(`PacketReader: not enough data for ${length} bytes at offset ${this.offset}`);
    }
    const value = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  remaining(): Buffer {
    return this.buffer.slice(this.offset);
  }

  currentOffset(): number {
    return this.offset;
  }

  ensureAvailable(bytes: number): boolean {
    return this.buffer.length - this.offset >= bytes;
  }
}
