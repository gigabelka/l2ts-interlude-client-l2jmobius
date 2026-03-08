/**
 * Binary writer for Lineage 2 packet data (little-endian).
 */
export class PacketWriter {
  private chunks: Buffer[] = [];

  writeUInt8(v: number): this {
    const buf = Buffer.alloc(1);
    buf.writeUInt8(v, 0);
    this.chunks.push(buf);
    return this;
  }

  writeUInt16LE(v: number): this {
    const buf = Buffer.alloc(2);
    buf.writeUInt16LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  writeInt32LE(v: number): this {
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  writeInt64LE(v: bigint): this {
    const buf = Buffer.alloc(8);
    buf.writeBigInt64LE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  writeDouble(v: number): this {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(v, 0);
    this.chunks.push(buf);
    return this;
  }

  writeBytes(b: Buffer): this {
    this.chunks.push(Buffer.from(b));
    return this;
  }

  writeStringNullUTF16(s: string): this {
    if (s.length === 0) {
      const term = Buffer.from([0x00, 0x00]);
      this.chunks.push(term);
      return this;
    }

    const buf = Buffer.alloc(s.length * 2 + 2);
    buf.write(s, 0, s.length * 2, 'utf16le');
    buf[s.length * 2] = 0x00;
    buf[s.length * 2 + 1] = 0x00;
    this.chunks.push(buf);
    return this;
  }

  /** Return body buffer WITHOUT length prefix. */
  toBuffer(): Buffer {
    if (this.chunks.length === 0) {
      return Buffer.alloc(0);
    }
    const total = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = Buffer.alloc(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      chunk.copy(result, offset);
      offset += chunk.length;
    }
    return result;
  }

  reset(): this {
    this.chunks = [];
    return this;
  }
}
