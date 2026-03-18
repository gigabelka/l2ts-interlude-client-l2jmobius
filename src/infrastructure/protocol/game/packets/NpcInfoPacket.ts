/**
 * @fileoverview NpcInfoPacket - DTO для пакета NpcInfo (0x16)
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface NpcInfoData {
    objectId: number;
    npcId: number;
    attackable: boolean;
    x: number;
    y: number;
    z: number;
    heading: number;
    name: string;
    title: string;
    level: number;
    isDead: boolean;
    currentHp: number;
    maxHp: number;
}

/**
 * Пакет NpcInfo (0x16)
 * Информация о NPC в игровом мире
 */
export class NpcInfoPacket implements IIncomingPacket {
    readonly opcode = 0x16;
    private data!: NpcInfoData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        
        // npcId + attackable flag in upper bits
        const npcIdRaw = reader.readInt32LE();
        const attackable = (npcIdRaw & 0x80000000) !== 0;
        const npcId = npcIdRaw & 0x7FFFFFFF;

        const x = reader.readInt32LE();
        const y = reader.readInt32LE();
        const z = reader.readInt32LE();
        const heading = reader.readInt32LE();

        // Skip some data (collision radius/height)
        reader.readInt32LE();
        reader.readInt32LE();

        // Skip running/casting/walking speeds
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();
        reader.readInt32LE();

        // Skip float speeds
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();
        reader.readFloatLE();

        const isDead = reader.readUInt8() !== 0;

        // Name and title
        const name = reader.readStringUTF16();
        const title = reader.readStringUTF16();

        // Level (optional in some versions)
        let level = 1;
        if (reader.remaining() >= 4) {
            level = reader.readInt32LE();
        }

        // HP data might be available in some versions
        let currentHp = 0;
        let maxHp = 0;
        
        this.data = {
            objectId,
            npcId,
            attackable,
            x,
            y,
            z,
            heading,
            name,
            title,
            level,
            isDead,
            currentHp,
            maxHp,
        };

        return this;
    }

    getData(): NpcInfoData {
        return { ...this.data };
    }
}
