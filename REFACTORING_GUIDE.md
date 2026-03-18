# Руководство по рефакторингу L2 Client

## Обзор

Этот документ описывает архитектуру после рефакторинга с применением принципов **SoC (Separation of Concerns)** и **Event-Driven** подхода.

## Архитектурные изменения

### 1. Структура проекта (до/после)

```
ДО:                          ПОСЛЕ:
src/
├── index.ts (500+ строк)    src/
├── game/                        ├── index.ts (только инициализация)
│   ├── GamePacketHandler.ts     ├── core/
│   └── packets/                 │   ├── event-bus/
│       └── incoming/            │   ├── state/
├── api/                         │   │   ├── CharacterManager.ts
├── core/                        │   │   ├── WorldManager.ts
└── ...                          │   │   └── InventoryManager.ts
                                 │   └── decorators/
                                 │       └── PacketHandler.ts
                                 │
                                 ├── network/
                                 │   └── protocol/
                                 │       └── PacketDispatcher.ts
                                 │
                                 ├── packets/
                                 │   ├── incoming/
                                 │   │   ├── base/
                                 │   │   │   └── IncomingPacket.ts
                                 │   │   └── game/
                                 │   │       └── CharInfoPacket.ts
                                 │   └── outgoing/
                                 │
                                 ├── ui/
                                 │   └── Dashboard.ts
                                 └── ...
```

## 2. Packet Dispatcher (вместо switch-case)

### ❌ До (гигантский switch):

```typescript
// GamePacketHandler.ts
export class GamePacketHandler {
    handle(opcode: number, body: Buffer, state?: GameState): IncomingGamePacket | null {
        const reader = new PacketReader(body);
        try {
            switch (opcode) {
                case 0x00:
                case 0x2D:
                    return new CryptInitPacket().decode(reader);
                case 0x04:
                    if (state === GameState.WAIT_CHAR_LIST) {
                        return new CharSelectInfoPacket().decode(reader);
                    } else {
                        return new UserInfoPacket().decode(reader);
                    }
                case 0x03:
                    return new CharInfoPacket().decode(reader);
                // ... ещё 50+ case
                default:
                    return null;
            }
        } catch (error) {
            return null;
        }
    }
}
```

### ✅ После (декларативная регистрация):

```typescript
// index.ts - инициализация
packetDispatcher
    .register(GameOpcode.CRYPT_INIT, CryptInitPacket, {
        condition: (state) => state === GameState.WAIT_CRYPT_INIT
    })
    .register(GameOpcode.CHAR_INFO, CharInfoPacket, {
        condition: (state) => state === GameState.IN_GAME
    })
    .register(GameOpcode.USER_INFO, UserInfoPacket, {
        condition: (state) => state === GameState.WAIT_USER_INFO || state === GameState.IN_GAME,
        priority: 10
    });

// Использование в GameClient.ts
const result = packetDispatcher.dispatch(opcode, body, this.state);
if (result?.success) {
    this.handlePacket(result.packet, opcode);
}
```

### Декораторы (альтернативный подход):

```typescript
@PacketHandler(0x03, GameState.IN_GAME)
export class CharInfoPacket extends IncomingPacket {
    decode(reader: PacketReader, state?: GameState): this {
        // Декодирование...
    }
}
```

## 3. State Management (базовые классы)

### ❌ До (GameStateStore монолит):

```typescript
class GameStateStoreClass {
    private character: Partial<CharacterState> = {};
    private world: WorldState = { npcs: new Map(), ... };
    private inventory: Partial<InventoryState> = {};
    private combat: CombatState = {};
    private party: PartyState = {};
    
    // 400+ строк методов...
}
export const GameStateStore = new GameStateStoreClass();
```

### ✅ После (специализированные менеджеры):

```typescript
// CharacterManager.ts
export class CharacterManager extends StateManager<ICharacterState> {
    private static instance: CharacterManager;
    private playerId: number | null = null;

    initialize(objectId: number, name: string): void {
        this.playerId = objectId;
        this.set(objectId, { id: objectId, name, ...defaultState });
        
        EventBus.emitEvent({
            type: 'character.initialized',
            channel: 'character',
            data: { objectId, name },
            timestamp: new Date().toISOString()
        });
    }

    updateVitals(hp?: HpMpCp, mp?: HpMpCp, cp?: HpMpCp): void {
        // Обновление + автоматическая эмиссия событий
    }
}
export const characterManager = CharacterManager.getInstance();

// WorldManager.ts
export class WorldManager {
    readonly npcs: StateManager<INpcInfo>;
    readonly players: StateManager<IPlayerInfo>;
    readonly items: StateManager<IItemDrop>;
    
    getNearbyNpcs(center: Position, radius: number): INpcInfo[] { ... }
}
export const worldManager = WorldManager.getInstance();
```

## 4. Event-Driven UI

### ❌ До (прямое обновление):

