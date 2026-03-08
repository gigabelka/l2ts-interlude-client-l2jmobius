import { Logger } from '../logger/Logger';

/**
 * XOR encryption for Game Server (Lineage 2 Interlude / CT0).
 *
 * Uses 8-byte key from CryptInit directly (not duplicated).
 * Each byte encrypted as: raw ^ key[i & 7]
 */
export class GameCrypt {
    private key_sc: Buffer = Buffer.alloc(8);
    private key_cs: Buffer = Buffer.alloc(8);
    private enabled: boolean = false;
    private firstPacket: boolean = true;

    /**
     * Initialize keys from CryptInit packet data.
     * @param xorKeyData 8 bytes from CryptInit body
     * @param enableEncryption whether encryption should be enabled
     */
    initKey(xorKeyData: Buffer, enableEncryption: boolean = true): void {
        if (xorKeyData.length < 8) {
            throw new Error(`initKey: expected 8 bytes xorKeyData, got ${xorKeyData.length}`);
        }

        // Use 8-byte key directly (not duplicated)
        this.key_sc = Buffer.from(xorKeyData);
        this.key_cs = Buffer.from(xorKeyData);

        this.enabled = enableEncryption;
        this.firstPacket = true;  // First packet after CryptInit is UNENCRYPTED

        Logger.info('GameCrypt', `XOR keys initialized (8-byte, no duplication). Encryption enabled: ${this.enabled}`);
        Logger.logKeys('GameCrypt key_cs', this.key_cs);
    }

    /**
     * Check if encryption is ready
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Decrypt incoming packet body - simple XOR.
     */
    decrypt(data: Buffer): Buffer {
        if (!this.enabled) {
            return data;
        }

        const result = Buffer.from(data);

        Logger.hexDump('GAME DECRYPT INPUT', result, 16);

        for (let k = 0; k < data.length; k++) {
            result[k] = (result[k] ^ this.key_sc[k & 7]) & 0xFF;
        }

        Logger.hexDump('GAME DECRYPT OUTPUT', result, 16);

        return result;
    }

    /**
     * Encrypt outgoing packet body - simple XOR.
     * First packet after CryptInit is NOT encrypted!
     */
    encrypt(data: Buffer): Buffer {
        if (!this.enabled) {
            return data;
        }

        // First packet after CryptInit is UNENCRYPTED!
        if (this.firstPacket) {
            Logger.info('GameCrypt', 'First packet - SKIPPING encryption');
            this.firstPacket = false;
            return data;
        }

        const result = Buffer.from(data);

        Logger.hexDump('GAME ENCRYPT INPUT', result, 16);

        for (let i = 0; i < data.length; i++) {
            result[i] = (result[i] ^ this.key_cs[i & 7]) & 0xFF;
        }

        Logger.hexDump('GAME ENCRYPT OUTPUT', result, 16);

        return result;
    }
}
