# Сводка по репозиторию L2 Headless Client

> Дата: 2026-03-20 (обновлено: Тесты для GameState, GameStateUpdater, WsServer в src/__tests__/)
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
├── ws/               # Standalone WebSocket API сервер + HTTP endpoints
│   ├── WsServer.ts   # WsApiServer - WebSocket + shared HTTP server
│   ├── HttpEndpoints.ts  # HTTP GET endpoints для снимков GameState
│   └── auth.ts       # Аутентификация (timing-safe token validation)
├── network/          # TCP Connection с L2 framing
├── game/             # GameClient, GameClientState, GameState, GameStateUpdater
│   ├── entities/     # TypeScript интерфейсы для API (types.ts)
│   └── dictionaries/ # Словари имен (classNames, npcNames, itemNames)
└── config/di/        # DI Container
```

### 0. WebSocket API Интеграция (Новое)

**Статус:** ✅ Интегрировано в точку входа

**Архитектура интеграции:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ src/index.ts                                                                 │
│   - Подписка на CharacterEnteredGameEvent                                    │
│   - Вызов initWsApiServer() после входа в игру                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ src/config/di/composition.ts                                                 │
│   - GameState: singleton хранилище состояния                                 │
│   - GameStateUpdater: middleware в GamePacketProcessor                       │
│   - WsApiServer: lazy-инициализация                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ GamePacketProcessor middleware                                               │
│   - Вызывает updater.handlePacket(opcode, data) после обработки пакета      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Конфигурация WebSocket API (src/config.ts):**
```typescript
export const WS_CONFIG = {
    enabled: true,           // WS_ENABLED env
    port: 3001,              // WS_PORT env (default 3001)
    authEnabled: false,      // WS_AUTH_ENABLED env
    authTokens: [],          // WS_AUTH_TOKENS env (comma-separated)
    maxClients: 10,          // WS_MAX_CLIENTS env
    batchInterval: 50,       // WS_BATCH_INTERVAL env (ms, 0 = отключено)
    moveThrottleMs: 100,     // WS_MOVE_THROTTLE_MS env (ms)
};
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

| Метод | Описание | Статус |
|-------|----------|--------|
| `handlePacket(opcode, data)` | Главный метод обработки пакета | ✅ |
| `handleUserInfo(data)` | 0x04 - обновление state.me | ✅ |
| `handleCharInfo(data)` | 0x03 - добавление/обновление state.players | ✅ |
| `handleNpcInfo(data)` | 0x16 - добавление/обновление state.npcs | ✅ |
| `handleMoveToLocation(data)` | 0x2E - движение сущности | ✅ |
| `handleDeleteObject(data)` | 0x08 - удаление объекта | ✅ **Реализован** |
| `handleStatusUpdate(data)` | 0x0E - обновление HP/MP/CP | ✅ |
| `handleSpawnItem(data)` | 0x0B - появление предмета | ✅ |
| `handleDropItem(data)` | 0x0C - выпадение предмета | ✅ |
| `handleItemList(data)` | 0x1B - полный инвентарь | ✅ |
| `handleInventoryUpdate(data)` | 0x19 - частичное обновление инвентаря | ✅ |
| `handleDie(data)` | 0x06 - смерть сущности | ✅ **Реализован** |
| `handleRevive(data)` | 0x07 - воскрешение сущности | ✅ **Реализован** |
| `handleTeleportToLocation(data)` | 0x27 - телепорт | ⚠️ Через legacy |
| `handleChangeWaitType(data)` | 0x2F - сидение/стояние | ⚠️ Через legacy |
| `handleAbnormalStatusUpdate(data)` | 0x39 - баффы/дебаффы | ✅ **Реализован** |
| `handleCreatureSay(data)` | 0x4A - сообщение чата | ✅ **Реализован** |
| `handleSkillList(data)` | 0x58 - список скиллов | ✅ |
| `handleMagicSkillUse(data)` | 0x76 - использование скилла | ✅ **Реализован** |
| `handleMyTargetSelected(data)` | 0xA1 - выбор цели | ✅ **Реализован** |
| `handleTargetUnselected(data)` | 0xA6 - снятие цели | ✅ **Реализован** |
| `handleStopMove(data)` | 0x59 - остановка движения | ⚠️ Через legacy |

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

### 6. Уже распарсенные пакеты (19 штук)

