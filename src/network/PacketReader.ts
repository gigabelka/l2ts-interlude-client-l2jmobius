/**
 * Binary reader for Lineage 2 packet data (little-endian).
 */
export class PacketReader {
  constructor(
    private buf: Buffer,
    private pos: number = 0
  ) {}

  readUInt8(): number {
    const v = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return v;
  }

  readUInt16LE(): number {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }

  readInt32LE(): number {
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }

  readInt64LE(): bigint {
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return v;
  }

  readDouble(): number {
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }

  readFloatLE(): number {
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }

  readBytes(n: number): Buffer {
    if (this.pos + n > this.buf.length) {
      throw new Error(`Not enough data to read ${n} bytes. Available: ${this.buf.length - this.pos}`);
    }
    const result = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return result;
  }

  /** Read null-terminated UTF-16LE string (terminator consumed but not returned). */
  readStringUTF16(): string {
    if (this.pos + 2 > this.buf.length) {
      throw new Error('Not enough data to read UTF-16 string terminator');
    }

    let endPos = this.pos;
    while (endPos + 1 < this.buf.length) {
      if (this.buf[endPos] === 0x00 && this.buf[endPos + 1] === 0x00) {
        break;
      }
      endPos += 2;
    }

    if (endPos + 1 >= this.buf.length) {
      throw new Error('UTF-16 string without terminator');
    }

    const strBuffer = this.buf.slice(this.pos, endPos);
    let result = '';

    try {
      result = strBuffer.toString('utf16le');
    } catch (e) {
      console.warn('UTF-16 decode error:', e);
    }

    this.pos = endPos + 2;
    return result;
  }

  remaining(): number {
    return this.buf.length - this.pos;
  }

  skip(n: number): this {
    if (this.pos + n > this.buf.length) {
      throw new Error(`Cannot skip ${n} bytes. Only ${this.buf.length - this.pos} available`);
    }
    this.pos += n;
    return this;
  }

  getBuffer(): Buffer {
    return this.buf;
  }
}
