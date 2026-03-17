import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore, Position } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * MoveToLocation (0x2E) - Entity movement
 * 
 * Structure:
 * - objectId (int32) - Moving entity
 * - destX (int32) - Destination X
 * - destY (int32) - Destination Y
 * - destZ (int32) - Destination Z
 * - curX (int32) - Current X
 * - curY (int32) - Current Y
 * - curZ (int32) - Current Z
 */
export class MoveToLocationPacket implements IncomingGamePacket {
    public objectId: number = 0;
    public destination: Position = { x: 0, y: 0, z: 0 };
    public current: Position = { x: 0, y: 0, z: 0 };

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x2E
            
            this.objectId = reader.readInt32LE();
            this.destination.x = reader.readInt32LE();
            this.destination.y = reader.readInt32LE();
            this.destination.z = reader.readInt32LE();
            this.current.x = reader.readInt32LE();
            this.current.y = reader.readInt32LE();
            this.current.z = reader.readInt32LE();

            // Check if this is our character
            const character = GameStateStore.getCharacter();
            
            if (character.objectId === this.objectId) {
                // Update character position
                GameStateStore.updatePosition(this.destination);
            } else {
                // Check if it's an NPC
                const npc = GameStateStore.getWorld().npcs.get(this.objectId);
                if (npc) {
                    GameStateStore.updateNpc(this.objectId, {
                        position: this.destination
                    });
                } else {
                    // It might be another player
                    const player = GameStateStore.getWorld().players.get(this.objectId);
                    if (player) {
                        GameStateStore.addPlayer({
                            ...player,
                            position: this.destination
                        });
                    }
                }
            }

            // Emit movement position changed event
            EventBus.emitEvent({
                type: 'movement.position_changed',
                channel: 'movement',
                data: {
                    objectId: this.objectId,
                    position: this.destination,
                    speed: 0,
                    isRunning: true
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
