# L2 Headless Client for L2J_Mobius_CT_0_Interlude

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D24.14.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A headless Lineage 2 bot client with **REST + WebSocket API** written in TypeScript. Connects to the Login Server, authenticates with credentials, selects a character, enters the game world, and provides a full external API for control and monitoring.

This client is designed for the [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude) server (Protocol 746).

---

## 📋 Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running](#running)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Adding New Packets](#adding-new-packets)
- [Development](#development)
- [Resources](#resources)

---

## ✨ Features

- ✅ **Automatic Authentication** — Login Server → Game Server seamless flow
- ✅ **Character Management** — Automatic character selection and world entry
- ✅ **Keepalive Connection** — Automatic ping/pong handling
- ✅ **REST API** — HTTP endpoints for state and control
- ✅ **WebSocket API** — Real-time game events streaming
- ✅ **State Store** — Central game state management
- ✅ **Event Bus** — Typed event system for loose coupling
- ✅ **Clean Architecture** — Domain-driven design with separation of concerns
- ✅ **Dashboard** — Web UI for monitoring client state

---

## 📦 Requirements

- **Node.js**: LTS 24.14.0 or higher
- **npm**: Comes with Node.js
- **TypeScript**: 5.9.3 (installed automatically)

---

## 🚀 Installation

```bash
# Clone the repository
git clone <repository-url>
cd l2ts-interlude-client-l2jmobius

# Install dependencies
npm install

# Build the project
npm run build
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your server address, credentials, and character slot:

```bash
# L2 Server Connection
L2_LOGIN_IP=192.168.0.33         # Login server IP address
L2_LOGIN_PORT=2106               # Login server port (default: 2106)
L2_GAME_PORT=7777                # Game server port (default: 7777)
L2_USERNAME=your_login           # Your game account login
L2_PASSWORD=your_password        # Your game account password
L2_SERVER_ID=2                   # Server ID from server list
L2_CHAR_SLOT=0                   # Character slot (0-based index)
L2_PROTOCOL=746                  # Interlude protocol version

# API
API_KEY=                         # API authentication key (empty = no auth)
API_PORT=3000                    # API server port
```

> **Note:** `.env` file is gitignored. Never commit your credentials!

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `L2_LOGIN_IP` | Login server IP address | `127.0.0.1` |
| `L2_LOGIN_PORT` | Login server port | `2106` |
| `L2_GAME_PORT` | Game server port | `7777` |
| `L2_USERNAME` | Game account login | *(required)* |
| `L2_PASSWORD` | Game account password | *(required)* |
| `L2_SERVER_ID` | Server ID from server list | `1` |
| `L2_CHAR_SLOT` | Character slot index | `0` |
| `L2_PROTOCOL` | Protocol version | `746` |
| `API_PORT` | API server port | `3000` |
| `API_KEY` | API authentication key | `""` |
| `LOG_LEVEL` | Logging level: `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT` | `ERROR` |
| `AUTO_CONNECT_GAME` | Auto-connect to game server on startup | `true` |
| `NODE_ENV` | Environment mode | `development` |

---

## 🏃 Running

```bash
# Development mode (hot reload)
npm run dev

# Debug mode (verbose packet logging)
npm run debug

# Build for production
npm run build

# Start production build
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 📦 Data Export

Скрипты для экспорта игровых данных (предметы, NPC, скиллы, сеты брони и др.) из сервера L2J Mobius.

### Требования

Перед использованием скриптов необходимо получить исходные XML-данные с сервера:

1. **Скачайте сервер L2J_Mobius CT_0 Interlude:**
   ```
   https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude
   ```

2. **Скопируйте папку `data/stats`** из сервера в корень проекта (рядом с `package.json`).
   В результате должна появиться папка `stats/` с подпапками: `items/`, `npcs/`, `skills/` и др.

### Использование

```bash
# Полный экспорт (конвертация XML → JSON → нормализация)
npm run export:data

# Или пошагово:
node scripts/export-xml.js        # Конвертация XML в database.json
node scripts/normalize-database.js # Нормализация в удобную структуру
node scripts/export-stats.js       # Альтернативный полный экспорт
```

### Результат

Нормализованные данные сохраняются в `src/data/export/`:

| Файл | Описание |
|------|----------|
| `armorsets/armorsets.json` | Сеты брони со статами и бонусами |
| `items/items.json` | Все предметы (оружие, броня, расходники) |
| `npcs/npcs.json` | NPC с параметрами и дропом |
| `skills/skills.json` | Скиллы с эффектами |
| `players/skillTrees.json` | Деревья умений по классам |
| `players/classTemplates.json` | Стартовые статы и предметы классов |
| `pets/pets.json` | Данные питомцев |
| `fishing/fishing.json` | Рыбалка (удочки, рыбы, монстры) |
| `henna.json` | Хенна (татуировки) |
| `augmentation/augmentation.json` | Аугментация оружия |

---

## 🏗️ Architecture

The project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── api/                    # REST API Layer (Express.js)
│   ├── routes/            # API endpoints (character, combat, movement, etc.)
│   ├── middleware/        # Auth, rate limiting, request ID
│   └── ws/                # WebSocket server for real-time events
│
├── core/                  # Core Architecture (Legacy)
│   ├── EventBus.ts        # Typed EventEmitter for real-time events
│   └── GameStateStore.ts  # Central state store (singleton)
│
├── domain/                # Domain Layer (Clean Architecture)
│   ├── entities/          # Character, Npc, Item (business objects)
│   ├── value-objects/     # Position, Vitals, ObjectId (immutable)
│   ├── events/            # Domain events (CharacterEnteredGame, etc.)
│   └── repositories/      # Repository interfaces
│
├── application/           # Application Layer (Clean Architecture)
│   └── ports/             # Interfaces (IEventBus, IPacketProcessor, etc.)
│
├── infrastructure/        # Infrastructure Layer (Clean Architecture)
│   ├── persistence/       # In-memory repository implementations
│   ├── event-bus/         # SimpleEventBus implementation
│   ├── protocol/game/     # Packet processing (Factory + Strategy patterns)
│   │   ├── packets/       # DTOs (UserInfoPacket, NpcInfoPacket, etc.)
│   │   ├── handlers/      # Strategy handlers
│   │   └── PacketRegistry.ts  # Centralized packet registration
│   └── integration/       # Adapters for legacy integration
│
├── network/               # TCP & Packet Layer
│   ├── Connection.ts      # Abstract TCP client with L2 framing
│   ├── PacketReader.ts    # Binary reader (little-endian)
│   └── PacketWriter.ts    # Binary writer (little-endian)
│
├── crypto/                # Encryption Layer
│   ├── BlowfishEngine.ts  # Blowfish ECB implementation
│   ├── RSACrypt.ts        # RSA encryption (1024-bit, NO_PADDING)
│   └── NewCrypt.ts        # Blowfish wrapper with checksum
│
├── login/                 # Login Server Phase
│   ├── LoginClient.ts     # FSM-driven login client
│   └── packets/           # Login packets (incoming/outgoing)
│
└── game/                  # Game Server Phase
    ├── GameClient.ts      # FSM-driven game client
    ├── GameCrypt.ts       # XOR encryption
    └── packets/           # Game packets (incoming/outgoing)
```

### Two-Phase Connection Model

The client uses a Finite State Machine (FSM) for both phases:

#### Phase 1: Login Server (LoginClient)
```
IDLE → CONNECTING → WAIT_INIT → WAIT_GG_AUTH → WAIT_LOGIN_OK → 
WAIT_SERVER_LIST → WAIT_PLAY_OK → DONE
```

- **Encryption**: Static Blowfish → Dynamic Blowfish + XOR → RSA for credentials

#### Phase 2: Game Server (GameClient)
```
IDLE → CONNECTING → WAIT_CRYPT_INIT → WAIT_CHAR_LIST → 
WAIT_CHAR_SELECTED → WAIT_USER_INFO → IN_GAME
```

- **Encryption**: XOR encryption (can be disabled via CryptInit flag)

### Packet Processing Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   TCP Data  │───▶│  Connection │───▶│    Crypt    │───▶│   Factory   │
│   (Stream)  │    │  (Framing)  │    │ (Decrypt)   │    │ (Parse)     │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                 │
                    ┌─────────────┐    ┌─────────────┐          │
                    │  EventBus   │◀───│   Handler   │◀─────────┘
                    │  (Emit)     │    │  (Strategy) │
                    └──────┬──────┘    └─────────────┘
                           │
                    ┌──────▼──────┐
                    │ WebSocket   │
                    │ (Broadcast) │
                    └─────────────┘
```

---

## 📚 API Documentation

### REST Endpoints

#### Public Endpoints (No Auth)

```bash
GET /health          # Health check
GET /                # Dashboard
GET /openapi.json    # OpenAPI spec
GET /api-docs        # API documentation (Scalar)
```

#### Protected Endpoints

**Character**
```bash
GET  /api/v1/character           # Get character state
GET  /api/v1/character/stats     # Get character stats
GET  /api/v1/character/skills    # Get character skills
```

**Inventory**
```bash
GET  /api/v1/inventory           # Get inventory contents
```

**Target & Combat**
```bash
GET  /api/v1/target              # Get current target
POST /api/v1/target/set          # Set target { "objectId": 123 }
POST /api/v1/target/clear        # Clear target
POST /api/v1/combat/attack       # Attack target { "objectId": 123 }
POST /api/v1/combat/use-skill    # Use skill { "skillId": 123, "targetId": 456 }
```

**Movement**
```bash
POST /api/v1/move/to             # Move to position { "x": 83500, "y": 54000, "z": -1490 }
POST /api/v1/move/to-target      # Move to target { "objectId": 123 }
POST /api/v1/move/stop           # Stop movement
```

**Nearby Entities**
```bash
GET  /api/v1/nearby/npcs?radius=600&attackable=true  # Get nearby NPCs
GET  /api/v1/nearby/players                          # Get nearby players
GET  /api/v1/nearby/items                            # Get dropped items
```

**Chat**
```bash
POST /api/v1/chat/say            # Say message { "message": "Hello" }
```

**Connection**
```bash
GET  /api/v1/status              # Get connection status
POST /api/v1/connect             # Connect to game
POST /api/v1/disconnect          # Disconnect from game
POST /api/v1/reconnect           # Reconnect to game
```

### WebSocket API

Connect to WebSocket for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=your_api_key');

ws.onopen = () => {
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'world', 'movement', 'chat']
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`[${msg.channel}] ${msg.type}:`, msg.data);
};
```

**Available Channels**: `system`, `character`, `combat`, `chat`, `world`, `movement`, `party`, `inventory`

---

## 📝 Adding New Packets

To add support for a new incoming packet, follow these steps:

### 1. Create the Packet DTO

Create a new file in `src/infrastructure/protocol/game/packets/`:

```typescript
// src/infrastructure/protocol/game/packets/MyNewPacket.ts