| Opcode | Пакет | Описание | Handler | Статус |
|--------|-------|----------|---------|--------|
| 0x04 | UserInfoPacket | Полная инфо о персонаже | UserInfoHandler | ✅ |
| 0x16 | NpcInfoPacket | Информация о NPC | NpcInfoHandler | ✅ |
| 0x03 | CharInfoPacket | Информация о других игроках | CharInfoHandler | ✅ |
| 0x1B | ItemListPacket | Список инвентаря | ItemListHandler | ✅ |
| 0x19 | InventoryUpdatePacket | Частичное обновление инвентаря | InventoryUpdateHandler | ✅ |
| 0x58 | SkillListPacket | Список скиллов | SkillListHandler | ✅ |
| 0x05 | AttackPacket | Атака и урон | AttackHandler | ✅ |
| 0x2E | MoveToLocationPacket | Движение сущностей | MoveToLocationHandler | ✅ |
| 0x0B | SpawnItemPacket | Появление предмета в мире | SpawnItemHandler | ✅ |
| 0x0C | DropItemPacket | Выпадение предмета | DropItemHandler | ✅ |
| 0x0E | StatusUpdatePacket | Обновление HP/MP/CP | StatusUpdateHandler | ✅ |
| **0x08** | **DeleteObjectPacket** | **Удаление объекта** | **DeleteObjectHandler** | **✅ Новый** |
| **0x4A** | **CreatureSayPacket** | **Сообщение в чате** | **CreatureSayHandler** | **✅ Новый** |
| **0x06** | **DiePacket** | **Смерть сущности** | **DieHandler** | **✅ Новый** |
| **0x07** | **RevivePacket** | **Воскрешение сущности** | **ReviveHandler** | **✅ Новый** |
| **0x39** | **AbnormalStatusUpdatePacket** | **Обновление баффов/дебаффов** | **AbnormalStatusUpdateHandler** | **✅ Новый** |
| **0x76** | **MagicSkillUsePacket** | **Использование скилла** | **MagicSkillUseHandler** | **✅ Новый** |
| **0xA1** | **MyTargetSelectedPacket** | **Выбор цели** | **MyTargetSelectedHandler** | **✅ Новый** |
| **0xA6** | **TargetUnselectedPacket** | **Сброс цели** | **TargetUnselectedHandler** | **✅ Новый** |

### 7. Domain Events (уже реализованы)

**CharacterEvents:**
- `CharacterEnteredGameEvent`
- `CharacterStatsChangedEvent` (HP/MP/CP) - добавлены методы `createDied()`, `createRevived()`
- `CharacterPositionChangedEvent`
- `CharacterTargetChangedEvent` - теперь включает `targetHp`
- `CharacterLevelUpEvent`
- `CharacterSkillsUpdatedEvent` - теперь включает `activeEffects`
- `InventoryItemAddedEvent`
- `InventoryItemRemovedEvent`
- `InventoryItemUpdatedEvent`
- `AdenaChangedEvent`

**Character Entity (дополнения):**
- Добавлено поле `isDead: boolean`
- Добавлено поле `activeEffects: ActiveEffect[]`
- Добавлен метод `die()`
- Добавлен метод `revive()`
- Добавлен метод `updateEffects(effects)`

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

**Класс:** `WsApiServer` — standalone WebSocket сервер для трансляции GameState с оптимизациями throttling и batching

**Конфигурация (`WsConfig`):**
| Поле | Тип | По умолчанию | Описание |
|------|-----|--------------|----------|
| `port` | number | 3000 | Порт сервера |
| `authEnabled` | boolean | false | Включена ли авторизация |
| `authTokens` | string[] | [] | Список валидных токенов |
| `maxClients` | number | 10 | Максимальное количество клиентов |
| `batchInterval` | number | 50 | Интервал батчинга событий в мс (0 = отключено) |
| `moveThrottleMs` | number | 100 | Throttling для move событий в мс |

**Оптимизации:**

1. **Throttling для `entity.move`**
   - События движения для каждого `objectId` отправляются не чаще 1 раза в `moveThrottleMs` (по умолчанию 100ms)
   - Пропущенные позиции теряются (последняя актуальна в GameState)
   - Счётчик дропнутых событий доступен в метриках

2. **Batching событий**
   - Если `batchInterval > 0`, события накапливаются и отправляются пачкой:
     ```json
     {
       "type": "batch",
       "ts": 1234567890,
       "events": [
         { "type": "entity.move", "ts": ..., "data": {...} },
         { "type": "status.update", "ts": ..., "data": {...} }
       ]
     }
     ```
   - Если `batchInterval = 0`, события отправляются сразу

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
| `get.stats` | `stats` | Статистика сервера |
| `ping` | `pong` | Проверка связи |

