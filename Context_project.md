# Сводка по репозиторию L2 Headless Client

> Дата: 2026-03-20
> Репозиторий: `c:\MyProg\l2J-Mobius-CT-0-Interlude\`
> Назначение: Headless Lineage 2 клиент на TypeScript для сервера L2J_Mobius CT_0_Interlude

---

## ✅ Что УЖЕ ЕСТЬ

### 1. Архитектура (Clean Architecture)

```
src/
├── domain/           # Сущности, Value Objects, Events, Repositories (interfaces)
├── application/      # Ports (interfaces) - IEventBus, IPacketProcessor, etc.
├── infrastructure/   # Реализации - persistence, event-bus, protocol
├── api/              # REST + WebSocket API
├── network/          # TCP Connection с L2 framing
└── game/             # GameClient, GameState, outgoing packets
```

### 2. DI Container (`src/config/di/`)

- Кастомная реализация с `Result<T,E>` монадой
- Регистрация сервисов в `composition.ts`
- Токены: `DI_TOKENS.EventBus`, `DI_TOKENS.CharacterRepository`, etc.

### 3. Обработка пакетов (Новая архитектура)

| Компонент | Файл | Описание |
|-----------|------|----------|
| Factory | `GameIncomingPacketFactory.ts` | Регистрация пакетов по opcode |
| Processor | `GamePacketProcessor.ts` | Middleware + Strategy pattern |
| Registry | `PacketRegistry.ts` | Централизованная конфигурация всех пакетов |

### 4. Уже распарсенные пакеты (11 штук)

| Opcode | Пакет | Описание | Handler |
|--------|-------|----------|---------|
| 0x04 | UserInfoPacket | Полная инфо о персонаже | UserInfoHandler |
| 0x16 | NpcInfoPacket | Информация о NPC | NpcInfoHandler |
| 0x03 | CharInfoPacket | Информация о других игроках | CharInfoHandler |
| 0x1B | ItemListPacket | Список инвентаря | ItemListHandler |
| 0x19 | InventoryUpdatePacket | Частичное обновление инвентаря | InventoryUpdateHandler |
| 0x58 | SkillListPacket | Список скиллов | SkillListHandler |
| 0x05 | AttackPacket | Атака и урон | AttackHandler |
| 0x2E | MoveToLocationPacket | Движение сущностей | MoveToLocationHandler |
| 0x0B | SpawnItemPacket | Появление предмета в мире | SpawnItemHandler |
| 0x0C | DropItemPacket | Выпадение предмета | DropItemHandler |
| 0x0E | StatusUpdatePacket | Обновление HP/MP/CP | StatusUpdateHandler |

### 5. Domain Events (уже реализованы)

**CharacterEvents:**
- `CharacterEnteredGameEvent`
- `CharacterStatsChangedEvent` (HP/MP/CP)
- `CharacterPositionChangedEvent`
- `CharacterTargetChangedEvent`
- `CharacterLevelUpEvent`
- `CharacterSkillsUpdatedEvent`
- `InventoryItemAddedEvent`
- `InventoryItemRemovedEvent`
- `InventoryItemUpdatedEvent`
- `AdenaChangedEvent`

**WorldEvents:**
- `NpcSpawnedEvent`
- `NpcDespawnedEvent`
- `NpcInfoUpdatedEvent`
- `PlayerSpawnedEvent`
- `PlayerDespawnedEvent`
- `ItemDroppedEvent`
- `ItemPickedUpEvent`
- `AttackEvent`
- `SkillUseEvent`
- `TargetDiedEvent`

**ChatEvents:**
- `ChatMessageReceivedEvent`
- `ChatMessageSentEvent`
- `SystemMessageReceivedEvent`

**ConnectionEvents:**
- `ConnectedEvent`
- `DisconnectedEvent`
- `AuthenticationSuccessEvent`
- `AuthenticationFailedEvent`
- `CharacterSelectedEvent`
- `StateChangedEvent`
- `ConnectionPhaseChangedEvent`

### 6. WebSocket Server (`src/api/ws/WsServer.ts`)

- Работает на порту 3000/ws (shared mode с HTTP сервером)
- Подписка на `IEventBus` через `subscribeAll()`
- Поддерживаемые каналы:
  - `system` - системные события
  - `character` - события персонажа
  - `combat` - бой
  - `chat` - чат
  - `world` - мир (NPC, игроки)
  - `movement` - движение
  - `party` - группа
  - `inventory` - инвентарь
- Авторизация по токену (`?token=API_KEY`)
- Ping/pong каждые 30 секунд
- Подписка/отписка через JSON сообщения:
  ```json
  { "type": "subscribe", "channels": ["character", "combat"] }
  ```

### 7. In-Memory Repositories

| Repository | Файл | Хранит |
|------------|------|--------|
| `InMemoryCharacterRepository` | `src/infrastructure/persistence/InMemoryCharacterRepository.ts` | Текущий персонаж |
| `InMemoryWorldRepository` | `src/infrastructure/persistence/InMemoryWorldRepository.ts` | NPC и дроп в мире |
| `InMemoryInventoryRepository` | `src/infrastructure/persistence/InMemoryInventoryRepository.ts` | Инвентарь |
| `InMemoryConnectionRepository` | `src/infrastructure/persistence/InMemoryConnectionRepository.ts` | Состояние подключения |

### 8. Зависимости (`package.json`)

```json
{
  "ws": "^8.19.0",           // WebSocket сервер
  "express": "^5.2.1",        // REST API
  "zod": "^4.3.6",            // Валидация конфига
  "dotenv": "^17.3.1",        // ENV переменные
  "helmet": "^8.1.0",         // HTTP security headers
  "cors": "^2.8.6"            // CORS middleware
}
```

---

## ❌ Чего НЕ ХВАТАЕТ (что нужно добавить)

### 1. Важные пакеты для парсинга

| Opcode | Пакет | Приоритет | Описание | Статус |
|--------|-------|-----------|----------|--------|
| 0x0C | NpcDelete | 🔴 Высокий | Удаление NPC (деспавн) | ❌ Нет |
| 0x21 | GetItem | 🔴 Высокий | Предмет подобран | ❌ Нет |
| 0x4A | Say2 | 🔴 Высокий | Чат сообщения | ❌ Нет |
| 0x62 | SystemMessage | 🔴 Высокий | Системные сообщения | ❌ Нет |
| 0x31 | Die | 🟡 Средний | Смерть персонажа/NPC | ❌ Нет |
| 0x43 | Revive | 🟡 Средний | Воскрешение | ❌ Нет |
| 0x59 | StopMove | 🟡 Средний | Остановка движения | ❌ Нет |
| 0xD3 | NetPingRequest | 🟡 Средний | Keepalive ping | ⚠️ Обрабатывается в GameClient |

### 2. Extended пакеты (0xD0)

- `0xD0 0x08 0x00` - RequestKeyMapping (уже отправляется клиентом)
- Другие extended пакеты не парсятся

### 3. GameState полнота

- ❌ Трекинг баффов/дебаффов
- ❌ Текущая цель (target) в реальном времени
- ❌ Состояние боя (in combat / not in combat) - только флаг, без автообновления

### 4. WebSocket улучшения

- ⚠️ Фильтрация событий по подписанным каналам (есть partial реализация)
- ❌ История событий для новых подключений
- ❌ Rate limiting на WebSocket

---

## 🎯 Точка входа

**Файл:** `src/index.ts`

**Порядок инициализации:**

1. `initLogging()` - настройка уровня логирования
2. DI контейнер создаётся lazy (при первом использовании)
3. `initApiServer()` - запуск Express + WebSocket
4. `LoginClientNew` (если `AUTO_CONNECT_GAME=true`)
5. После успешного логина → `GameClientNew` с зависимостями из DI

**DI Dependencies для GameClient:**
```typescript
{
  eventBus: IEventBus;
  systemEventBus: ISystemEventBus;
  packetProcessor: IPacketProcessor;
  characterRepo: ICharacterRepository;
  worldRepo: IWorldRepository;
  inventoryRepo: IInventoryRepository;
  connectionRepo: IConnectionRepository;
  commandManager: GameCommandManagerClass;
  packetSerializer?: PacketSerializer;
}
```

---

## 📁 Где принимаются пакеты

**Путь пакета от TCP до WebSocket:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Connection.ts                                                    │
│    - TCP поток → сборка L2 пакетов по длине (2 bytes uint16LE header)│
│    - Вызывает onData callbacks                                      │
├─────────────────────────────────────────────────────────────────────┤
│ 2. GameClient.ts:handleRawPacket()                                  │
│    - Расшифровка XOR через GameCrypt.decrypt()                      │
│    - Извлечение opcode (первый байт body)                           │
│    - Логирование hex-dump                                           │
├─────────────────────────────────────────────────────────────────────┤
│ 3. GamePacketProcessor.process()                                    │
│    - Factory создаёт пакет через GameIncomingPacketFactory          │
│    - Выполняются middleware (если есть)                             │
│    - Выполняются handlers через BasePacketHandlerStrategy           │
├─────────────────────────────────────────────────────────────────────┤
│ 4. Handler (например, UserInfoHandler)                              │
│    - Декодирует пакет через PacketReader                            │
│    - Обновляет Repository                                           │
│    - Публикует Events через IEventBus.publish()                     │
├─────────────────────────────────────────────────────────────────────┤
│ 5. WsServer (внутри subscribeToEventBus)                            │
│    - Подписан на все события через subscribeAll()                   │
│    - Фильтрует по каналам клиента                                   │
│    - Отправляет JSON через WebSocket                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ План добавления новых пакетов

Для каждого нового пакета нужно выполнить:

### Шаг 1: Создать Packet DTO
```
src/infrastructure/protocol/game/packets/NewPacket.ts
```

```typescript
export interface NewPacketData {
    // поля пакета
}

