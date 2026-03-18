# Руководство по рефакторингу

## Обзор новой архитектуры

Проект мигрирует на Clean Architecture с четким разделением слоев:

```
Presentation (API/UI) → Application (Use Cases) → Domain (Entities) → Infrastructure (Adapters)
```

## Режимы работы

### 1. LEGACY (по умолчанию)
- Только старая архитектура
- `GameStateStore` работает как раньше
- Нет зависимостей от нового кода

### 2. ADAPTER (рекомендуется для перехода)
- Старый API (`GameStateStore`) проксируется в новую архитектуру
- Данные синхронизируются между системами
- Позволяет постепенную миграцию

### 3. NEW (целевой)
- Только новая архитектура
- Прямое использование репозиториев и EventBus
- Полностью type-safe

## Активация новой архитектуры

```typescript
import { architectureBridge } from './infrastructure/integration';

// В index.ts или при старте приложения
architectureBridge.initialize('ADAPTER');

// Теперь GameStateStore использует новую архитектуру под капотом
const character = GameStateStore.getCharacter(); // Работает через адаптер
```

## Миграция пакетов

### Старый подход (до рефакторинга)

```typescript
// game/packets/incoming/UserInfoPacket.ts
export class UserInfoPacket {
    decode(reader: PacketReader): void {
        this.name = reader.readStringUTF16();
        this.level = reader.readInt32LE();
        // ... декодирование

        // Прямое обращение к GameStateStore
        GameStateStore.updateCharacter({
            name: this.name,
            level: this.level,
        });

        // Прямой вызов EventBus
        EventBus.emitEvent({
            type: 'character.entered_game',
            channel: 'character',
            data: { name: this.name },
        });
    }
}
```

**Проблемы:**
- Нарушение SRP (пакет знает о хранилище и событиях)
- Жесткая связность (нельзя тестировать изолированно)
- Нарушение OCP (добавление новой логики = изменение пакета)

### Новый подход (после рефакторинга)

```typescript
// infrastructure/protocol/game/handlers/UserInfoHandler.ts
export class UserInfoHandler extends BasePacketHandlerStrategy {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0x04, eventBus); // Opcode 0x04
    }

    protected canHandleInState(state: string): boolean {
        return state === 'WAIT_USER_INFO' || state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        // 1. Декодируем пакет
        const data = this.decodeUserInfo(reader);
        
        // 2. Обновляем доменную модель
        this.characterRepo.update((char) => {
            char.updatePosition(data.position, 0, true);
            char.updateHp(data.hp, data.maxHp);
            return char;
        });

        // 3. Публикуем событие (доменное, не инфраструктурное)
        this.eventBus.publish(new CharacterEnteredGameEvent({
            objectId: data.objectId,
            name: data.name,
            // ...
        }));
    }
}
```

**Преимущества:**
- Чистое разделение ответственности
- Инжекция зависимостей (тестируемость)
- Расширяемость (новый обработчик = новый класс)

## Пошаговая миграция пакета

### Шаг 1: Создать стратегию обработки

```typescript
// src/infrastructure/protocol/game/handlers/YourPacketHandler.ts
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';

export class YourPacketHandler extends BasePacketHandlerStrategy {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository,
        private worldRepo: IWorldRepository
    ) {
        super(0xXX, eventBus); // Замените на ваш опкод
    }

    protected canHandleInState(state: string): boolean {
        // Определите, в каких состояниях обрабатывать
        return state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        // Декодируйте пакет
        // Обновите репозитории
        // Опубликуйте события
    }
}
```

### Шаг 2: Зарегистрировать в фабрике

```typescript
// В composition.ts или при инициализации
const processor = container.resolve(DI_TOKENS.PacketProcessor).getOrThrow();
const handler = new YourPacketHandler(eventBus, charRepo, worldRepo);
processor.registerHandler(handler);
```

### Шаг 3: Протестировать

```typescript
// tests/new-architecture/handlers/YourPacketHandler.test.ts
describe('YourPacketHandler', () => {
    it('should update character', () => {
        const handler = new YourPacketHandler(mockEventBus, mockRepo);
        // Test implementation
    });
});
```

