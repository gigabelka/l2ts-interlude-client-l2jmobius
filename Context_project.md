# Сводка по репозиторию L2 Headless Client

> Дата: 2026-03-20 (обновлено: WsApiServer в `src/ws/`, исправлены импорты WebSocket)
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
├── api/              # REST + WebSocket API (shared mode с HTTP)
│   └── ws/           # WsServerNew - WebSocket через IEventBus
├── ws/               # Standalone WebSocket API сервер (WsApiServer)
├── network/          # TCP Connection с L2 framing
├── game/             # GameClient, GameClientState, GameState, outgoing packets
│   ├── entities/     # TypeScript интерфейсы для API (types.ts)
│   └── dictionaries/ # Словари имен (classNames, npcNames, itemNames)
└── config/di/        # DI Container
```

### 2. Game Entity Types (`src/game/entities/types.ts`)

TypeScript интерфейсы для API и WebSocket ответов ("плоские" данные из пакетов):

| Интерфейс | Источник | Описание |
|-----------|----------|----------|
| `CharacterMe` | UserInfo (0x04) | Мой персонаж: статы, позиция, HP/MP/CP, скорости, клан/альянс |
| `Player` | CharInfo (0x03) | Другие игроки: позиция, экипировка, расстояние до меня |
| `Npc` | NpcInfo (0x16) | NPC/мобы: npcId, attackable, скорости, расстояние |
| `DroppedItem` | SpawnItem/DropItem | Предмет на земле: itemId, count, позиция, расстояние |
| `InventoryItem` | ItemList (0x1B) | Предмет в инвентаре: equipped, enchantLevel, bodyPart |
| `Skill` | SkillList (0x58) | Скилл: passive/toggle флаги, cooldownRemaining |
| `PartyMember` | Party* пакеты | Член группы: HP/MP/CP, уровень, класс |
| `ChatMessage` | Say2 (0x4A) | Сообщение чата: тип, отправитель, текст |
| `ActiveEffect` | AbnormalStatusUpdate | Бафф/дебафф: skillId, оставшиеся секунды |
| `TargetInfo` | TargetSelected | Цель: тип (player/npc/item), HP |
| `WsEvent<T>` | WebSocket | Обёртка WS-сообщения: type, ts, data |

**Вспомогательные типы:**
- `ClanInfo`, `AllyInfo` — информация о клане/альянсе
- `Equipment` — Record<slot, EquipmentItem>
- `ChatMessageType` — 'all' | 'shout' | 'whisper' | 'party' | 'clan' | 'trade' | 'hero' | 'system'
- `TargetType` — 'player' | 'npc' | 'item'

### 3. GameState (`src/game/GameState.ts`)

Единое in-memory хранилище всего, что видит персонаж:

| Свойство | Тип | Описание |
|----------|-----|----------|
| `me` | `CharacterMe \| null` | Мой персонаж |
| `players` | `Map<number, Player>` | Другие игроки (objectId → Player) |
| `npcs` | `Map<number, Npc>` | NPC/мобы в мире |
| `items` | `Map<number, DroppedItem>` | Предметы на земле |
| `inventory` | `Map<number, InventoryItem>` | Инвентарь персонажа |
| `skills` | `Skill[]` | Скиллы персонажа |
| `party` | `PartyMember[]` | Члены группы |
| `chat` | `ChatMessage[]` | История чата (50 последних) |
| `effects` | `ActiveEffect[]` | Активные баффы/дебаффы |
| `target` | `TargetInfo \| null` | Текущая цель |
| `serverTime` | `number` | Серверное время |

**Методы:**
- `update(eventName, data)` — эмитит событие `ws:event` для WebSocket
- `getSnapshot()` — возвращает полный снимок мира (Maps → Arrays)
- `reset()` — очищает все коллекции (для реконнекта)
- `calcDistance(x, y)` — 2D расстояние от персонажа до точки

### 3a. GameStateUpdater (`src/game/GameStateUpdater.ts`)

Мост между серверными пакетами и GameState. Принимает распарсенные пакеты и обновляет состояние.

| Метод | Описание |
|-------|----------|
| `handlePacket(opcode, data)` | Главный метод обработки пакета |
| `handleUserInfo(data)` | 0x04 - обновление state.me |
| `handleCharInfo(data)` | 0x03 - добавление/обновление state.players |
| `handleNpcInfo(data)` | 0x16 - добавление/обновление state.npcs |
| `handleMoveToLocation(data)` | 0x2E - движение сущности |
| `handleDeleteObject(data)` | 0x08 - удаление объекта |
| `handleStatusUpdate(data)` | 0x0E - обновление HP/MP/CP |
| `handleSpawnItem(data)` | 0x0B - появление предмета |
| `handleDropItem(data)` | 0x0C - выпадение предмета |
| `handleItemList(data)` | 0x1B - полный инвентарь |
| `handleInventoryUpdate(data)` | 0x19 - частичное обновление инвентаря |
| `handleDie(data)` | 0x06 - смерть сущности |
| `handleRevive(data)` | 0x07 - воскрешение сущности |
| `handleTeleportToLocation(data)` | 0x27 - телепорт |
| `handleChangeWaitType(data)` | 0x2F - сидение/стояние |
| `handleAbnormalStatusUpdate(data)` | 0x39 - баффы/дебаффы |
| `handleCreatureSay(data)` | 0x4A - сообщение чата |
| `handleSkillList(data)` | 0x58 - список скиллов |
| `handleMagicSkillUse(data)` | 0x76 - использование скилла |
| `handleMyTargetSelected(data)` | 0xA1 - выбор цели |
| `handleTargetUnselected(data)` | 0xA6 - снятие цели |
| `handleStopMove(data)` | 0x59 - остановка движения |

**WS-события, генерируемые GameStateUpdater:**

| Событие | Описание |
|---------|----------|
| `me.update` | Полное обновление данных персонажа |
| `player.appear` | Новый игрок в зоне видимости |
| `player.update` | Обновление данных игрока |
| `npc.appear` | Новый NPC в зоне видимости |
| `npc.update` | Обновление данных NPC |
| `entity.move` | Движение сущности (с from, to, distanceToMe) |
| `entity.despawn` | Исчезновение сущности |
| `status.update` | Обновление HP/MP/CP |
| `item.spawn` | Появление предмета |
| `item.drop` | Выпадение предмета |
| `inventory.full` | Полный список инвентаря |
| `inventory.update` | Частичное обновление инвентаря |
| `entity.die` | Смерть сущности |
| `entity.revive` | Воскрешение сущности |
| `entity.teleport` | Телепорт сущности |
| `me.sit` / `me.stand` | Смена позы персонажа |
| `effects.update` | Обновление баффов/дебаффов |
| `chat.message` | Новое сообщение чата |
| `skills.full` | Полный список скиллов |
| `combat.skill.use` | Использование скилла |
| `target.select` | Выбор цели |
| `target.unselect` | Снятие выделения цели |
| `entity.stop` | Остановка движения |

### 4. DI Container (`src/config/di/`)

- Кастомная реализация с `Result<T,E>` монадой
- Регистрация сервисов в `composition.ts`
- Токены: `DI_TOKENS.EventBus`, `DI_TOKENS.CharacterRepository`, etc.

### 5. Обработка пакетов (Новая архитектура)

| Компонент | Файл | Описание |
|-----------|------|----------|
| Factory | `GameIncomingPacketFactory.ts` | Регистрация пакетов по opcode |
| Processor | `GamePacketProcessor.ts` | Middleware + Strategy pattern |
| Registry | `PacketRegistry.ts` | Централизованная конфигурация всех пакетов |

### 6. Уже распарсенные пакеты (11 штук)

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

### 7. Domain Events (уже реализованы)

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

### 8. WebSocket Server (`src/api/ws/WsServer.ts`)

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

### 9. WebSocket API Server (`src/ws/WsServer.ts`)

**Класс:** `WsApiServer` — standalone WebSocket сервер для трансляции GameState

**Конфигурация (`WsConfig`):**
| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `port` | number | 3000 | Порт сервера |
| `authEnabled` | boolean | false | Включена ли авторизация |
| `authTokens` | string[] | [] | Список валидных токенов |
| `maxClients` | number | 10 | Максимальное количество клиентов |

**Каналы подписки:** `*`, `me`, `players`, `npcs`, `items`, `inventory`, `combat`, `chat`, `party`, `effects`, `target`, `movement`, `skills`

**Маппинг event.type → канал:**
| Префикс события | Канал |
|-----------------|-------|
| `player.*` | `players` |
| `npc.*` | `npcs` |
| `item.*` | `items` |
| `entity.*` | `movement` |
| `status.*` | `target` |
| `me.*` | `me` |
| `chat.*` | `chat` |
| `combat.*` | `combat` |
| `party.*` | `party` |
| `effects.*` | `effects` |
| `target.*` | `target` |
| `inventory.*` | `inventory` |
| `skills.*` | `skills` |

**Команды клиента → сервер:**
| Команда | Ответ | Описание |
|---------|-------|----------|
| `subscribe` | `subscribed` | Подписка на каналы |
| `unsubscribe` | `unsubscribed` | Отписка от каналов |
| `get.snapshot` | `snapshot` | Полный снапшот состояния |
| `get.me` | `me` | Данные персонажа |
| `get.players` | `players` | Список игроков |
| `get.npcs` | `npcs` | Список NPC |
| `get.inventory` | `inventory` | Инвентарь |
| `get.party` | `party` | Члены группы |
| `get.effects` | `effects` | Баффы/дебаффы |
| `get.skills` | `skills` | Скиллы |
| `ping` | `pong` | Проверка связи |

**События сервера → клиент:**
- `welcome` — при подключении (version, clientsOnline)
- `snapshot` — автоматически после подключения
- `subscribed` / `unsubscribed` — подтверждение подписки
- `pong` — ответ на ping
- Любые события из GameState (`ws:event`)

**Методы:**
- `getStats()` → `{ clientsOnline: number, uptime: number }`
- `stop()` — остановка сервера

### 10. In-Memory Repositories

| Repository | Файл | Хранит |
|------------|------|--------|
| `InMemoryCharacterRepository` | `src/infrastructure/persistence/InMemoryCharacterRepository.ts` | Текущий персонаж |
| `InMemoryWorldRepository` | `src/infrastructure/persistence/InMemoryWorldRepository.ts` | NPC и дроп в мире |
| `InMemoryInventoryRepository` | `src/infrastructure/persistence/InMemoryInventoryRepository.ts` | Инвентарь |
| `InMemoryConnectionRepository` | `src/infrastructure/persistence/InMemoryConnectionRepository.ts` | Состояние подключения |

### 11. Словари (Dictionaries)

| Файл | Содержимое | Количество |
|------|------------|------------|
| `src/game/dictionaries/classNames.ts` | Маппинг classId → название класса | 118+ классов (0-118 + Kamael) |
| `src/game/dictionaries/npcNames.ts` | Маппинг npcId → название NPC | 200+ частых NPC |
| `src/game/dictionaries/itemNames.ts` | Маппинг itemId → название предмета | 150+ частых предметов |

**Хелпер-функции:**
- `getClassName(id: number): string` — возвращает имя или `"Unknown Class #id"`
- `getNpcName(id: number): string` — возвращает имя или `"Unknown NPC #id"`
- `getItemName(id: number): string` — возвращает имя или `"Unknown Item #id"`

**Примечание:** Для полноты данных нужно генерировать из серверного датапака L2J_Mobius:
- NPC: `data/stats/npc/*.xml`
- Items: `data/stats/items/*.xml`
- Classes: определены в core классах сервера

### 12. Зависимости (`package.json`)

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

### 3. GameState улучшения

- ✅ Трекинг баффов/дебаффов (свойство `effects`)
- ✅ Текущая цель (свойство `target`)
- ❌ Состояние боя (in combat / not in combat) - только флаг, без автообновления
- ❌ Автоматическая синхронизация `serverTime` с сервером

### 4. WebSocket улучшения

- ✅ Фильтрация событий по подписанным каналам (WsApiServer)
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
├─────────────────────────────────────────────────────────────────────┤
│ 5a. WsApiServer (src/ws/WsServer.ts)                                │
│    - Подписан на GameState событие 'ws:event'                       │
│    - Транслирует события клиентам по каналам подписки               │
│    - Поддерживает команды: get.snapshot, subscribe, и т.д.          │
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
