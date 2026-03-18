import type { ISkill } from '../../models/ISkill';

/**
 * Интерфейс состояния игры для типизации обработчиков
 */
export interface IGameState {
    player: {
        skills: ISkill[];
    };
    
    /**
     * Эмитит событие обновления скиллов
     */
    emit(eventName: 'skills:updated', skills: ISkill[]): void;
    
    /**
     * Подписывается на событие обновления скиллов
     */
    on(eventName: 'skills:updated', handler: (skills: ISkill[]) => void): void;
}