### Шаг 4: Удалить старый код

После полного тестирования:
- Удалите старый пакет из `game/packets/incoming/`
- Удалите обработку из `GamePacketHandler.ts`

## Использование DI Container

```typescript
import { createContainer, DI_TOKENS } from './config/di';

const container = createContainer();

// Получить сервис
const charRepo = container.resolve(DI_TOKENS.CharacterRepository).getOrThrow();

// Регистрация нового сервиса
container.register(DI_TOKENS.MyService, (c) => new MyService(
    c.resolve(DI_TOKENS.CharacterRepository).getOrThrow()
), true); // singleton
```

## Event Bus

### Публикация событий

```typescript
import { SimpleEventBus } from './infrastructure/event-bus';
import { CharacterEnteredGameEvent } from './domain/events';

const eventBus = new SimpleEventBus();

eventBus.publish(new CharacterEnteredGameEvent({
    objectId: 12345,
    name: 'Player',
    // ...
}));
```

### Подписка на события

```typescript
const subscription = eventBus.subscribe('character.entered_game', (event) => {
    console.log(`Player ${event.payload.name} entered game`);
});

// Отписка
subscription.unsubscribe();
```

## Репозитории

### Character Repository

```typescript
const charRepo = container.resolve(DI_TOKENS.CharacterRepository).getOrThrow();

// Сохранить
charRepo.save(character);

// Получить
const char = charRepo.get();

// Обновить
charRepo.update((c) => {
    c.updateHp(100, 1000);
    return c;
});

// Собрать события
const events = charRepo.collectEvents();
```

### World Repository

```typescript
const worldRepo = container.resolve(DI_TOKENS.WorldRepository).getOrThrow();

// Добавить NPC
const { npc, event } = Npc.spawn({...});
worldRepo.saveNpc(npc);

// Найти рядом
const nearby = worldRepo.getNearbyNpcs(
    playerPosition, 
    600, // radius
    { attackable: true, alive: true }
);
```

## Value Objects

```typescript
import { Position, Vitals, Experience } from './domain/value-objects';

// Position
const pos = Position.at(100, 200, -300);
const distance = pos.distanceTo(otherPos);
const inRange = pos.isInRange(targetPos, 600);

// Vitals
const hp = Vitals.create({ current: 50, max: 100 }).getOrThrow();
const percent = hp.percent; // 50
const dead = hp.isEmpty; // false

// Experience
const exp = Experience.create(1, 34, 0);
const canLevelUp = exp.canLevelUp; // false
const progress = exp.levelProgressPercent; // 50
```

## Result Type (обработка ошибок)

```typescript
import { Result } from './shared/result';

function divide(a: number, b: number): Result<number, Error> {
    if (b === 0) {
        return Result.err(new Error('Division by zero'));
    }
    return Result.ok(a / b);
}

// Использование
const result = divide(10, 2);

if (result.isOk()) {
    console.log(result.getOrThrow()); // 5
} else {
    console.error(result.error?.message);
}

// Или с использованием match
result.match(
    (value) => console.log(value),
    (error) => console.error(error)
);
```

## Тестирование

### Unit тесты

```bash
npm test -- tests/new-architecture/domain/ValueObjects.test.ts
npm test -- tests/new-architecture/infrastructure/Repository.test.ts
```

### Все тесты

```bash
npm test
```

## Чеклист миграции

- [ ] Создать стратегию обработки для пакета
- [ ] Написать unit тесты
- [ ] Зарегистрировать в DI контейнере
- [ ] Протестировать в ADAPTER режиме
- [ ] Удалить старый код
- [ ] Обновить документацию

## Полезные ссылки

- `src/domain/` - Доменные сущности и события
- `src/application/ports/` - Интерфейсы (порты)
- `src/infrastructure/` - Реализации (адаптеры)
- `src/config/di/` - DI контейнер
- `tests/new-architecture/` - Тесты новой архитектуры