import type { IPacketReader } from '../../../../application/ports';
import type { IIncomingPacket } from '../../../../application/ports';

/**
 * Данные пакета MyNewPacket
 */
export interface MyNewData {
    objectId: number;
    value: number;
    name: string;
}

/**
 * Пакет MyNewPacket (0xXX)
 * Описание назначения пакета
 */
export class MyNewPacket implements IIncomingPacket {
    readonly opcode = 0xXX;  // Замените на реальный opcode
    private data!: MyNewData;

    decode(reader: IPacketReader): this {
        const objectId = reader.readInt32LE();
        const value = reader.readInt32LE();
        const name = reader.readStringUTF16();

        this.data = { objectId, value, name };
        return this;
    }

    getData(): MyNewData {
        return { ...this.data };
    }
}
```

### 2. Create the Handler

Create a handler in `src/infrastructure/protocol/game/handlers/`:

```typescript
// src/infrastructure/protocol/game/handlers/MyNewHandler.ts

import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { PacketContext, IPacketReader } from '../../../../application/ports';
import type { IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { MyNewPacket } from '../packets/MyNewPacket';
import { Result } from '../../../../shared/result';

export class MyNewHandler extends BasePacketHandlerStrategy<MyNewPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0xXX, eventBus); // Должен совпадать с opcode в пакете
    }

    protected canHandleInState(state: string): boolean {
        // Обрабатываем только в игре
        return state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        // Декодируем пакет
        const packet = new MyNewPacket();
        packet.decode(reader);
        const data = packet.getData();

        // Бизнес-логика: обновляем состояние
        const character = this.characterRepo.get();
        if (character && character.id.value === data.objectId) {
            // Обновляем персонажа
            this.characterRepo.update((char) => {
                // ... логика обновления
                return char;
            });

            // Публикуем событие
            this.eventBus.publish({
                type: 'character.my_event',
                channel: 'character',
                data: { value: data.value },
                timestamp: new Date().toISOString()
            });
        }
    }
}
```

### 3. Register in PacketRegistry

Add the packet to `src/infrastructure/protocol/game/PacketRegistry.ts`:

```typescript
import { MyNewPacket } from './packets/MyNewPacket';
import { MyNewHandler } from './handlers/MyNewHandler';

