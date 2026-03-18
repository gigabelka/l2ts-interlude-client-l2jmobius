import { PacketReader } from '../../../network/PacketReader';
import { IncomingGamePacket } from './IncomingGamePacket';
import { GameStateStore } from '../../../core/GameStateStore';
import { EventBus } from '../../../core/EventBus';
import { SkillType } from '../../../models/SkillType';
import type { ISkill } from '../../../models/ISkill';
import { SkillDatabase } from '../../../data/SkillDatabase';

/**
 * Skill list entry interface (legacy, for backward compatibility)
 * @deprecated Use ISkill from '../../../models/ISkill'
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
 * Structure (Interlude) - согласно ТЗ:
 * - count (int32) - Number of skills
 * - For each skill:
 *   - skillId (int32) - Skill ID
 *   - level (int32) - Skill level
 *   - passive (byte) - 0 = active, 1 = passive
 */
export class SkillListPacket implements IncomingGamePacket {
    public skills: ISkill[] = [];

    decode(reader: PacketReader): this {
        try {
            // opcode уже прочитан в GamePacketHandler
            
            const count: number = reader.readInt32LE();
            
            this.skills = [];
            
            for (let i = 0; i < count; i++) {
                // Проверяем, достаточно ли данных: skillId(4) + level(4) + passive(1) = 9 байт
                if (reader.remaining() < 9) {
                    break;
                }
                
                const skillId: number = reader.readInt32LE();
                const level: number = reader.readInt32LE();
                const passiveByte: number = reader.readUInt8();
                
                const isPassive: boolean = passiveByte === 1;
                
                // Получаем данные скилла из базы
                const skillData = SkillDatabase.getSkill(skillId);
                const skillName = skillData?.name;
                
                // Определяем тип скилла из базы или из пакета
                let skillType: SkillType;
                if (skillData?.type === 'PASSIVE') {
                    skillType = SkillType.PASSIVE;
                } else if (skillData?.type === 'TOGGLE') {
                    skillType = SkillType.TOGGLE;
                } else if (skillData?.type === 'CHANCE') {
                    skillType = SkillType.CHANCE;
                } else {
                    skillType = isPassive ? SkillType.PASSIVE : SkillType.ACTIVE;
                }
                
                const skill: ISkill = {
                    skillId,
                    level,
                    type: skillType,
                    passive: isPassive,
                    name: skillName
                };
                
                this.skills.push(skill);
            }

            // Update GameStateStore with skills
            GameStateStore.updateSkills(this.skills.map(s => ({
                id: s.skillId,
                level: s.level,
                isPassive: s.passive,
                name: s.name
            })));

            // Emit event to EventBus for real-time updates
            EventBus.emitEvent({
                type: 'character.skills_updated',
                channel: 'character',
                data: {
                    skills: this.skills.map(s => ({
                        skillId: s.skillId,
                        level: s.level,
                        type: s.type,
                        passive: s.passive,
                        name: s.name
                    })),
                    totalCount: this.skills.length,
                    activeCount: this.skills.filter(s => !s.passive).length,
                    passiveCount: this.skills.filter(s => s.passive).length
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            // Ignore decode errors
        }

        return this;
    }
}