export class NewPacket implements IIncomingPacket {
    readonly opcode = 0xXX;
    private data!: NewPacketData;

    decode(reader: IPacketReader): this {
        // чтение полей из reader
        return this;
    }

    getData(): NewPacketData {
        return { ...this.data };
    }
}
```

### Шаг 2: Создать Handler
```
src/infrastructure/protocol/game/handlers/NewHandler.ts
```

```typescript
export class NewHandler extends BasePacketHandlerStrategy<NewPacket> {
    constructor(
        eventBus: IEventBus,
        private worldRepo: IWorldRepository  // нужные репозитории
    ) {
        super(0xXX, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        // декодирование и обработка
        // публикация событий
    }
}
```

### Шаг 3: Зарегистрировать в PacketRegistry
```typescript
// src/infrastructure/protocol/game/PacketRegistry.ts
const PACKET_REGISTRY: PacketConfig[] = [
    // ... existing packets
    {
        opcode: 0xXX,
        packetClass: NewPacket,
        handlerClass: NewHandler,
        repositories: ['world'],  // какие репозитории нужны
        description: 'NewPacket - описание',
    },
];
```

### Шаг 4: Добавить Domain Event (опционально)
```
src/domain/events/NewEvents.ts
```

### Шаг 5: Экспортировать из индексов
- Добавить в `src/infrastructure/protocol/game/packets/index.ts`
- Добавить в `src/infrastructure/protocol/game/handlers/index.ts`

---

## 📋 Формат L2 пакета

```
[2 bytes: packet size (uint16LE, includes header)]
[1 byte: opcode]
[payload...]
```

**Extended пакеты (opcode >= 0xD0):**
```
[2 bytes: packet size]
[0xD0]
[1 byte: extended ID]
[payload...]
```

---

## 🔧 Конфигурация (.env)

```bash
# L2 Server Connection
L2_LOGIN_IP=192.168.0.33
L2_LOGIN_PORT=2106
L2_GAME_PORT=7777
L2_USERNAME=your_login
L2_PASSWORD=your_password
L2_SERVER_ID=2
L2_CHAR_SLOT=0
L2_PROTOCOL=746

# API
API_KEY=             # Empty = no auth required
API_PORT=3000
LOG_LEVEL=ERROR      # DEBUG | INFO | WARN | ERROR | SILENT
AUTO_CONNECT_GAME=true
```

---

## 📚 Ссылки на документацию

| Файл | Описание |
|------|----------|
| `docs/client_server_protocol.md` | Спецификация протокола (SOURCE OF TRUTH) |
| `docs/DOCUMENTATION.md` | Полная API документация (русский) |
| `AGENTS.md` | Информация для AI агентов |
| `CLAUDE.md` | Claude Code guidance |
