/**
 * @fileoverview MoveToLocationPacket - DTO для пакета MoveToLocation (0x2E)
 * Движение сущности к указанной позиции
 * @module infrastructure/protocol/game/packets
 */

import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MoveToLocationData {
    objectId: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    originX: number;
    originY: number;
    originZ: number;
    moveSpeed: number;
}

/**
 * Пакет MoveToLocation (0x2E)
 * Уведомление о начале движения сущности
 */
export class MoveToLocationPacket implements IIncomingPacket {
    readonly opcode = 0x2E;
    private data!: MoveToLocationData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const targetX = reader.readInt32LE();
        const targetY = reader.readInt32LE();
        const targetZ = reader.readInt32LE();
        const originX = reader.readInt32LE();
        const originY = reader.readInt32LE();
        const originZ = reader.readInt32LE();
        
        // Move speed (optional in some versions)
        let moveSpeed = 0;
        if (reader.remaining() >= 4) {
            moveSpeed = reader.readInt32LE();
        }

        this.data = {
            objectId,
            targetX,
            targetY,
            targetZ,
            originX,
            originY,
            originZ,
            moveSpeed,
        };

        return this;
    }

    getData(): MoveToLocationData {
        return { ...this.data };
    }

    /**
     * Рассчитать дистанцию перемещения
     */
    getDistance(): number {
        const dx = this.data.targetX - this.data.originX;
        const dy = this.data.targetY - this.data.originY;
        const dz = this.data.targetZ - this.data.originZ;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
