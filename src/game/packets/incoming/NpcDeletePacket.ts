import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';

/**
 * NpcDelete (0x0C) - NPC/Character despawn
 * 
 * Structure:
 * - objectId (int32) - Object ID of the entity being removed
 */
export class NpcDeletePacket implements IncomingGamePacket {
    public objectId: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x0C
            
            this.objectId = reader.readInt32LE();

            // Remove from GameStateStore (works for both NPCs and players)
            GameStateStore.removeNpc(this.objectId);
            GameStateStore.removePlayer(this.objectId);

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