**События сервера → клиент:**
- `welcome` — при подключении (version, clientsOnline)
- `snapshot` — автоматически после подключения
- `subscribed` / `unsubscribed` — подтверждение подписки
- `pong` — ответ на ping
- `batch` — пачка событий (при включенном batching)
- Любые события из GameState (`ws:event`)

**Методы:**
- `getStats()` → `{ clientsOnline, uptime, eventsPerSecond, droppedMoveEvents, totalEventsSent }`
- `stop()` — остановка сервера

**Аутентификация (`src/ws/auth.ts`):**

| Функция | Описание |
|---------|----------|
| `validateToken(token, allowedTokens)` | Проверяет токен через `crypto.timingSafeEqual` для защиты от timing attacks |
| `extractToken(request)` | Извлекает токен из query-параметра `?token=xxx` или заголовка `Authorization: Bearer xxx` |

**Особенности безопасности:**
- Timing-safe сравнение токенов через `crypto.timingSafeEqual`
- Буферы фиксированной длины для сравнения токенов разной длины
- При невалидном токене: `ws.close(4001, "Unauthorized")`
- Логирование неудачных попыток аутентификации (`WsAuth`)
- Проверка `client.authenticated` в `broadcast` и `onMessage`

### 9a. HTTP Endpoints для снимков (`src/ws/HttpEndpoints.ts`)

**Класс:** `HttpEndpoints` — HTTP GET эндпоинты для разового запроса данных (shared порт с WebSocket)

**Архитектура:**
- Использует встроенный `http` модуль Node.js (без express)
- Shared HTTP server с WebSocket (`http.createServer()` → `WebSocketServer({ server })`)
- Работает на том же порту что и WebSocket (по умолчанию 3001)

**Эндпоинты:**

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/v1/snapshot` | GET | Полный снимок GameState (JSON) |
| `/api/v1/me` | GET | Данные моего персонажа |
| `/api/v1/players` | GET | Список видимых игроков |
| `/api/v1/npcs` | GET | Список видимых NPC |
| `/api/v1/inventory` | GET | Инвентарь |
| `/api/v1/chat` | GET | Последние 50 сообщений чата |
| `/api/v1/stats` | GET | Статистика WS-сервера (клиенты, uptime, events/sec) |
| `/api/v1/health` | GET | `{ status: "ok", gameConnected: boolean }` |

**Заголовки ответа:**
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (CORS)
- `Access-Control-Allow-Methods: GET, OPTIONS`

**Аутентификация:**
- Если `WS_AUTH_ENABLED=true` — проверяется Bearer токен из заголовка `Authorization`
- Поддерживается `Authorization: Bearer <token>`

**Примеры использования:**
```bash
# Полный снимок состояния
curl http://localhost:3001/api/v1/snapshot

# Данные персонажа
curl http://localhost:3001/api/v1/me

# Список NPC с авторизацией
curl -H "Authorization: Bearer my-token" http://localhost:3001/api/v1/npcs

