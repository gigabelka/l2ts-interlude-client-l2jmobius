import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';

/**
 * PartySmallWindowDelete (0x50) - Party member removed
 * 
 * Structure (Interlude):
 * - objectId (int32) - Object ID of member leaving
 * - partyLeaderObjectId (int32) - New party leader (if changed)
 */
export class PartySmallWindowDeletePacket implements IncomingGamePacket {
    public objectId: number = 0;
    public partyLeaderObjectId: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x50
            
            this.objectId = reader.readInt32LE();
            this.partyLeaderObjectId = reader.readInt32LE();

            // Update GameStateStore - remove member from party
            const currentParty = GameStateStore.getParty();
            const character = GameStateStore.getCharacter();
            
            // Check if we are the one being removed
            const isUs = character.objectId === this.objectId;
            
            // Remove member from list
            const updatedMembers = currentParty.members.filter(m => m.objectId !== this.objectId);
            const isLeader = character.objectId === this.partyLeaderObjectId;

            if (isUs) {
                // We left the party - clear it
                GameStateStore.updateParty({
                    inParty: false,
                    isLeader: false,
                    members: []
                });
            } else {
                // Someone else left
                GameStateStore.updateParty({
                    inParty: updatedMembers.length > 0,
                    isLeader,
                    members: updatedMembers
                });
            }

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
