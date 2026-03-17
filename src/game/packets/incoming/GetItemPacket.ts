import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * GetItem (0x0D) - Item was picked up
 * 
 * Structure:
 * - playerId (int32) - who picked up
 * - objectId (int32)
 * - x (int32)
 * - y (int32)
 * - z (int32)
 */
export class GetItemPacket implements IncomingGamePacket {
    public playerId: number = 0;
    public objectId: number = 0;
    public x: number = 0;
    public y: number = 0;
    public z: number = 0;

    decode(reader: PacketReader): this {
        reader.readUInt8(); // opcode 0x0D
        
        this.playerId = reader.readInt32LE();
        this.objectId = reader.readInt32LE();
        this.x = reader.readInt32LE();
        this.y = reader.readInt32LE();
        this.z = reader.readInt32LE();

        // Remove from GameStateStore
        GameStateStore.removeItemDrop(this.objectId, this.playerId);

        // Emit event if we picked it up
        const character = GameStateStore.getCharacter();
        if (character.objectId === this.playerId) {
            EventBus.emitEvent({
                type: 'world.item_picked_up',
                channel: 'world',
                data: {
                    objectId: this.objectId,
                    pickedByObjectId: this.playerId
                },
                timestamp: new Date().toISOString()
            });
        }

        return this;
    }
}
