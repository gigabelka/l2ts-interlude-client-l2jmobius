# Аудит пайплайна пакетов от Game Server к WebSocket API

## Дата аудита: 2026-03-21

---

## 1. Архитектура пайплайна

### 1.1 Поток пакетов от Game Server

```
Game Server (opcodes) 
    |
    | TCP
    v
Connection (TCP+L2 framing)
    |
    v
GamePacketProcessor (Factory+Strategy)
    |
    +---> Handlers (19 пакетов) ---> IEventBus ---> WsServerNew (port 3000)
    |
    +---> GameStateUpdater (middleware) ---> GameState
                                                |
                                                v
                                        WsApiServer (port 3001)
```

### 1.2 Механизмы подписки

| WS Сервер | Источник событий | Механизм подписки | Каналы |
|-----------|------------------|-------------------|--------|
| **WsApiServer** (3001) | GameState | state.on(`"ws:event"`, ...) | `*`, `me`, `players`, `npcs`, `items`, `inventory`, `combat`, `chat`, `party`, `effects`, `target`, `movement`, `skills` |
| **WsServerNew** (3000) | IEventBus | eventBus.subscribeAll(...) | `system`, `character`, `combat`, `chat`, `world`, `movement`, `party`, `inventory` |

---

## 2. Таблица сравнения пакетов и проброса в WS

### 2.1 Зарегистрированные пакеты в PacketRegistry

| Opcode | Название пакета | Handler | GameStateUpdater | WS Event (GameState) | WS Event (EventBus) | Пробрасывается |
|--------|-----------------|---------|------------------|----------------------|---------------------|----------------|
| 0x04 | UserInfo | Да | Да | `me.update` | `character.entered_game`, `character.position_changed` | Да |
| 0x16 | NpcInfo | Да | Да | `npc.appear`, `npc.update` | `world.npc_spawned`, `world.npc_updated` | Да |
| 0x03 | CharInfo | Да | Да | `player.appear`, `player.update` | `world.player_spawned` | Да |
| 0x1B | ItemList | Да | Да | `inventory.full` | `inventory.item_added`, `inventory.adena_changed` | Да |
| 0x19 | InventoryUpdate | Да | Да | `inventory.update` | `inventory.item_added`, `inventory.item_removed`, `inventory.item_updated`, `inventory.adena_changed` | Да |
| 0x58 | SkillList | Да | Да | `skills.full` | `character.skills_updated` | Да |
| 0x05 | Attack | Да | НЕТ | НЕТ | `combat.attack` | Частично (только EventBus) |
| 0x2E | MoveToLocation | Да | Да | `entity.move` | `character.position_changed`, `world.npc_updated` | Да |
| 0x0B | SpawnItem | Да | Да | `item.spawn` | НЕТ | Только GameState |
| 0x0C | DropItem | Да | Да | `item.drop` | НЕТ | Только GameState |
| 0x0E | StatusUpdate | Да | Да | `status.update` | `character.stats_changed`, `world.npc_updated` | Да |
| 0x08 | DeleteObject | Да | Да | `entity.despawn` | `world.npc_despawned`, `world.item_picked_up`, `world.player_despawned` | Да |
| 0x4A | CreatureSay | Да | Да | `chat.message` | `chat.message_received` | Да |
| 0x06 | Die | Да | Да | `entity.die` | `character.stats_changed`, `combat.target_died` | Да |
| 0x07 | Revive | Да | Да | `entity.revive` | `character.stats_changed`, `world.npc_updated` | Да |
| 0x39 | AbnormalStatusUpdate | Да | Да | `effects.update` | `character.skills_updated` | Да |
| 0x76 | MagicSkillUse | Да | Да | `combat.skill.use` | `combat.skill_use`, `world.npc_updated` | Да |
| 0xA1 | MyTargetSelected | Да | Да | `target.select` | `character.target_changed` | Да |
| 0xA6 | TargetUnselected | Да | Да | `target.unselect` | `character.target_changed` | Да |

### 2.2 Пакеты в GameStateUpdater без соответствующих Handlers

| Opcode | Название | Handler | GameStateUpdater | WS Event | Статус |
|--------|----------|---------|------------------|----------|--------|
| 0x27 | TeleportToLocation | НЕТ | Да | `entity.teleport` | Потеря |
| 0x2F | ChangeWaitType | НЕТ | Да | `me.sit`, `me.stand` | Потеря |
| 0x59 | StopMove | НЕТ | Да | `entity.stop` | Потеря |

---

## 3. Найденные проблемы

### 3.1 CRITICAL: Пакеты без Handlers (полностью теряются)

**Проблема:** Пакеты 0x27, 0x2F, 0x59 обрабатываются в GameStateUpdater, но НЕТ Handler
**Файл:** `src/game/GameStateUpdater.ts` (строки 203, 740, 911)
**Влияние:** 
- События эмитятся в GameState, но данные не сохраняются в доменных репозиториях
- Рассинхронизация состояния между GameState и IEventBus
- WsServerNew (порт 3000) не получает эти события

### 3.2 CRITICAL: Attack пакет (0x05) не обновляет GameState

