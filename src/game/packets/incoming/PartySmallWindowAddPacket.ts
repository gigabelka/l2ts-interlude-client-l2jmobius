import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore, PartyMember } from '../../../core/GameStateStore';

/**
 * PartySmallWindowAdd (0x4F) - New party member added
 * 
 * Structure (Interlude):
 * - objectId (int32) - New member's object ID
 * - name (string)
 * - cp (int32)
 * - maxCp (int32)
 * - hp (int32)
 * - maxHp (int32)
 * - mp (int32)
 * - maxMp (int32)
 * - level (int32)
 * - classId (int32)
 * - unknown (int32)
 * - partyLeaderObjectId (int32)
 */
export class PartySmallWindowAddPacket implements IncomingGamePacket {
    public member: PartyMember | null = null;
    public partyLeaderObjectId: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x4F
            
            const objectId = reader.readInt32LE();
            const name = reader.readStringUTF16();
            const cp = reader.readInt32LE();
            const maxCp = reader.readInt32LE();
            const hp = reader.readInt32LE();
            const maxHp = reader.readInt32LE();
            const mp = reader.readInt32LE();
            const maxMp = reader.readInt32LE();
            const level = reader.readInt32LE();
            const classId = reader.readInt32LE();
            const unknown = reader.readInt32LE();
            this.partyLeaderObjectId = reader.readInt32LE();

            this.member = {
                objectId,
                name,
                classId,
                level,
                hp: { current: hp, max: maxHp },
                mp: { current: mp, max: maxMp },
                cp: { current: cp, max: maxCp },
                isOnline: true
            };

            // Update GameStateStore - add member to existing party
            const currentParty = GameStateStore.getParty();
            const character = GameStateStore.getCharacter();
            const isLeader = character.objectId === this.partyLeaderObjectId;
            
            // Check if member already exists
            const existingIndex = currentParty.members.findIndex(m => m.objectId === objectId);
            let updatedMembers: PartyMember[];
            
            if (existingIndex >= 0) {
                // Update existing member
                updatedMembers = [...currentParty.members];
                updatedMembers[existingIndex] = this.member;
            } else {
                // Add new member
                updatedMembers = [...currentParty.members, this.member];
            }

            GameStateStore.updateParty({
                inParty: updatedMembers.length > 0,
                isLeader,
                members: updatedMembers
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