const PACKET_REGISTRY: PacketConfig[] = [
    // ... existing packets ...
    {
        opcode: 0xXX,
        packetClass: MyNewPacket,
        handlerClass: MyNewHandler,
        repositories: ['character'], // или ['world'], ['inventory'], и т.д.
        description: 'MyNewPacket - описание пакета',
    },
];
```

### 4. Add Event Type (Optional)

If your packet emits new events, add them to `src/core/EventBus.ts`:

```typescript
export interface MyNewEvent extends BaseEvent {
    type: 'character.my_event';
    channel: 'character';
    data: {
        value: number;
    };
}

// Add to GameEvent union type
export type GameEvent = 
    | ... 
    | MyNewEvent;
```

That's it! The packet will be automatically registered and processed when received.

---

## 🔧 Development

### Project Structure Conventions

- **One class/interface per file** — Keep files focused and small
- **Index files** — Use `index.ts` for clean exports from directories
- **Naming**: PascalCase for classes/interfaces, camelCase for methods
- **Tests**: Co-locate tests with `.test.ts` suffix

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
```

### Code Style

The project uses ESLint with TypeScript support:

```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Fix auto-fixable errors
```

---

## 📖 Documentation

- **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)** — Technical developer documentation
- **[docs/client_server_protocol.md](docs/client_server_protocol.md)** — Protocol specification (source of truth)

---

## 🌐 Resources

- **GitHub**: https://github.com/gigabelka/l2ts-interlude-client-l2jmobius
- **Target Server**: https://gitlab.com/MobiusDevelopment/L2J_Mobius
- **Reference Client**: https://github.com/npetrovski/l2js-client
- **YouTube**: https://youtube.com/@lineage2interludeclientforl2jm
- **Telegram**: t.me/Lineage2InterludeClientForL2jm

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [L2J_Mobius](https://gitlab.com/MobiusDevelopment/L2J_Mobius) — Server reference for packet formats
- [l2js-client](https://github.com/npetrovski/l2js-client) — Client reference implementation