**Проблема:** Handler публикует `combat.attack` в EventBus, но GameStateUpdater НЕ обрабатывает opcode 0x05
**Файл:** `src/infrastructure/protocol/game/handlers/AttackHandler.ts:28`
**Влияние:** Клиенты WsApiServer (порт 3001) не получают события об атаках

### 3.3 CRITICAL: SpawnItem и DropItem не публикуются в EventBus

**Проблема:** Handlers не публикуют события в EventBus, только GameStateUpdater эмитит события
**Файлы:** `SpawnItemHandler.ts`, `DropItemHandler.ts`
**Влияние:** Клиенты WsServerNew (порт 3000) не получают события о предметах

### 3.4 HIGH: Race condition - WS сервер создается после входа в игру

**Проблема:** WsApiServer создается ТОЛЬКО после события `CharacterEnteredGameEvent`
**Файл:** `src/index.ts:99-127`
**Влияние:** Пакеты, пришедшие ДО входа в игру (CharSelectInfo, CryptInit), теряются для WS

### 3.5 HIGH: Нет буферизации событий для отключенных WS клиентов

**Проблема:** Если WS клиент отключился, события НЕ сохраняются
**Файл:** `src/ws/WsServer.ts:472-494`
**Влияние:** Клиенты пропускают события во время отключения

### 3.6 MEDIUM: Дублирование событий

**Проблема:** Некоторые события генерируются и в Handler, и в GameStateUpdater
**Файл:** `src/config/di/composition.ts:205-220`
**Влияние:** Возможно дублирование событий в зависимости от канала

### 3.7 MEDIUM: Разные каналы в WS серверах

**Проблема:** WsApiServer и WsServerNew используют разные каналы подписки
**Файлы:** `src/ws/WsServer.ts:391-405`, `src/api/ws/WsServer.ts:259`
**Влияние:** Клиенты должны знать, к какому серверу подключаются

### 3.8 MEDIUM: Exception handling может глотать ошибки

**Проблема:** При исключении в handler пакет считается обработанным
**Файл:** `src/infrastructure/protocol/game/GamePacketProcessor.ts:118-136`
**Влияние:** Неконсистентное состояние при ошибках декодирования

### 3.9 MEDIUM: Не все WS события маппятся на каналы

**Проблема:** События `me.sit`, `entity.teleport`, `target.select` не имеют явного маппинга
**Файл:** `src/ws/WsServer.ts:573-602`
**Влияние:** Клиенты со специфичной подпиской не получают эти события

---

## 4. Рекомендации по исправлению

### 4.1 Добавить недостающие Handlers (CRITICAL)

Создать и зарегистрировать:
- `TeleportToLocationHandler.ts` для 0x27
- `ChangeWaitTypeHandler.ts` для 0x2F
- `StopMoveHandler.ts` для 0x59

### 4.2 Добавить обработку Attack в GameStateUpdater (CRITICAL)

Добавить case `Opcodes.ATTACK` в `GameStateUpdater.handlePacket()`

### 4.3 Добавить EventBus события для SpawnItem/DropItem (CRITICAL)

Добавить публикацию `ItemDroppedEvent` в соответствующие Handlers

### 4.4 Реализовать буферизацию событий (HIGH)

Добавить в GameState кольцевой буфер последних N событий для новых подключений

### 4.5 Инициализировать WsApiServer раньше (HIGH)

- Перенести инициализацию в `main()` перед `gameClient.start()`
- Добавить флаг ready и буферизировать события до входа в игру

### 4.6 Унифицировать каналы подписки (MEDIUM)

Создать единый enum WsChannel для обоих WS серверов

### 4.7 Улучшить обработку ошибок (MEDIUM)

При исключении в handler возвращать false и пропускать GameStateUpdater

### 4.8 Добавить недостающий маппинг каналов (MEDIUM)

Добавить маппинг для `me.sit`, `entity.teleport`, `target.select` и др.

---

## 5. Сводка по приоритетам

| Приоритет | Проблема | Влияние |
|-----------|----------|---------|
| P0 (CRITICAL) | Добавить Handlers для 0x27, 0x2F, 0x59 | Рассинхронизация |
| P0 (CRITICAL) | Добавить Attack в GameStateUpdater | Потеря combat событий |
| P0 (CRITICAL) | EventBus для SpawnItem/DropItem | Потеря item событий |
| P1 (HIGH) | Буферизация событий | Потеря истории |
| P1 (HIGH) | Ранняя инициализация WsApiServer | Потеря начальных событий |
| P2 (MEDIUM) | Унификация каналов | Путаница клиентов |
| P2 (MEDIUM) | Улучшение error handling | Неконсистентность |
| P2 (MEDIUM) | Маппинг каналов | Неполные подписки |

---

## 6. Примечания

- Всего зарегистрировано 19 пакетов в PacketRegistry
- 3 пакета обрабатываются только в GameStateUpdater без Handler (0x27, 0x2F, 0x59)
- 2 пакета не публикуются в EventBus (SpawnItem, DropItem)
- 1 пакет не обновляет GameState (Attack)
- Два WS сервера работают на разных портах с разными механизмами подписки
