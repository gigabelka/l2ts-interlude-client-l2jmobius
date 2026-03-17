import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * CharInfo (0x03) - Other player information
 * 
 * Structure (simplified):
 * - x, y, z (int32 each)
 * - heading (int32)
 * - objectId (int32)
 * - name (string)
 * - race (int32)
 * - sex (int32)
 * - classId (int32)
 * ... more fields
 */
export class CharInfoPacket implements IncomingGamePacket {
    public objectId: number = 0;
    public name: string = '';
    public race: number = 0;
    public sex: number = 0;
    public classId: number = 0;
    public level: number = 0;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x03
            
            this.x = reader.readInt32LE();
            this.y = reader.readInt32LE();
            this.z = reader.readInt32LE();
            this.objectId = reader.readInt32LE();
            
            // Skip to name - this is simplified, actual structure is more complex
            // For now just emit event with basic info

            // Emit event for WebSocket
            EventBus.emitEvent({
                type: 'world.player_seen',
                channel: 'world',
                data: {
                    objectId: this.objectId,
                    name: this.name || `Player ${this.objectId}`,
                    position: { x: this.x, y: this.y, z: this.z }
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
