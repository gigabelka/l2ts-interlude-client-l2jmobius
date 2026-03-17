# L2 Headless Client — AI Agent Guide

> **Project:** `l2ts-interlude-client-l2jmobius`  
> **Language:** Russian (primary), English (code comments)  
> **Node.js:** LTS 24.14.0  
> **Target Server:** L2J_Mobius CT_0_Interlude (Protocol 746)

---

## Project Overview

Headless Lineage 2 клиент с **REST + WebSocket API**, написанный на TypeScript. Подключается к Login Server, аутентифицируется с учетными данными, выбирает персонажа, входит в игровой мир и предоставляет полный внешний API для управления и мониторинга.

### Key Features

- ✅ Автоматическая аутентификация на Login Server
- ✅ Автоматический выбор персонажа
- ✅ Вход в игровой мир с keepalive (ping/pong)
- ✅ **REST API** — HTTP endpoints для состояния и управления
- ✅ **WebSocket API** — события в реальном времени
- ✅ **State Store** — централизованное управление состоянием игры
- ✅ **Event Bus** — типизированная система событий
- ✅ **Dashboard** — веб-интерфейс для мониторинга

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 24.14.0 LTS |
| Language | TypeScript 5.9.3 |
| Module System | CommonJS |
| Target | ES2020 |
| API Framework | Express.js 5.2.1 |
| WebSocket | `ws` library |
| Testing | Vitest 2.1.4 |
| Crypto | Custom Blowfish, XOR, RSA implementations |
| Validation | Zod 4.3.6 |

---

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development mode (silent logging)
npm run dev

# Debug mode (verbose packet logging)
npm run debug

# Build for production (compiles to dist/)
npm run build

# Start production build
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Bump version and commit
npm run commit
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level: `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT` | `ERROR` |
| `AUTO_CONNECT_GAME` | Auto-connect to game server on startup | `true` |
| `API_KEY` | API authentication key (empty = no auth) | `""` |
| `NODE_ENV` | Environment mode | `development` |

---

## Project Structure

```
src/
├── index.ts                 # Entry point: LoginClient → GameClient + API
├── config.ts                # Configuration: server, credentials, API settings
│
├── api/                     # REST API Layer
│   ├── ApiServer.ts         # Express server setup
│   ├── ws/
│   │   └── WsServer.ts      # WebSocket server for real-time events
│   ├── middleware/          # Auth, rate limiting, request ID
│   │   ├── auth.ts
│   │   ├── rateLimiter.ts
│   │   └── requestId.ts
│   └── routes/              # API endpoints
│       ├── status.ts
│       ├── character.ts
│       ├── inventory.ts
│       ├── target.ts
│       ├── nearby.ts
│       ├── combat.ts
│       ├── movement.ts
│       ├── skills.ts
│       ├── chat.ts
│       ├── party.ts
│       ├── connection.ts
│       └── social.ts
│
├── core/                    # Core Architecture
│   ├── EventBus.ts          # Typed EventEmitter for real-time events
│   ├── GameStateStore.ts    # Central state store (singleton)
│   └── index.ts             # Core exports
│
├── logger/
│   └── Logger.ts            # Logging with levels and hex dumps
│
├── network/                 # TCP & Packet Layer
│   ├── Connection.ts        # Abstract TCP client with L2 framing
│   ├── PacketReader.ts      # Binary reader (little-endian)
│   └── PacketWriter.ts      # Binary writer (little-endian)
│
├── crypto/                  # Encryption Layer
│   ├── BlowfishEngine.ts    # Blowfish ECB implementation
│   ├── NewCrypt.ts          # Blowfish wrapper + checksum + XOR
│   ├── RSACrypt.ts          # RSA encryption (1024-bit, NO_PADDING)
│   └── ScrambledRSAKey.ts   # RSA modulus unscrambling
│
├── login/                   # Login Server Phase
│   ├── LoginClient.ts       # FSM-driven login client
│   ├── LoginCrypt.ts        # Login encryption (static + dynamic Blowfish)
│   ├── LoginPacketHandler.ts # Opcode router
│   ├── types.ts             # LoginConfig, SessionData, LoginState
│   └── packets/
│       ├── incoming/        # InitPacket, GGAuthPacket, LoginOkPacket, etc.
│       └── outgoing/        # RequestGGAuth, RequestAuthLogin, etc.
│
└── game/                    # Game Server Phase
    ├── GameClient.ts        # FSM-driven game client
    ├── GameCommandManager.ts # Command interface for API
    ├── GameCrypt.ts         # XOR encryption
    ├── GameState.ts         # GameState enum
    ├── GamePacketHandler.ts # Opcode router
    └── packets/
        ├── incoming/        # UserInfo, NpcInfo, ItemList, etc.
        └── outgoing/        # AuthRequest, EnterWorld, etc.

tests/                       # Test Suite
├── setup.ts                 # Global test setup
├── config.ts                # Test configuration
├── utils/
│   └── mockServer.ts        # Mock L2 server for tests
├── integration/
│   ├── api/                 # API integration tests
│   └── packets/             # Packet parsing tests

scripts/                     # Build Scripts
├── bump-version.js          # Auto-increment version
└── copy-dashboard.js        # Copy dashboard assets to dist/

dashboard/                   # Web Dashboard (static files)
├── index.html
├── openapi.json             # API specification
└── api-docs.html            # Scalar API docs
```

