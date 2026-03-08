import * as crypto from 'node:crypto';
import { Logger } from '../logger/Logger';

/**
 * RSA encryption for Login Server credentials (L2 Interlude).
 *
 * 128-byte plaintext layout (L2J standard):
 *   0x00-0x5D: zeros (94 bytes)
 *   0x5E-0x6B: login ASCII, null-padded to 14 bytes
 *   0x6C-0x6D: zeros (2 bytes)
 *   0x6E-0x7D: password ASCII, null-padded to 16 bytes
 *   0x7E-0x7F: zeros (2 bytes)
 *
 * Encrypted with RSA_NO_PADDING (1024 bit) — block is exactly 128 bytes.
 */
class RSACrypt {
  private static readonly RSA_KEY_SIZE    = 128;
  private static readonly PUBLIC_EXPONENT = 65537;

  static encryptCredentials(
    login: string,
    password: string,
    publicKeyModulus: Buffer
  ): Buffer {
    if (publicKeyModulus.length !== RSACrypt.RSA_KEY_SIZE) {
      throw new Error(
        `RSA modulus must be ${RSACrypt.RSA_KEY_SIZE} bytes, got ${publicKeyModulus.length}`
      );
    }

    Logger.debug('RSACrypt', `Encrypting credentials: login="${login}"`);

    const plaintext = RSACrypt.buildPlaintext(login, password);
    Logger.logCryptoSingle('RSA PLAINTEXT', plaintext, 128);

    const derKey = RSACrypt.buildPublicKeyDer(publicKeyModulus, RSACrypt.PUBLIC_EXPONENT);
    Logger.logCryptoSingle('RSA DER KEY', derKey, 16);

    try {
      const key = crypto.createPublicKey({ key: derKey, format: 'der', type: 'pkcs1' });
      const ciphertext = crypto.publicEncrypt(
        { key, padding: crypto.constants.RSA_NO_PADDING },
        plaintext
      );
      Logger.logCryptoSingle('RSA CIPHERTEXT', Buffer.from(ciphertext), 32);
      return Buffer.from(ciphertext);
    } catch (error) {
      throw new Error(`RSA encryption failed: ${error}`);
    }
  }

  private static buildPlaintext(login: string, password: string): Buffer {
    const plaintext = Buffer.alloc(RSACrypt.RSA_KEY_SIZE, 0);

    const loginBytes = Buffer.alloc(14, 0);
    loginBytes.write(login, 'ascii');
    loginBytes.copy(plaintext, 0x5E);

    const passBytes = Buffer.alloc(16, 0);
    passBytes.write(password, 'ascii');
    passBytes.copy(plaintext, 0x6E);

    return plaintext;
  }

  /**
   * Build ASN.1 DER PKCS#1 RSAPublicKey from modulus N and exponent E.
   */
  private static buildPublicKeyDer(modulus: Buffer, exponent: number): Buffer {
    const eBytes = RSACrypt.intToDerBuffer(exponent);

    // Leading 0x00 if high bit is set (DER INTEGER is signed)
    const mBytes = (modulus[0] & 0x80)
      ? Buffer.concat([Buffer.from([0x00]), modulus])
      : modulus;

    const intLength = RSACrypt.derLength;

    const modInt = Buffer.concat([
      Buffer.from([0x02, ...intLength(mBytes.length)]),
      mBytes,
    ]);

    const expInt = Buffer.concat([
      Buffer.from([0x02, ...intLength(eBytes.length)]),
      eBytes,
    ]);

    const inner = Buffer.concat([modInt, expInt]);

    return Buffer.concat([
      Buffer.from([0x30, ...intLength(inner.length)]),
      inner,
    ]);
  }

  private static derLength(len: number): number[] {
    if (len < 128) {
      return [len];
    } else if (len < 256) {
      return [0x81, len];
    } else {
      return [0x82, Math.floor(len / 256), len % 256];
    }
  }

  /** Convert integer to big-endian DER bytes (handles odd-length hex). */
  private static intToDerBuffer(value: number): Buffer {
    let hex = value.toString(16);

    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }

    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    return Buffer.from(bytes);
  }
}

export default RSACrypt;
