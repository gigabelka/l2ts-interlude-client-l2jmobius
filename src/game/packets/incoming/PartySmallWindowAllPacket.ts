import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore, PartyMember } from '../../../core/GameStateStore';

/**
 * PartySmallWindowAll (0x4E) - Full party member list
 * 
 * Structure (Interlude):
 * - partyLeaderObjectId (int32)
 * - memberCount (int32)
 * - For each member:
 *   - objectId (int32)
 *   - name (string)
 *   - cp (int32)
 *   - maxCp (int32)
 *   - hp (int32)
 *   - maxHp (int32)
 *   - mp (int32)
 *   - maxMp (int32)
 *   - level (int32)
 *   - classId (int32)
 *   - unknown (int32) - race or additional data
 *   - isLeader (int8) - 1 if party leader
 */
export class PartySmallWindowAllPacket implements IncomingGamePacket {
    public partyLeaderObjectId: number = 0;
    public members: PartyMember[] = [];

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x4E
            
            this.partyLeaderObjectId = reader.readInt32LE();
            const memberCount = reader.readInt32LE();
            
            this.members = [];
            
            for (let i = 0; i < memberCount && reader.remaining() >= 30; i++) {
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
                const unknown = reader.readInt32LE(); // race or additional data
                const isLeader = reader.readUInt8() !== 0;

                this.members.push({
                    objectId,
                    name,
                    classId,
                    level,
                    hp: { current: hp, max: maxHp },
                    mp: { current: mp, max: maxMp },
                    cp: { current: cp, max: maxCp },
                    isOnline: true
                });

                // Update party leader info
                if (isLeader) {
                    this.partyLeaderObjectId = objectId;
                }
            }

            // Update GameStateStore
            const character = GameStateStore.getCharacter();
            const isLeader = character.objectId === this.partyLeaderObjectId;
            
            GameStateStore.updateParty({
                inParty: this.members.length > 0,
                isLeader,
                members: this.members
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
