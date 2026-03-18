/**
 * @fileoverview ICharacterRepository - порт для хранения данных персонажа
 * @module domain/repositories
 */

import type { Character } from '../entities';
import type { Result } from '../../shared/result';

/**
 * Ошибки репозитория персонажа
 */
export class CharacterRepositoryError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'CharacterRepositoryError';
    }

    static notFound(objectId: number): CharacterRepositoryError {
        return new CharacterRepositoryError(
            `Character with objectId ${objectId} not found`,
            'CHARACTER_NOT_FOUND'
        );
    }

    static alreadyExists(name: string): CharacterRepositoryError {
        return new CharacterRepositoryError(
            `Character with name ${name} already exists`,
            'CHARACTER_ALREADY_EXISTS'
        );
    }

    static notInitialized(): CharacterRepositoryError {
        return new CharacterRepositoryError(
            'Character not initialized',
            'CHARACTER_NOT_INITIALIZED'
        );
    }
}

/**
 * Порт (интерфейс) для репозитория персонажа
 * Реализация зависит от инфраструктуры (in-memory, database, etc.)
 */
export interface ICharacterRepository {
    /**
     * Получить текущего персонажа
     */
    get(): Character | null;

    /**
     * Получить персонажа или ошибку
     */
    getOrFail(): Result<Character, CharacterRepositoryError>;

    /**
     * Сохранить персонажа
     */
    save(character: Character): Result<void, CharacterRepositoryError>;

    /**
     * Обновить персонажа (merge с существующим)
     */
    update(updater: (char: Character) => Character): Result<void, CharacterRepositoryError>;

    /**
     * Проверить, есть ли персонаж
     */
    exists(): boolean;

    /**
     * Удалить персонажа (например, при дисконнекте)
     */
    clear(): void;

    /**
     * Сбросить состояние
     */
    reset(): void;
}
