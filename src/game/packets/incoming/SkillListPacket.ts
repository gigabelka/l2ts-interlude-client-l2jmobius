import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';

/**
 * Skill list entry interface
 */
export interface SkillInfo {
    skillId: number;
    level: number;
    isActive: boolean;
    isPassive: boolean;
}

/**
 * SkillList (0x58) - Character skills list
 * 
 * Structure (Interlude):
 * - skillCount (int32) - Number of skills
 * - For each skill:
 *   - isPassive (int32) - 1 if passive, 0 if active
 *   - skillLevel (int32) - Skill level
 *   - skillId (int32) - Skill ID
 */
export class SkillListPacket implements IncomingGamePacket {
    public skills: SkillInfo[] = [];

    decode(reader: PacketReader): this {
        try {
            reader.readUInt8(); // opcode 0x58
            
            const skillCount = reader.readInt32LE();
            
            this.skills = [];
            
            for (let i = 0; i < skillCount && reader.remaining() >= 12; i++) {
                const isPassive = reader.readInt32LE() !== 0;
                const skillLevel = reader.readInt32LE();
                const skillId = reader.readInt32LE();

                this.skills.push({
                    skillId,
                    level: skillLevel,
                    isActive: !isPassive,
                    isPassive
                });
            }

            // Update GameStateStore with skills
            const character = GameStateStore.getCharacter();
            // Store skills as a custom property on character
            (character as any).skills = this.skills;
            GameStateStore.updateCharacter(character);

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