# Health check
curl http://localhost:3001/api/v1/health
```

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

## 🧪 Тесты

### Структура тестов (2026-03-20)

Тесты используют **Vitest** (v2.1.4) и находятся в:
- `tests/` - существующие тесты для архитектуры и интеграции
- `src/__tests__/` - новые тесты для GameState, GameStateUpdater, WsServer

### Новые тесты в `src/__tests__/`:

| Файл | Описание | Тесты |
|------|----------|-------|
| `GameState.test.ts` | Тесты для GameState | ✅ Создание пустого состояния<br>✅ getSnapshot() с пустыми коллекциями<br>✅ update() эмитит "ws:event"<br>✅ calcDistance() считает расстояние<br>✅ reset() очищает всё<br>✅ chat обрезается до 50 в снапшоте |
| `GameStateUpdater.test.ts` | Тесты для обработки пакетов | ✅ 0x04 UserInfo → обновляет state.me<br>✅ 0x03 CharInfo → добавляет в state.players<br>✅ 0x16 NpcInfo → добавляет в state.npcs<br>✅ 0x08 DeleteObject → удаляет из коллекций<br>✅ 0x2E MoveToLocation → обновляет координаты<br>✅ 0x4A CreatureSay → добавляет в state.chat<br>✅ Повторный CharInfo → player.update (не appear)<br>✅ Словари classId → className работают |
| `WsServer.test.ts` | Тесты для WebSocket сервера | ✅ Сервер стартует и принимает соединения<br>✅ При подключении: welcome + snapshot<br>✅ Запрос get.me возвращает данные me<br>✅ Subscribe на ["chat"] → только chat.message<br>✅ Ping → Pong |

### Запуск тестов:

```bash
npm test              # Все тесты
npm test -- src/__tests__   # Только новые тесты
npm run test:watch    # Режим наблюдения
npm run test:coverage # С покрытием
```

### Конфигурация Vitest (`vitest.config.ts`):
- Environment: `node`
- Setup files: `tests/setup.ts`
- Include: `tests/**/*.test.ts`, `src/__tests__/**/*.test.ts`
- Coverage: text, json, html репортеры

---

## ❌ Чего НЕ ХВАТАЕТ (что нужно добавить)

### 1. Важные пакеты для парсинга (✅ Обновлено 2026-03-20)

| Opcode | Пакет | Приоритет | Описание | Статус |
|--------|-------|-----------|----------|--------|
| 0x08 | DeleteObject | 🔴 Высокий | Удаление объекта (деспавн) | ✅ **Реализован** |
| 0x4A | CreatureSay | 🔴 Высокий | Чат сообщения | ✅ **Реализован** |
| 0x06 | Die | 🔴 Высокий | Смерть персонажа/NPC | ✅ **Реализован** |
| 0x07 | Revive | 🔴 Высокий | Воскрешение | ✅ **Реализован** |
| 0x39 | AbnormalStatusUpdate | 🔴 Высокий | Баффы/дебаффы | ✅ **Реализован** |
| 0x76 | MagicSkillUse | 🔴 Высокий | Использование скилла | ✅ **Реализован** |
| 0xA1 | MyTargetSelected | 🔴 Высокий | Выбор цели | ✅ **Реализован** |
| 0xA6 | TargetUnselected | 🔴 Высокий | Сброс цели | ✅ **Реализован** |
| 0x21 | GetItem | 🟡 Средний | Предмет подобран | ❌ Нет |
| 0x62 | SystemMessage | 🟡 Средний | Системные сообщения | ❌ Нет |
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

### 4. WebSocket + HTTP улучшения

- ✅ Фильтрация событий по подписанным каналам (WsApiServer)
- ✅ Throttling для `entity.move` событий (100ms на объект)
- ✅ Batching событий (50ms интервал)
- ✅ Метрики сервера (eventsPerSecond, droppedMoveEvents, totalEventsSent)
- ✅ Аутентификация по токену (timing-safe comparison, query/Bearer)
- ✅ HTTP GET эндпоинты для снимков (shared порт с WebSocket)
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
6. **После входа в игру** (`CharacterEnteredGameEvent`) → `initWsApiServer()`

**Интеграция WebSocket API в index.ts:**
```typescript
// Подписка на событие входа в игру для запуска WebSocket API
eventBus.subscribe('CharacterEnteredGameEvent', () => {
    Logger.info('Bootstrap', '🎮 Character entered game - initializing WebSocket API...');
    initWsApiServer();
});
```

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
│    - ⭐ Middleware: GameStateUpdater.handlePacket() [NEW]            │
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
│    - Инициализируется после CharacterEnteredGameEvent               │
└─────────────────────────────────────────────────────────────────────┘
```

**GameStateUpdater Middleware (composition.ts):**
```typescript
processor.use((context, packet, next) => {
    next(); // Сначала обрабатываем пакет
    
    // После обработки обновляем GameState
    if (packet && 'opcode' in packet) {
        const opcode = packet.opcode;
        const data = 'getData' in packet ? packet.getData() : context.rawBody;
        gameStateUpdater.handlePacket(opcode, data);
    }
});
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

# WebSocket API (NEW)
WS_ENABLED=true          # Enable standalone WebSocket API
WS_PORT=3001             # Port for WebSocket server (3000 used by HTTP)
WS_AUTH_ENABLED=false
WS_AUTH_TOKENS=          # Comma-separated tokens
WS_MAX_CLIENTS=10
WS_BATCH_INTERVAL=50     # Event batching interval in ms (0 = disabled)
WS_MOVE_THROTTLE_MS=100  # Move event throttling in ms per object
```

---

## 📚 Ссылки на документацию

| Файл | Описание |
|------|----------|
| `docs/client_server_protocol.md` | Спецификация протокола (SOURCE OF TRUTH) |
| `docs/DOCUMENTATION.md` | Полная API документация (русский) |
| `AGENTS.md` | Информация для AI агентов |
| `CLAUDE.md` | Claude Code guidance |
