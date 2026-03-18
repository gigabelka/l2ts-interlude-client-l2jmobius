import type { SkillType } from './SkillType';

/**
 * Интерфейс скилла персонажа
 */
export interface ISkill {
    /** ID скилла из игровой базы данных */
    skillId: number;
    
    /** Уровень скилла (1-85+) */
    level: number;
    
    /** Тип скилла (ACTIVE, PASSIVE, TOGGLE, CHANCE) */
    type: SkillType;
    
    /** Флаг пассивности (true = пассивный, false = активный) */
    passive: boolean;
    
    /** Название скилла (опционально, загружается из базы) */
    name?: string;
    
    /** Время отката скилла в миллисекундах (опционально) */
    reuse?: number;
    
    /** Флаг доступности к использованию (опционально) */
    active?: boolean;
}
