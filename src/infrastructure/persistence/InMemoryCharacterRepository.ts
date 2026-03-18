/**
 * @fileoverview InMemoryCharacterRepository - in-memory реализация репозитория персонажа
 * @module infrastructure/persistence
 */

import { Result } from '../../shared/result';
import { Character } from '../../domain/entities';
import { ICharacterRepository, CharacterRepositoryError } from '../../domain/repositories';

import type { DomainEvent } from '../../domain/events';

/**
 * Результат операции с персонажем с событиями
 */
export interface CharacterOperationResult {
    character: Character | null;
    events: DomainEvent[];
}

/**
 * In-memory реализация репозитория персонажа
 * Thread-safe (если использовать в single-threaded Node.js)
 */
export class InMemoryCharacterRepository implements ICharacterRepository {
    private character: Character | null = null;

    get(): Character | null {
        return this.character ? this.cloneCharacter(this.character) : null;
    }

    getOrFail(): Result<Character, CharacterRepositoryError> {
        const char = this.get();
        if (!char) {
            return Result.err(CharacterRepositoryError.notInitialized());
        }
        return Result.ok(char);
    }

    save(character: Character): Result<void, CharacterRepositoryError> {
        // Сохраняем копию для иммутабельности
        this.character = this.cloneCharacter(character);
        return Result.ok(undefined);
    }

    update(updater: (char: Character) => Character): Result<void, CharacterRepositoryError> {
        const current = this.get();
        if (!current) {
            return Result.err(CharacterRepositoryError.notInitialized());
        }

        const updated = updater(current);
        this.save(updated);

        return Result.ok(undefined);
    }

    exists(): boolean {
        return this.character !== null;
    }

    clear(): void {
        this.character = null;
    }

    reset(): void {
        this.clear();
    }

    /**
     * Получить и очистить незакоммиченные события
     */
    collectEvents(): DomainEvent[] {
        if (!this.character) return [];

        const events = this.character.getUncommittedEvents();
        this.character.clearUncommittedEvents();
        return events;
    }

    /**
     * Клонировать персонажа для иммутабельности
     */
    private cloneCharacter(character: Character): Character {
        return character.clone();
    }
}

/**
 * Singleton instance для convenience
 */
export const characterRepository = new InMemoryCharacterRepository();
