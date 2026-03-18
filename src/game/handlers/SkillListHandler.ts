import type { PacketReader } from '../../network/PacketReader';
import { SkillType } from '../../models/SkillType';
import type { ISkill } from '../../models/ISkill';
import type { IGameState } from '../types/IGameState';

/**
 * Обработчик пакета SkillList (0x58)
 * Читает список скиллов персонажа из бинарного пакета сервера
 */
export class SkillListHandler {
    /**
     * Обрабатывает входящий пакет со списком скиллов
     * 
     * Структура пакета:
     * - count (int32) - количество скиллов
     * - для каждого скилла:
     *   - skillId (int32)
     *   - level (int32)
     *   - passive (byte) - 0 = активный, 1 = пассивный
     * 
     * @param reader - Читатель пакета
     * @param state - Состояние игры для сохранения скиллов
     */
    public handle(reader: PacketReader, state: IGameState): void {
        const skills: ISkill[] = [];
        
        // Читаем количество скиллов
        const count: number = reader.readInt32LE();
        
        // Цикл чтения скиллов
        for (let index: number = 0; index < count; index++) {
            // Проверяем, достаточно ли данных для чтения очередного скилла
            // skillId (4) + level (4) + passive (1) = 9 байт минимум
            if (reader.remaining() < 9) {
                break;
            }
            
            const skillId: number = reader.readInt32LE();
            const level: number = reader.readInt32LE();
            const passiveByte: number = reader.readUInt8();
            
            const isPassive: boolean = passiveByte === 1;
            
            // Определяем тип скилла на основе флага passive
            const skillType: SkillType = this.determineSkillType(isPassive);
            
            const skill: ISkill = {
                skillId,
                level,
                type: skillType,
                passive: isPassive
            };
            
            skills.push(skill);
        }
        
        // Сохраняем скиллы в состояние игры
        state.player.skills = skills;
        
        // Эмитим событие обновления скиллов
        state.emit('skills:updated', skills);
    }
    
    /**
     * Определяет тип скилла на основе флага пассивности
     * 
     * @param isPassive - Флаг пассивности из пакета
     * @returns Тип скилла из перечисления SkillType
     */
    private determineSkillType(isPassive: boolean): SkillType {
        if (isPassive) {
            return SkillType.PASSIVE;
        }
        
        // Дополнительная логика для определения TOGGLE и CHANCE
        // требует расширенной информации из пакета или базы данных
        // По умолчанию считаем активным
        return SkillType.ACTIVE;
    }
}