```typescript
// В пакете
GameStateStore.updateCharacter({ hp: { current, max } });

// В UI - polling или прямой вызов
setInterval(() => {
    const char = GameStateStore.getCharacter();
    render(char);
}, 1000);
```

### ✅ После (подписка на события):

```typescript
// Dashboard.ts
export class Dashboard {
    private subscribeToEvents(): void {
        // Автоматически перерисовывается при изменениях
        this.subscribe('character.stats_changed', () => this.markDirty());
        this.subscribe('character.level_up', (event) => this.onLevelUp(event));
        this.subscribe('world.npc_spawned', () => this.markDirty());
        this.subscribe('combat.attack_sent', (event) => this.showCombatLog(event));
    }
    
    private markDirty(): void {
        this.isDirty = true; // Перерисуем при следующем тике
    }
}

// Пакет эмитит события автоматически
export class CharInfoPacket extends IncomingPacket {
    decode(reader: PacketReader): this {
        // ... парсинг ...
        
        // Обновление состояния через менеджер
        worldManager.addPlayer({
            id: this.objectId,
            name: this.name,
            // ...
        });
        
        // Событие эмитится автоматически в StateManager!
    }
}
```

## 5. Типизация

### Строгая типизация событий:

```typescript
// core/EventBus.ts
export interface CharacterStatsChangedEvent extends BaseEvent {
    type: 'character.stats_changed';
    channel: 'character';
    data: {
        hp?: { current: number; max: number; delta?: number };
        mp?: { current: number; max: number; delta?: number };
        cp?: { current: number; max: number; delta?: number };
    };
}

export type GameEvent = 
    | CharacterStatsChangedEvent
    | CharacterLevelUpEvent
    | WorldNpcSpawnedEvent
    | CombatAttackSentEvent
    | ...;

// Type-safe подписка
EventBus.onEvent('character.stats_changed', (event) => {
    // event.data.hp строго типизирован!
    console.log(event.data.hp?.current);
});
```

## 6. Миграция существующего кода

### Шаг 1: Создать новый пакет

```typescript
// src/packets/incoming/game/MyNewPacket.ts
import { IncomingPacket, PacketHandler } from '../base/IncomingPacket';
import { characterManager, worldManager } from '../../../core/state';

@PacketHandler(0xXX, GameState.IN_GAME)
export class MyNewPacket extends IncomingPacket {
    public someData: number = 0;
    
    decode(reader: PacketReader, state?: GameState): this {
        this.someData = reader.readInt32LE();
        
        // Обновляем состояние через менеджер
        characterManager.updateCharacter({
            // ...
        });
        
        return this;
    }
}
```

### Шаг 2: Зарегистрировать в диспетчере

```typescript
// В index.ts или GameClient.ts
packetDispatcher.register(GameOpcode.MY_NEW_PACKET, MyNewPacket);
```

### Шаг 3: Подписать UI на событие (опционально)

```typescript
// Dashboard автоматически подписан на все изменения через StateManager!
// Но можно добавить специальную обработку:
EventBus.onEvent('character.my_custom_event', (event) => {
    console.log('Custom event:', event.data);
});
```

## 7. Преимущества новой архитектуры

| Аспект | До | После |
|--------|-----|-------|
| **Расширяемость** | Добавление пакета = изменение switch-case | Декларативная регистрация |
| **Тестируемость** | Мок GameStateStore целиком | Тестируем отдельные менеджеры |
| **Типизация** | Частичная | Полная через union types |
| **Отладка** | Логи в разных местах | Middleware в диспетчере |
| **UI** | Polling или прямые вызовы | Reactive через EventBus |
| **SoC** | GameStateStore делает всё | Каждый менеджер отвечает за свою область |

## 8. Полная диаграмма потока данных

```
┌─────────────────────────────────────────────────────────────────┐
│                        Game Server                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ TCP Packet
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     GameClient (Connection)                      │
│  - Получает raw bytes                                           │
│  - Дешифрует через GameCrypt                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Buffer (opcode + body)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PacketDispatcher                               │
│  - Ищет обработчик по opcode                                     │
│  - Проверяет condition(state)                                    │
│  - Выполняет middleware (logging, etc)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ PacketReader
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              IncomingPacket (например, CharInfoPacket)           │
│  - Декодирует бинарные данные                                    │
│  - Создаёт типизированный объект                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Обновление состояния
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   State Managers                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ CharacterMgr │  │  WorldMgr    │  │ InventoryMgr │           │
│  │   .set()     │  │  .addNpc()   │  │  .addItem()  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ EventBus.emitEvent()
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Event Subscribers                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Dashboard  │  │  WebSocket   │  │    Logger    │           │
│  │   (UI)       │  │   (API)      │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Заключение

Новая архитектура обеспечивает:
1. **Модульность** — каждый компонент имеет чёткую ответственность
2. **Тестируемость** — легко мокать и тестировать изолированно
3. **Расширяемость** — добавление новых пакетов не требует изменения существующего кода
4. **Типобезопасность** — полная типизация через TypeScript
5. **Реактивность** — UI автоматически обновляется при изменении данных
