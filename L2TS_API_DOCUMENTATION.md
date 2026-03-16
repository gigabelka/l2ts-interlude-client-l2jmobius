# L2TS Interlude Client — API Documentation

> **Проект:** `l2ts-interlude-client-l2jmobius`  
> **Версия API:** `v1.0.0`  
> **Стек:** TypeScript / Node.js · L2J_Mobius CT_0_Interlude  
> **Автор документации:** архитектурный анализ + best practices

---

## Содержание

1. [Архитектурное решение: WS vs TCP vs Hybrid](#1-архитектурное-решение)
2. [Обзор API](#2-обзор-api)
3. [Аутентификация и безопасность](#3-аутентификация-и-безопасность)
4. [REST API — Эндпоинты](#4-rest-api)
   - 4.1 [Управление клиентом](#41-управление-клиентом)
   - 4.2 [Персонаж](#42-персонаж)
   - 4.3 [Инвентарь](#43-инвентарь)
   - 4.4 [Цели и бой](#44-цели-и-бой)
   - 4.5 [Движение](#45-движение)
   - 4.6 [Чат](#46-чат)
   - 4.7 [Умения (Skills)](#47-умения-skills)
   - 4.8 [Пати и социальное](#48-пати-и-социальное)
5. [WebSocket API — События](#5-websocket-api)
   - 5.1 [Подключение](#51-подключение)
   - 5.2 [Системные события](#52-системные-события)
   - 5.3 [События персонажа](#53-события-персонажа)
   - 5.4 [Боевые события](#54-боевые-события)
   - 5.5 [Чат-события](#55-чат-события)
   - 5.6 [Мировые события](#56-мировые-события)
6. [Структуры данных (Schemas)](#6-структуры-данных)
7. [Коды ошибок](#7-коды-ошибок)
8. [План реализации (Roadmap)](#8-план-реализации)
9. [Примеры использования](#9-примеры-использования)

---

## 1. Архитектурное решение

### Анализ: WebSocket vs TCP vs Hybrid

| Критерий | Raw TCP | Pure WebSocket | **Hybrid (REST + WS)** |
|---|---|---|---|
| Совместимость с браузерами / внешними инструментами | ❌ | ✅ | ✅ |
| Поддержка request-response паттерна | ✓ (кастомно) | ✓ (кастомно) | ✅ (нативно в REST) |
| Real-time event push | ✅ | ✅ | ✅ |
| Простота написания клиентов | ❌ (нужна реализация протокола) | ✓ | ✅ |
| Интеграция с внешними системами (Telegram, Discord, Dashboard) | ❌ | ✓ | ✅ |
| Latency критичность | Минимальная | Средняя | Средняя (приемлемо) |
| Стандарт индустрии для game bot API | ❌ | ✓ | ✅ |

### ✅ Итог: Hybrid Architecture (REST + WebSocket)

**Обоснование:**

Проект — это **headless бот-клиент**, обёртка над TCP-соединением с игровым сервером L2.  
Сам внутренний TCP (клиент ↔ игровой сервер) не меняется. Мы строим **внешнюю управляющую прослойку** (API Layer) поверх неё.

```
┌──────────────────────────────────────────────────────────────┐
│                    ВНЕШНИЕ КЛИЕНТЫ API                       │
│   Dashboard UI  ·  Bot Script  ·  Telegram Bot  ·  Discord  │
└────────────┬──────────────────────────┬───────────────────────┘
             │ HTTP REST                │ WebSocket
             │ (команды, запросы)       │ (события, real-time)
┌────────────▼──────────────────────────▼───────────────────────┐
│                    API LAYER  (Node.js / Express + ws)        │
│                    ─────────────────────────────────          │
│  POST /action/move     WS: emit("npcList", data)             │
│  GET  /character/stats WS: emit("combatEvent", data)         │
└────────────────────────────┬──────────────────────────────────┘
                             │ Internal Event Bus (EventEmitter)
┌────────────────────────────▼──────────────────────────────────┐
│              L2 CLIENT CORE  (существующий код)               │
│   LoginClient  ·  GameClient  ·  PacketEncoder/Decoder        │
│   TCP socket → Blowfish → L2 Game Server                     │
└───────────────────────────────────────────────────────────────┘
```

**REST** — для stateless операций: отдать команду, получить текущее состояние.  
**WebSocket** — для подписки на поток событий: бой, чат, движение NPC, HP/MP изменения.

---

## 2. Обзор API

### Базовые URL

```
REST API:   http://localhost:3000/api/v1
WebSocket:  ws://localhost:3000/ws
```

### Версионирование

API версионируется через путь (`/api/v1`). При breaking changes — новый префикс `/api/v2` без удаления старого (deprecation period 90 дней).

### Форматы данных

- Все запросы и ответы — `Content-Type: application/json`
- Кодировка: `UTF-8`
- Временные метки: ISO 8601 (`2025-03-14T12:00:00.000Z`)

### Стандартная структура ответа

**Успех:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-03-14T12:00:00.000Z",
    "requestId": "req_a1b2c3d4"
  }
}
```

**Ошибка:**
```json
{
  "success": false,
  "error": {
    "code": "CHARACTER_NOT_CONNECTED",
    "message": "No active game session. Connect first.",
    "details": {}
  },
  "meta": {
    "timestamp": "2025-03-14T12:00:00.000Z",
    "requestId": "req_a1b2c3d4"
  }
}
```

---

## 3. Аутентификация и безопасность

### API Key (рекомендуется для production)

```http
Authorization: Bearer <api_key>
```

Ключ задаётся в `src/config.ts` → `apiKey`. При отсутствии заголовка возвращается `401 Unauthorized`.

### WebSocket аутентификация

Токен передаётся в query string при подключении:

```
ws://localhost:3000/ws?token=<api_key>
```

### Ограничения (Rate Limiting)

| Группа эндпоинтов | Лимит |
|---|---|
| Команды движения | 10 req/s |
| Боевые команды | 5 req/s |
| Читаемые данные (GET) | 60 req/s |
| Общий лимит | 100 req/s |

При превышении — `429 Too Many Requests` с заголовком `Retry-After: <seconds>`.

---

## 4. REST API

### 4.1 Управление клиентом

#### `GET /api/v1/status`

Возвращает текущее состояние подключения клиента к игровому серверу.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "phase": "IN_GAME",
    "loginServer": {
      "connected": true,
      "host": "127.0.0.1",
      "port": 2106
    },
    "gameServer": {
      "connected": true,
      "host": "127.0.0.1",
      "port": 7777
    },
    "uptime": 3620,
    "pingMs": 14
  }
}
```

**Возможные значения `phase`:**
- `DISCONNECTED` — нет соединений
- `LOGIN_CONNECTING` — подключение к Login Server
- `LOGIN_AUTHENTICATING` — процесс RSA/Blowfish handshake
- `SELECTING_CHARACTER` — выбор персонажа
- `ENTERING_GAME` — вход в игровой мир
- `IN_GAME` — активная игровая сессия

---

#### `POST /api/v1/connect`

Инициирует подключение к серверу. Использует учётные данные из `src/config.ts`.

**Тело запроса:**
```json
{
  "overrideConfig": {
    "host": "192.168.1.100",
    "loginPort": 2106,
    "login": "myaccount",
    "password": "secret",
    "characterSlot": 0
  }
}
```
> `overrideConfig` — необязательный. Если не указан, используется `src/config.ts`.

**Ответ `202 Accepted`:**
```json
{
  "success": true,
  "data": {
    "message": "Connection initiated",
    "phase": "LOGIN_CONNECTING"
  }
}
```

---

#### `POST /api/v1/disconnect`

Корректно разрывает соединение с игровым сервером (отправляет logout пакет).

**Ответ:**
```json
{
  "success": true,
  "data": {
    "message": "Disconnected gracefully"
  }
}
```

---

#### `POST /api/v1/reconnect`

Переподключение с текущей конфигурацией. Полезно при дропе соединения.

**Тело запроса:**
```json
{
  "delayMs": 3000
}
```

---

### 4.2 Персонаж

#### `GET /api/v1/character`

Полный срез состояния текущего персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268500123,
    "name": "MyCharacter",
    "title": "Warrior",
    "classId": 1,
    "className": "Human Fighter",
    "level": 40,
    "race": "Human",
    "sex": "Male",
    "hp": { "current": 1200, "max": 1500 },
    "mp": { "current": 350, "max": 400 },
    "cp": { "current": 0, "max": 0 },
    "exp": 4500000,
    "expPercent": 62.3,
    "sp": 12000,
    "karma": 0,
    "pvpKills": 5,
    "pkKills": 0,
    "position": {
      "x": 82928,
      "y": 53600,
      "z": -1490,
      "heading": 32768
    },
    "stats": {
      "str": 45,
      "con": 43,
      "dex": 30,
      "int": 21,
      "wit": 20,
      "men": 21,
      "pAtk": 320,
      "mAtk": 58,
      "pDef": 245,
      "mDef": 130,
      "atkSpd": 330,
      "castSpd": 333,
      "accuracy": 8,
      "evasion": 8,
      "critical": 4,
      "speed": 130
    },
    "buffs": [
      {
        "skillId": 1204,
        "name": "Berserker Spirit",
        "level": 2,
        "remainingTime": 1180
      }
    ],
    "target": {
      "objectId": 268701234,
      "name": "Wolf",
      "type": "NPC"
    }
  }
}
```

---

#### `GET /api/v1/character/stats`

Только боевые характеристики (облегчённый запрос).

---

#### `GET /api/v1/character/buffs`

Список активных баффов и дебаффов.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "buffs": [
      {
        "skillId": 1204,
        "name": "Berserker Spirit",
        "level": 2,
        "remainingTime": 1180,
        "isDebuff": false,
        "icon": "icon.skill1204"
      }
    ],
    "debuffs": [
      {
        "skillId": 4082,
        "name": "Poison",
        "level": 1,
        "remainingTime": 15,
        "isDebuff": true
      }
    ]
  }
}
```

---

### 4.3 Инвентарь

#### `GET /api/v1/inventory`

Возвращает весь инвентарь персонажа.

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `type` | string | Фильтр по типу: `weapon`, `armor`, `consumable`, `material`, `quest`, `etc` |
| `equipped` | boolean | `true` — только надетые предметы |

**Ответ:**
```json
{
  "success": true,
  "data": {
    "adena": 125000,
    "weight": { "current": 8500, "max": 42000 },
    "items": [
      {
        "objectId": 268801000,
        "itemId": 57,
        "name": "Adena",
        "count": 125000,
        "type": "etc",
        "equipped": false,
        "slot": -1,
        "enchant": 0,
        "mana": -1
      },
      {
        "objectId": 268801001,
        "itemId": 49,
        "name": "Sword of Solidarity",
        "count": 1,
        "type": "weapon",
        "equipped": true,
        "slot": 6,
        "enchant": 3,
        "mana": -1,
        "grade": "D"
      }
    ]
  }
}
```

---

#### `POST /api/v1/inventory/use`

Использовать предмет из инвентаря (зелье, свиток и т.д.).

**Тело запроса:**
```json
{
  "objectId": 268801050
}
```

---

#### `POST /api/v1/inventory/drop`

Выбросить предмет на землю.

**Тело запроса:**
```json
{
  "objectId": 268801050,
  "count": 1,
  "position": {
    "x": 82928,
    "y": 53600,
    "z": -1490
  }
}
```

---

### 4.4 Цели и бой

#### `GET /api/v1/target`

Текущая цель персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "objectId": 268701234,
    "name": "Werewolf",
    "type": "NPC",
    "npcId": 20058,
    "level": 38,
    "hp": { "current": 800, "max": 1200 },
    "isAttackable": true,
    "isAggressive": false,
    "position": {
      "x": 82948,
      "y": 53610,
      "z": -1490
    }
  }
}
```

---

#### `POST /api/v1/target/set`

Установить цель по objectId.

**Тело запроса:**
```json
{
  "objectId": 268701234
}
```

---

#### `POST /api/v1/target/clear`

Снять текущую цель.

---

#### `POST /api/v1/combat/attack`

Атаковать текущую или указанную цель.

**Тело запроса:**
```json
{
  "objectId": 268701234,
  "shiftClick": false
}
```

---

#### `POST /api/v1/combat/stop`

Остановить авто-атаку.

---

#### `GET /api/v1/nearby/npcs`

Список NPC/мобов в радиусе видимости.

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `radius` | number | Радиус поиска (по умолчанию 600, макс 2000) |
| `attackable` | boolean | Только атакуемые |
| `alive` | boolean | Только живые (по умолчанию `true`) |

**Ответ:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "npcs": [
      {
        "objectId": 268701234,
        "npcId": 20058,
        "name": "Werewolf",
        "level": 38,
        "hp": { "current": 1200, "max": 1200 },
        "isAttackable": true,
        "isAggressive": false,
        "distance": 145,
        "position": { "x": 82948, "y": 53610, "z": -1490 }
      }
    ]
  }
}
```

---

#### `GET /api/v1/nearby/players`

Список игроков в радиусе видимости.

**Query параметры:** аналогичны `/nearby/npcs`

---

#### `GET /api/v1/nearby/items`

Предметы на земле в радиусе видимости.

---

#### `POST /api/v1/pickup`

Подобрать предмет с земли.

**Тело запроса:**
```json
{
  "objectId": 268900001
}
```

---

### 4.5 Движение

#### `POST /api/v1/move/to`

Отправить персонажа к координатам.

**Тело запроса:**
```json
{
  "x": 83500,
  "y": 54000,
  "z": -1490,
  "validateRange": true
}
```

> `validateRange: true` — вернёт ошибку, если точка слишком далеко (>50 000 ед.) от текущей позиции.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "message": "Move command sent",
    "destination": { "x": 83500, "y": 54000, "z": -1490 },
    "estimatedTimeMs": 4200
  }
}
```

---

#### `POST /api/v1/move/stop`

Остановить движение.

---

#### `GET /api/v1/move/status`

Текущее состояние движения.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "isMoving": true,
    "destination": { "x": 83500, "y": 54000, "z": -1490 },
    "speed": 130
  }
}
```

---

#### `POST /api/v1/move/follow`

Следовать за объектом (персонаж/NPC).

**Тело запроса:**
```json
{
  "objectId": 268500456,
  "minDistance": 80
}
```

---

### 4.6 Чат

#### `POST /api/v1/chat/send`

Отправить сообщение в чат.

**Тело запроса:**
```json
{
  "channel": "ALL",
  "message": "Hello World!"
}
```

**Возможные значения `channel`:**
| Значение | Описание |
|---|---|
| `ALL` | Общий чат |
| `SHOUT` | Крик (`!message`) |
| `TELL` | Личное сообщение |
| `PARTY` | Чат группы |
| `CLAN` | Чат клана |
| `TRADE` | Торговый чат (`+message`) |
| `HERO` | Геройский чат (`@message`) |

Для `TELL` дополнительно требуется `"target": "PlayerName"`.

---

#### `GET /api/v1/chat/history`

История принятых сообщений (хранится в памяти, последние 500 сообщений).

**Query параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `channel` | string | Фильтр по каналу |
| `limit` | number | Кол-во записей (макс. 100, по умолчанию 50) |
| `since` | ISO timestamp | Сообщения начиная с этой даты |

---

### 4.7 Умения (Skills)

#### `GET /api/v1/skills`

Список всех умений персонажа.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "skills": [
      {
        "skillId": 3,
        "name": "Combat Stance",
        "level": 5,
        "isActive": true,
        "isPassive": false,
        "isToggle": false,
        "cooldownMs": 0,
        "mpCost": 12,
        "castTimeMs": 1080,
        "range": 40,
        "reuseDelayMs": 4000,
        "isReady": true
      }
    ]
  }
}
```

---

#### `POST /api/v1/skills/use`

Применить умение.

**Тело запроса:**
```json
{
  "skillId": 3,
  "level": 5,
  "targetObjectId": 268701234,
  "ctrlPressed": false,
  "shiftPressed": false
}
```

> `ctrlPressed: true` — принудительная атака игрока (PvP).

---

#### `GET /api/v1/skills/shortcuts`

Список умений, назначенных на хоткеи.

---

### 4.8 Пати и социальное

#### `GET /api/v1/party`

Информация о текущей группе.

**Ответ:**
```json
{
  "success": true,
  "data": {
    "inParty": true,
    "isLeader": false,
    "members": [
      {
        "objectId": 268500456,
        "name": "Healer",
        "classId": 49,
        "level": 42,
        "hp": { "current": 900, "max": 1100 },
        "mp": { "current": 500, "max": 600 },
        "cp": { "current": 0, "max": 0 },
        "isOnline": true
      }
    ]
  }
}
```

---

#### `POST /api/v1/party/invite`

Пригласить игрока в группу.

```json
{ "playerName": "PlayerName" }
```

---

#### `POST /api/v1/party/leave`

Покинуть текущую группу.

---

#### `POST /api/v1/social/action`

Выполнить социальное действие (анимацию).

```json
{ "actionId": 2 }
```

---

## 5. WebSocket API

### 5.1 Подключение

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=YOUR_API_KEY');

ws.onopen = () => {
  // Подписаться на группы событий
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'chat', 'world']
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.data);
};
```

### Формат сообщений WebSocket

**Входящее (сервер → клиент):**
```json
{
  "type": "EVENT_TYPE",
  "channel": "combat",
  "data": { ... },
  "timestamp": "2025-03-14T12:00:00.000Z"
}
```

**Исходящее (клиент → сервер):**
```json
{
  "type": "subscribe" | "unsubscribe" | "ping",
  "channels": ["combat", "chat"]
}
```

### Каналы подписки

| Канал | Описание |
|---|---|
| `system` | Статус подключения, ошибки |
| `character` | Изменения HP/MP/CP, баффы, XP |
| `combat` | Атаки, дамаг, смерть |
| `chat` | Входящие сообщения чата |
| `world` | NPC появление/исчезновение, предметы |
| `movement` | Изменение позиции персонажа |
| `party` | События группы |

---

### 5.2 Системные события

#### `system.connected`
```json
{
  "type": "system.connected",
  "channel": "system",
  "data": {
    "phase": "IN_GAME",
    "characterName": "MyCharacter",
    "serverId": 1
  }
}
```

#### `system.disconnected`
```json
{
  "type": "system.disconnected",
  "channel": "system",
  "data": {
    "reason": "Connection lost",
    "phase": "DISCONNECTED",
    "willReconnect": true,
    "reconnectIn": 5000
  }
}
```

#### `system.error`
```json
{
  "type": "system.error",
  "channel": "system",
  "data": {
    "code": "LOGIN_FAILED",
    "message": "Invalid credentials"
  }
}
```

---

### 5.3 События персонажа

#### `character.stats_changed`

Срабатывает при изменении HP, MP, CP, XP или характеристик.

```json
{
  "type": "character.stats_changed",
  "channel": "character",
  "data": {
    "hp": { "current": 1100, "max": 1500, "delta": -100 },
    "mp": { "current": 340, "max": 400, "delta": -10 },
    "cp": { "current": 0, "max": 0, "delta": 0 }
  }
}
```

#### `character.level_up`
```json
{
  "type": "character.level_up",
  "channel": "character",
  "data": {
    "newLevel": 41,
    "oldLevel": 40,
    "sp": 15000
  }
}
```

#### `character.buff_added`
```json
{
  "type": "character.buff_added",
  "channel": "character",
  "data": {
    "skillId": 1204,
    "name": "Berserker Spirit",
    "level": 2,
    "duration": 1200,
    "isDebuff": false
  }
}
```

#### `character.buff_removed`
```json
{
  "type": "character.buff_removed",
  "channel": "character",
  "data": {
    "skillId": 1204,
    "name": "Berserker Spirit"
  }
}
```

#### `character.died`
```json
{
  "type": "character.died",
  "channel": "character",
  "data": {
    "killerObjectId": 268701234,
    "killerName": "Werewolf",
    "position": { "x": 82928, "y": 53600, "z": -1490 }
  }
}
```

#### `character.revived`
```json
{
  "type": "character.revived",
  "channel": "character",
  "data": {
    "position": { "x": 82700, "y": 53200, "z": -1490 },
    "hp": 375,
    "mp": 100
  }
}
```

---

### 5.4 Боевые события

#### `combat.attack_sent`

Персонаж атаковал цель.

```json
{
  "type": "combat.attack_sent",
  "channel": "combat",
  "data": {
    "attackerObjectId": 268500123,
    "targetObjectId": 268701234,
    "damage": 145,
    "isCritical": false,
    "isMiss": false,
    "attackType": "MELEE"
  }
}
```

#### `combat.attack_received`

Персонаж получил урон.

```json
{
  "type": "combat.attack_received",
  "channel": "combat",
  "data": {
    "attackerObjectId": 268701234,
    "attackerName": "Werewolf",
    "damage": 87,
    "isCritical": true,
    "newHp": 1013,
    "newMp": 340
  }
}
```

#### `combat.skill_used`

Применено умение (своё или чужое).

```json
{
  "type": "combat.skill_used",
  "channel": "combat",
  "data": {
    "casterObjectId": 268500123,
    "targetObjectId": 268701234,
    "skillId": 3,
    "skillName": "Combat Stance",
    "skillLevel": 5,
    "isSuccessful": true
  }
}
```

#### `combat.target_died`

Цель убита.

```json
{
  "type": "combat.target_died",
  "channel": "combat",
  "data": {
    "objectId": 268701234,
    "name": "Werewolf",
    "npcId": 20058,
    "position": { "x": 82948, "y": 53610, "z": -1490 }
  }
}
```

---

### 5.5 Чат-события

#### `chat.message`
```json
{
  "type": "chat.message",
  "channel": "chat",
  "data": {
    "channel": "ALL",
    "senderName": "SomePlayer",
    "senderObjectId": 268600789,
    "message": "WTS Sword of Solidarity +5!",
    "receivedAt": "2025-03-14T12:05:00.000Z"
  }
}
```

#### `chat.system_message`

Системные сообщения от сервера (красные надписи).

```json
{
  "type": "chat.system_message",
  "channel": "chat",
  "data": {
    "messageId": 614,
    "messageText": "You have acquired 345 adena.",
    "params": ["345"]
  }
}
```

---

### 5.6 Мировые события

#### `world.npc_spawned`
```json
{
  "type": "world.npc_spawned",
  "channel": "world",
  "data": {
    "objectId": 268701500,
    "npcId": 20058,
    "name": "Werewolf",
    "level": 38,
    "position": { "x": 83100, "y": 53800, "z": -1490 },
    "isAttackable": true
  }
}
```

#### `world.npc_despawned`
```json
{
  "type": "world.npc_despawned",
  "channel": "world",
  "data": {
    "objectId": 268701500
  }
}
```

#### `world.item_dropped`
```json
{
  "type": "world.item_dropped",
  "channel": "world",
  "data": {
    "objectId": 268900100,
    "itemId": 57,
    "name": "Adena",
    "count": 1240,
    "position": { "x": 82960, "y": 53615, "z": -1490 }
  }
}
```

#### `world.item_picked_up`
```json
{
  "type": "world.item_picked_up",
  "channel": "world",
  "data": {
    "objectId": 268900100,
    "pickedByObjectId": 268500123
  }
}
```

#### `movement.position_changed`
```json
{
  "type": "movement.position_changed",
  "channel": "movement",
  "data": {
    "objectId": 268500123,
    "position": { "x": 83100, "y": 53700, "z": -1490, "heading": 28000 },
    "speed": 130,
    "isRunning": true
  }
}
```

---

## 6. Структуры данных

### Position
```typescript
interface Position {
  x: number;       // Координата X игрового мира
  y: number;       // Координата Y игрового мира
  z: number;       // Высота
  heading?: number; // Направление (0–65535)
}
```

### HpMpCp
```typescript
interface HpMpCp {
  current: number;
  max: number;
}
```

### CharacterStats
```typescript
interface CharacterStats {
  str: number;       // Сила
  con: number;       // Телосложение
  dex: number;       // Ловкость
  int: number;       // Интеллект
  wit: number;       // Мудрость
  men: number;       // Концентрация
  pAtk: number;      // Физическая атака
  mAtk: number;      // Магическая атака
  pDef: number;      // Физическая защита
  mDef: number;      // Магическая защита
  atkSpd: number;    // Скорость атаки
  castSpd: number;   // Скорость каста
  accuracy: number;  // Точность
  evasion: number;   // Уклонение
  critical: number;  // Крит
  speed: number;     // Скорость бега
}
```

### Item
```typescript
interface Item {
  objectId: number;      // Уникальный ID экземпляра
  itemId: number;        // Тип предмета (из базы данных)
  name: string;
  count: number;
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'quest' | 'etc';
  equipped: boolean;
  slot: number;          // Слот (-1 = не надет)
  enchant: number;       // +N зачаровывание
  mana: number;          // -1 = нет мана-кристаллов
  grade?: 'No' | 'D' | 'C' | 'B' | 'A' | 'S';
}
```

### Buff
```typescript
interface Buff {
  skillId: number;
  name: string;
  level: number;
  remainingTime: number; // Секунды, -1 = постоянный
  isDebuff: boolean;
  icon?: string;
}
```

---

## 7. Коды ошибок

| Код | HTTP | Описание |
|---|---|---|
| `NOT_CONNECTED` | 503 | Клиент не подключён к серверу |
| `NOT_IN_GAME` | 503 | Авторизован, но персонаж ещё не вошёл в игру |
| `INVALID_TARGET` | 400 | Указан несуществующий objectId |
| `TARGET_DEAD` | 400 | Цель уже мертва |
| `TARGET_OUT_OF_RANGE` | 400 | Цель вне зоны досягаемости |
| `SKILL_NOT_FOUND` | 404 | Умение отсутствует у персонажа |
| `SKILL_ON_COOLDOWN` | 429 | Умение на кулдауне |
| `NOT_ENOUGH_MP` | 400 | Недостаточно MP |
| `ITEM_NOT_FOUND` | 404 | Предмет не найден в инвентаре |
| `MOVEMENT_BLOCKED` | 400 | Движение заблокировано (кастует и т.д.) |
| `CHAT_FLOOD` | 429 | Слишком частая отправка сообщений |
| `UNAUTHORIZED` | 401 | Неверный или отсутствующий API ключ |
| `RATE_LIMIT_EXCEEDED` | 429 | Превышен лимит запросов |
| `INTERNAL_ERROR` | 500 | Внутренняя ошибка клиента |
| `CONFIG_MISSING` | 500 | Конфигурация `src/config.ts` не заполнена |

---

## 8. План реализации (скорректированный)

> **Принцип:** Сначала собираем данные из игры, потом отдаём их через API. Без State Store API будет возвращать пустые заглушки.

---

### ✅ Фаза 0 — State Store и EventBus (2–3 дня)

**Цель:** Создать инфраструктуру для сбора и хранения данных из игровых пакетов.

**Задачи:**
1. Создать `src/core/GameStateStore.ts` — in-memory хранилище состояния:
   - `CharacterState` (HP/MP/CP, позиция, статы, класс, уровень, баффы)
   - `WorldState` (список NPC, игроков, предметов на земле)
   - `InventoryState` (предметы, адена, вес)
   - `CombatState` (текущая цель, last attack time)

2. Создать `src/core/EventBus.ts` — типизированный EventEmitter:
   - `emit('character.stats_changed', data)`
   - `emit('world.npc_spawned', data)`
   - `emit('combat.attack_received', data)`

3. Подключить хуки в `GamePacketHandler`/`GameClient`:
   - Обрабатывать `UserInfo` (0x04) → обновлять `CharacterState` + `EventBus.emit()`
   - Обрабатывать `NpcInfo` (0x16) → обновлять `WorldState`
   - Добавить `EventBus.on('*', ...)` для отладочного логирования

**Критерий готовности:**
В консоли видны события при входе в игру:
```
[EventBus] character.stats_changed { hp: { current: 1200, max: 1500 }, ... }
[EventBus] world.npc_spawned { objectId: 268701234, name: "Werewolf", ... }
```

---

### ✅ Фаза 1 — REST API Core (3–4 дня)

**Цель:** Базовый HTTP API для чтения состояния (только GET).

**Задачи:**
1. Установить зависимости: `express`, `cors`, `helmet`, `express-rate-limit`
2. Создать `src/api/ApiServer.ts` (Express + middleware):
   - Аутентификация по API Key
   - Rate limiting (60 req/s для GET)
   - Request ID для трассировки
   - Graceful shutdown
3. Реализовать эндпоинты (чтение из `GameStateStore`):
   - `GET /api/v1/status` — состояние подключения
   - `GET /api/v1/character` — полные данные персонажа
   - `GET /api/v1/character/stats` — только боевые характеристики
   - `GET /api/v1/inventory` — инвентарь
   - `GET /api/v1/nearby/npcs` — список NPC в радиусе
   - `GET /api/v1/target` — текущая цель
4. Подключить `ApiServer.start()` в `src/index.ts` (порт 3000)

**Критерий готовности:**
```bash
curl http://localhost:3000/api/v1/character
# Возвращает реальные данные персонажа из игры
```

---

### ✅ Фаза 2 — WebSocket + Real-time Events (2–3 дня)

**Цель:** Потоковая передача событий из игры наружу.

**Задачи:**
1. Установить `ws`
2. Создать `src/api/ws/WsServer.ts`:
   - Подключение: `ws://localhost:3000/ws?token=API_KEY`
   - Протокол: `subscribe` / `unsubscribe` / `ping`
   - Каналы: `system`, `character`, `combat`, `world`, `movement`, `chat`
3. Подписать `WsServer` на `EventBus`:
   - При `character.stats_changed` → broadcast подписчикам канала `character`
   - При `world.npc_spawned` → broadcast каналу `world`
   - При `combat.attack_received` → broadcast каналу `combat`

**Критерий готовности:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=key');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
// При изменении HP в игре → приходит событие в браузер
```

---

### ✅ Фаза 3 — Action API (команды) (3–4 дня)

**Цель:** Управление персонажем через HTTP API.

**Задачи:**
1. Расширить `GameClient` методами для отправки пакетов:
   - `sendMoveTo(x, y, z)` — пакет `MoveToLocation`
   - `sendAction(objectId, actionId)` — атака/взаимодействие
   - `sendUseSkill(skillId, targetId, ctrl, shift)` — использование умения
   - `sendChatMessage(channel, message, target?)` — чат
   - `sendTarget(objectId)` — установка цели

2. POST эндпоинты:
   - `POST /api/v1/move/to` — двигаться к координатам
   - `POST /api/v1/move/stop` — остановиться
   - `POST /api/v1/combat/attack` — атаковать цель
   - `POST /api/v1/combat/stop` — остановить авто-атаку
   - `POST /api/v1/skills/use` — использовать умение
   - `POST /api/v1/target/set` — установить цель
   - `POST /api/v1/target/clear` — снять цель
   - `POST /api/v1/chat/send` — отправить сообщение

3. Валидация входных данных (Zod схемы)

**Критерий готовности:**
```bash
curl -X POST http://localhost:3000/api/v1/move/to \
  -d '{"x": 83500, "y": 54000, "z": -1490}'
# Персонаж начинает движение в игре
```

---

### ✅ Фаза 4 — Продвинутые фичи (3–5 дней)

**Цель:** Расширенный функционал для production-использования.

**Задачи:**
1. **Управление подключением:**
   - `POST /api/v1/connect` — подключиться к серверу (с overrideConfig)
   - `POST /api/v1/disconnect` — корректный logout
   - `POST /api/v1/reconnect` — переподключение

2. **Инвентарь:**
   - `POST /api/v1/inventory/use` — использовать предмет
   - `POST /api/v1/inventory/drop` — выбросить предмет
   - `POST /api/v1/pickup` — подобрать предмет с земли

3. **Пати:**
   - `GET /api/v1/party` — информация о группе
   - `POST /api/v1/party/invite` — пригласить игрока
   - `POST /api/v1/party/leave` — покинуть группу

4. **Дополнительно:**
   - `POST /api/v1/move/follow` — следовать за объектом
   - `GET /api/v1/skills/shortcuts` — хоткеи умений
   - Rate limiting per endpoint (10 req/s для движения, 5 req/s для боевых команд)

---

### ✅ Фаза 5 — Документация и тесты (2–3 дня)

**Задачи:**
1. OpenAPI 3.0 спецификация (`openapi.yaml`)
2. Интеграционные тесты с mock L2 сервером
3. Health check: `GET /health`
4. Обновить README с примерами использования
5. (Опционально) HTTPS/WSS для production

---

## Сводка по срокам

| Фаза | Длительность | Результат |
|------|--------------|-----------|
| 0 | 2–3 дня | Данные из игры собираются в Store |
| 1 | 3–4 дня | Работающий REST API (только GET) |
| 2 | 2–3 дня | Real-time WebSocket события |
| 3 | 3–4 дня | Управление персонажем через API |
| 4 | 3–5 дней | Полнофункциональный API |
| 5 | 2–3 дня | Документация, тесты |
| **Итого** | **15–22 дня** | MVP → Production-ready |

## Архитектура итоговой системы

```
┌─────────────────────────────────────────────────────────────┐
│                    ВНЕШНИЕ КЛИЕНТЫ API                      │
│   Dashboard UI  ·  Bot Script  ·  Telegram Bot  ·  Discord  │
└────────────┬─────────────────────────┬──────────────────────┘
             │ HTTP REST               │ WebSocket
             │ (команды, запросы)      │ (events, real-time)
┌────────────▼─────────────────────────▼──────────────────────┐
│                   API LAYER (src/api/)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ApiServer   │  │ WsServer    │  │ Middleware          │  │
│  │  (Express)  │  │  (ws lib)   │  │  auth, rate limit   │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          └────────┬───────┘
                   │ EventBus
┌──────────────────▼──────────────────────────────────────────┐
│              CORE LAYER (src/core/)                         │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │ GameStateStore  │  │ EventBus (typed EventEmitter)   │   │
│  │  - Character    │  │                                 │   │
│  │  - World        │  │  character.stats_changed       │   │
│  │  - Inventory    │  │  world.npc_spawned             │   │
│  │  - Combat       │  │  combat.attack_received        │   │
│  └────────┬────────┘  └─────────────────────────────────┘   │
└───────────┼─────────────────────────────────────────────────┘
            │ обновляет / читает
┌───────────▼─────────────────────────────────────────────────┐
│              GAME CLIENT (src/game/)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ GameClient  │  │ GamePacket  │  │ Connection          │  │
│  │             │  │   Handler   │  │  (TCP socket)       │  │
│  │  - парсит   │  │             │  │                     │  │
│  │    пакеты   │  │  - UserInfo │  │  → L2 Game Server   │  │
│  │  - заполняет│  │  - NpcInfo  │  │                     │  │
│  │    Store    │  │  - Attack   │  │  → L2 Login Server  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Примеры использования

### Пример 1: Bot Script — автофарм

```typescript
// Скрипт на TypeScript, использующий API клиента
import axios from 'axios';
import WebSocket from 'ws';

const API = 'http://localhost:3000/api/v1';
const HEADERS = { Authorization: 'Bearer my_api_key' };

// Подключиться и подписаться на события
const ws = new WebSocket('ws://localhost:3000/ws?token=my_api_key');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['combat', 'world'] }));
});

ws.on('message', async (raw) => {
  const event = JSON.parse(raw.toString());

  // Когда моб убит — подобрать лут и найти следующего
  if (event.type === 'combat.target_died') {
    const { data: nearby } = await axios.get(`${API}/nearby/items`, { headers: HEADERS });
    for (const item of nearby.data.items) {
      await axios.post(`${API}/pickup`, { objectId: item.objectId }, { headers: HEADERS });
      await delay(300);
    }
    await findAndAttackNextMob();
  }
});

async function findAndAttackNextMob() {
  const { data } = await axios.get(
    `${API}/nearby/npcs?attackable=true&radius=600`,
    { headers: HEADERS }
  );
  if (data.data.npcs.length > 0) {
    const target = data.data.npcs[0];
    await axios.post(`${API}/combat/attack`, { objectId: target.objectId }, { headers: HEADERS });
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

---

### Пример 2: Telegram-бот мониторинг

```javascript
// Уведомление в Telegram когда персонаж умирает
const ws = new WebSocket('ws://localhost:3000/ws?token=my_api_key');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'subscribe', channels: ['character', 'system'] }));
});

ws.on('message', (raw) => {
  const event = JSON.parse(raw);
  if (event.type === 'character.died') {
    sendTelegramAlert(`☠️ Персонаж умер! Убийца: ${event.data.killerName}`);
  }
  if (event.type === 'system.disconnected') {
    sendTelegramAlert(`⚠️ Дроп соединения! Причина: ${event.data.reason}`);
  }
});
```

---

### Пример 3: cURL — проверить статус

```bash
# Статус подключения
curl -H "Authorization: Bearer my_api_key" \
     http://localhost:3000/api/v1/status

# Текущие характеристики персонажа
curl -H "Authorization: Bearer my_api_key" \
     http://localhost:3000/api/v1/character/stats

# Атаковать цель
curl -X POST \
     -H "Authorization: Bearer my_api_key" \
     -H "Content-Type: application/json" \
     -d '{"objectId": 268701234}' \
     http://localhost:3000/api/v1/combat/attack

# Отправить сообщение в общий чат
curl -X POST \
     -H "Authorization: Bearer my_api_key" \
     -H "Content-Type: application/json" \
     -d '{"channel": "ALL", "message": "Hello!"}' \
     http://localhost:3000/api/v1/chat/send
```

---

*Документация актуальна для версии API v1.0.0 и L2J_Mobius CT_0_Interlude.*  
*При изменении игрового протокола структуры пакетов могут измениться.*