---

## Architecture

### Two-Phase Connection Model

Клиент имеет две четко разделенные фазы подключения, управляемые FSM (Finite State Machine):

#### Phase 1: Login Server (LoginClient)

```
Init → GGAuth → AuthLogin → ServerList → PlayOk → disconnect
```

- **Crypto:** Static Blowfish для Init, dynamic Blowfish + XOR для остального, RSA для учетных данных
- **States:** `IDLE` → `CONNECTING` → `WAIT_INIT` → `WAIT_GG_AUTH` → `WAIT_LOGIN_OK` → `WAIT_SERVER_LIST` → `WAIT_PLAY_OK` → `DONE`

#### Phase 2: Game Server (GameClient)

```
ProtocolVersion (0x00) → CryptInit (0x00) → AuthRequest (0x08) → 
CharSelectInfo (0x13) → CharacterSelected (0x0D) → CharSelected (0x15) → 
(0x9D + 0xD0-08-00 + EnterWorld 0x03) → UserInfo (0x04) → IN_GAME
```

- **Crypto:** XOR encryption (может быть отключена через флаг в CryptInit)
- **States:** `IDLE` → `CONNECTING` → `WAIT_CRYPT_INIT` → `WAIT_CHAR_LIST` → `WAIT_CHAR_SELECTED` → `WAIT_USER_INFO` → `IN_GAME`

### Core Systems

#### EventBus

Типизированная обертка над EventEmitter для событий в реальном времени:

```typescript
// Channels: 'system', 'character', 'combat', 'chat', 'world', 'movement', 'party'
EventBus.emitEvent({ type: 'character.stats_changed', channel: 'character', data: {...}, timestamp: '...' });
EventBus.onEvent('character.stats_changed', handler);
EventBus.onAny(handler); // Listen to all events
```

#### GameStateStore

Централизованное хранилище состояния (singleton pattern):

```typescript
GameStateStore.getCharacter();      // Character state
GameStateStore.getWorld();          // NPCs, players, items
GameStateStore.getInventory();      // Items, adena
GameStateStore.getCombat();         // Target, combat status
GameStateStore.getParty();          // Party members
GameStateStore.getConnection();     // Connection phase, uptime
```

### Packet Framing

L2 protocol: каждый пакет начинается с `uint16LE` длины (включая 2-байтовый заголовок).

```typescript
// Packet format types used in code:
// C = uint8, H = uint16, D = int32, Q = int64, F = double
// S = UTF-16LE null-terminated string
```

