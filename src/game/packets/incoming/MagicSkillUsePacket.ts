import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';

/**
 * MagicSkillUse (0x48) - Skill usage
 * 
 * Structure:
 * - casterObjectId (int32)
 * - targetObjectId (int32)
 * - skillId (int32)
 * - skillLevel (int32)
 * ... more fields
 */
export class MagicSkillUsePacket implements IncomingGamePacket {
    public casterObjectId: number = 0;
    public targetObjectId: number = 0;
    public skillId: number = 0;
    public skillLevel: number = 0;

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x48
            
            this.casterObjectId = reader.readInt32LE();
            this.targetObjectId = reader.readInt32LE();
            this.skillId = reader.readInt32LE();
            this.skillLevel = reader.readInt32LE();

            // Emit skill event
            EventBus.emitEvent({
                type: 'combat.skill_used',
                channel: 'combat',
                data: {
                    casterObjectId: this.casterObjectId,
                    targetObjectId: this.targetObjectId,
                    skillId: this.skillId,
                    skillLevel: this.skillLevel,
                    skillName: `Skill ${this.skillId}`,
                    isSuccessful: true
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
