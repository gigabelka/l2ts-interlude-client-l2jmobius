import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * Attack (0x05) - Attack animation/sound
 * 
 * Structure:
 * - attackerObjectId (int32)
 * - targetObjectId (int32)
 * ... more fields
 */
export class AttackPacket implements IncomingGamePacket {
    public attackerObjectId: number = 0;
    public targetObjectId: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x05
            
            this.attackerObjectId = reader.readInt32LE();
            this.targetObjectId = reader.readInt32LE();

            // Emit combat event
            EventBus.emitEvent({
                type: 'combat.attack_started',
                channel: 'combat',
                data: {
                    attackerObjectId: this.attackerObjectId,
                    targetObjectId: this.targetObjectId
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