---

## Configuration

### Main Config (`src/config.ts`)

```typescript
export const CONFIG = {
    Username: "your_login",          // Login credentials
    Password: "your_password",
    LoginIp: "192.168.0.33",         // Login server address
    LoginPort: 2106,                 // Default: 2106
    GamePort: 7777,                  // Default: 7777
    Protocol: 746,                   // Interlude protocol version
    ServerId: 2,                     // Server ID from server list
    CharSlotIndex: 0,                // Character slot (0-based)
} as const;

export const API_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    apiKey: process.env.API_KEY || '',  // Empty = no auth
    enableCors: true,
    rateLimit: { windowMs: 1000, maxRequests: 100, moveLimit: 10, combatLimit: 5 }
} as const;
```

### API Authentication

- Если `API_CONFIG.apiKey` пустой — аутентификация отключена
- Если задан — требуется заголовок: `Authorization: Bearer <apiKey>`

---

## Testing Strategy

### Test Structure

```bash
tests/
├── setup.ts              # Global setup: reset state, mock server
├── config.ts             # Test configuration
├── utils/mockServer.ts   # Mock L2 server for integration tests
├── integration/api/      # API endpoint tests
└── integration/packets/  # Packet parsing tests
```

### Running Tests

```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
```

### Test Helpers (in `tests/setup.ts`)

```typescript
// Setup helpers for packet and API tests
const { getMockServer } = setupPacketTest();
const { getMockServer } = setupApiTest();

// Event waiting
await waitForEvent('character.stats_changed');
await waitForCondition(() => GameStateStore.getCharacter().level === 2);
```

### Test Conventions

- Каждый тест должен сбрасывать состояние: `GameStateStore.reset()`
- Очищать EventBus: `EventBus.removeAllListeners()`
- Использовать `MockL2Server` для имитации сервера
- Устанавливать `LOG_LEVEL=SILENT` для чистого вывода

---

## Code Style Guidelines

### ESLint Configuration (`.eslintrc.json`)

```json
{
    "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    "rules": {
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "prefer-const": "off"
    }
}
```

### TypeScript Configuration

- **Target:** ES2020
- **Module:** CommonJS
- **Strict mode:** enabled
- **Path alias:** `@/` maps to `./src` (for Vitest)

### Naming Conventions

- **Classes:** PascalCase (e.g., `GameClient`, `LoginClient`)
- **Interfaces/Types:** PascalCase (e.g., `CharacterState`, `NpcInfo`)
- **Enums:** PascalCase with enum suffix (e.g., `LoginState`, `GameState`)
- **Methods/functions:** camelCase (e.g., `updateCharacter`, `getNearbyNpcs`)
- **Constants:** SCREAMING_SNAKE_CASE for true constants (e.g., `CONFIG`, `API_CONFIG`)
- **Private methods:** prefix with underscore discouraged, use private keyword

### File Organization

- Один класс/интерфейс на файл
- Индексные файлы (`index.ts`) для экспортов из директорий
- Суффиксы файлов: `.test.ts` для тестов, `.config.ts` для конфигурации

---

## API Endpoints Reference

### Public Endpoints (No Auth)

```
GET /health          # Health check
GET /                # Dashboard
GET /openapi.json    # OpenAPI spec
GET /api-docs        # API documentation (Scalar)
```

### Protected Endpoints (Require Auth if API_KEY set)

```
# Character
GET  /api/v1/character
GET  /api/v1/character/stats
GET  /api/v1/character/skills

# Inventory
GET  /api/v1/inventory

# Target
GET  /api/v1/target
POST /api/v1/target/set
POST /api/v1/target/clear

# Nearby
GET  /api/v1/nearby/npcs
GET  /api/v1/nearby/players
GET  /api/v1/nearby/items

# Combat
POST /api/v1/combat/attack
POST /api/v1/combat/use-skill

# Movement
POST /api/v1/move/to
POST /api/v1/move/to-target
POST /api/v1/move/stop

# Chat
POST /api/v1/chat/say

# Party
GET  /api/v1/party
POST /api/v1/party/join
POST /api/v1/party/leave

# Connection
GET  /api/v1/status
POST /api/v1/connect
POST /api/v1/disconnect
POST /api/v1/reconnect

# Social
POST /api/v1/social/action
```

### WebSocket

```javascript
ws://localhost:3000/ws?token=<apiKey>

// Subscribe to channels
{ "type": "subscribe", "channels": ["character", "combat", "world"] }

// Available channels: system, character, combat, chat, world, movement, party
```

---

## Security Considerations

### API Security

- **Rate Limiting:** Настроены лимиты: 100 req/s общий, 10 move/s, 5 combat/s
- **CORS:** Включен для разработки, можно отключить через `API_CONFIG.enableCors`
- **Helmet:** CSP настроен для Scalar CDN и WebSocket

### Default Credentials

⚠️ **ВАЖНО:** Файл `src/config.ts` содержит захардкоженные учетные данные:
- Username: `qwerty`
- Password: `qwerty`
- API Key: `dev_api_key_change_in_production` (через env)

Всегда меняйте перед деплоем!

### Encryption

- Login credentials шифруются через RSA (1024-bit, NO_PADDING)
- Game traffic использует XOR encryption (может быть отключена)
- Blowfish ECB для Login Server фазы

---

## Debugging

### Log Levels

Установите через `LOG_LEVEL` environment variable или в коде:

```typescript
Logger.level = 'DEBUG'; // DEBUG | INFO | WARN | ERROR | SILENT
```

### Debug Files

- **`client_server_protocol.md`** — документация протокола (источник истины)
- **`DEBUG_HISTORY.md`** — история проблем и решений
- **`DEBUG_NOTES.md`** — общие советы по отладке

### Key Debug Patterns

```typescript
// Monitor state transitions
Logger.debug('STATE', `Transition: ${oldState} -> ${newState}`);

// Hex dump for packets
Logger.hex('PACKET', buffer);

// Event monitoring
EventBus.onAny((event) => {
    Logger.debug('EventBus', `[${event.channel}] ${event.type}`);
});
```

### Running API Without Game Connection

```bash
# Windows
$env:AUTO_CONNECT_GAME='false'; npm start

# Linux/macOS
AUTO_CONNECT_GAME=false npm start
```

---

## Important Files (Read-Only)

Следующие файлы являются источником истины и **НЕ ДОЛЖНЫ ИЗМЕНЯТЬСЯ** без крайней необходимости:

- `client_server_protocol.md` — спецификация протокола клиент-сервер

Код в `src/` должен соответствовать этой документации, а не наоборот.

---

## Documentation Files

| File | Purpose |
|------|---------|
| `readme.md` | User-facing README |
| `CLAUDE.md` | Guidance for Claude Code |
| `AGENTS.md` | This file — guidance for AI agents |
| `DOCUMENTATION.md` | Technical developer documentation |
| `client_server_protocol.md` | Protocol specification (source of truth) |
| `DEBUG_HISTORY.md` | Problem/solution history |
| `DEBUG_NOTES.md` | Debugging tips |

---

## Version History

- **0.2.1** — Added Dashboard
- **0.1.39** — Fixed disconnect/reconnect routes, added target endpoints
- **0.1.38** — Added REST + WebSocket API, GameStateStore, EventBus
- **0.1.33** — Initial commit. Automatic character login.

---

## Resources

- **GitHub:** https://github.com/gigabelka/l2ts-interlude-client-l2jmobius
- **Target Server:** https://gitlab.com/MobiusDevelopment/L2J_Mobius
- **Reference Client:** https://github.com/npetrovski/l2js-client
- **YouTube:** https://youtube.com/@lineage2interludeclientforl2jm
- **Telegram:** t.me/Lineage2InterludeClientForL2jm
