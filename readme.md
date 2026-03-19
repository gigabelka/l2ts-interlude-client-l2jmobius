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
- ✅ **Dependency Injection** — Custom DI container with Result<T,E> monad
- ✅ **Zod Validation** — Runtime configuration validation

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
LOG_LEVEL=ERROR                  # Logging level
AUTO_CONNECT_GAME=true           # Auto-connect on startup
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

# Run tests with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
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
├── config/                # Configuration and DI container
│   ├── config.ts          # Environment config with Zod validation
│   └── di/                # Dependency Injection container
│       ├── Container.ts   # DI container implementation
│       ├── appContainer.ts # Singleton instance
│       └── composition.ts # Service registration
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
│   └── network/           # PacketSerializer, BufferPool
│
├── network/               # TCP & Packet Layer
│   ├── Connection.ts      # TCP client with L2 framing
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
│   ├── LoginCrypt.ts      # Login crypto (Blowfish + XOR)
│   └── packets/           # Login packets (incoming/outgoing)
│
├── game/                  # Game Server Phase
│   ├── GameClient.ts      # FSM-driven game client
│   ├── GameCrypt.ts       # XOR encryption (disabled for CT0)
│   └── packets/           # Game packets (incoming/outgoing)
│
└── data/                  # Game data (items, NPCs, skills)
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

- **Encryption**: XOR encryption (disabled via CryptInit flag for L2J Mobius CT0)

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

**Connection**
```bash
GET  /api/v1/status              # Get connection status
POST /api/v1/connect             # Connect to game
POST /api/v1/disconnect          # Disconnect from game
POST /api/v1/reconnect           # Reconnect to game
```

**Character**
```bash
GET  /api/v1/character           # Get character state
GET  /api/v1/character/stats     # Get character stats
GET  /api/v1/character/skills    # Get character skills
GET  /api/v1/character/buffs     # Get active buffs
```

**Inventory**
```bash
GET  /api/v1/inventory           # Get inventory contents
POST /api/v1/inventory/use       # Use item
POST /api/v1/inventory/drop      # Drop item
```

**Target & Combat**
```bash
GET  /api/v1/target              # Get current target
POST /api/v1/target/set          # Set target { "objectId": 123 }
POST /api/v1/target/clear        # Clear target
POST /api/v1/target/next         # Target next NPC
POST /api/v1/combat/attack       # Attack target
POST /api/v1/combat/stop         # Stop attack
POST /api/v1/combat/use-skill    # Use skill
```

**Movement**
```bash
POST /api/v1/move/to             # Move to position { "x": 83500, "y": 54000, "z": -1490 }
POST /api/v1/move/stop           # Stop movement
GET  /api/v1/move/status         # Get movement status
POST /api/v1/move/follow         # Follow target
```

**Nearby Entities**
```bash
GET  /api/v1/nearby/npcs?radius=600&attackable=true  # Get nearby NPCs
GET  /api/v1/nearby/players                          # Get nearby players
GET  /api/v1/nearby/items                            # Get dropped items
POST /api/v1/pickup                                  # Pick up item
```

**Chat**
```bash
POST /api/v1/chat/send           # Send message { "channel": "ALL", "message": "Hello" }
GET  /api/v1/chat/history        # Get chat history
```

**Party**
```bash
GET  /api/v1/party               # Get party info
POST /api/v1/party/invite        # Invite to party
POST /api/v1/party/leave         # Leave party
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

**Event Format:**
```json
{
  "type": "character.stats_changed",
  "channel": "character",
  "data": {
    "hp": { "current": 1100, "max": 1500, "delta": -100 }
  },
  "timestamp": "2025-03-14T12:00:00.000Z"
}
```

---

## 📝 Adding New Packets

To add support for a new incoming packet, follow these steps:

### 1. Create the Packet DTO

Create a new file in `src/infrastructure/protocol/game/packets/`:

```typescript
import type { IPacketReader, IIncomingPacket } from '../../../../application/ports';

export interface MyNewData {
    objectId: number;
    value: number;
    name: string;
}

export class MyNewPacket implements IIncomingPacket {
    readonly opcode = 0xXX;
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
import { BasePacketHandlerStrategy } from '../GamePacketProcessor';
import type { PacketContext, IPacketReader } from '../../../../application/ports';
import type { IEventBus } from '../../../../application/ports';
import type { ICharacterRepository } from '../../../../domain/repositories';
import { MyNewPacket } from '../packets/MyNewPacket';

export class MyNewHandler extends BasePacketHandlerStrategy<MyNewPacket> {
    constructor(
        eventBus: IEventBus,
        private characterRepo: ICharacterRepository
    ) {
        super(0xXX, eventBus);
    }

    protected canHandleInState(state: string): boolean {
        return state === 'IN_GAME';
    }

    handle(context: PacketContext, reader: IPacketReader): void {
        const packet = new MyNewPacket();
        packet.decode(reader);
        const data = packet.getData();

        // Update repository
        this.characterRepo.update((char) => {
            // ... update logic
            return char;
        });

        // Publish event
        this.eventBus.publish({
            type: 'character.my_event',
            channel: 'character',
            data: { value: data.value },
            timestamp: new Date().toISOString()
        });
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
        repositories: ['character'],
        description: 'MyNewPacket - description',
    },
];
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
npm run test:coverage # Coverage report
```

### Code Style

The project uses ESLint with TypeScript support:

```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Fix auto-fixable errors
```

---

## 📖 Documentation

- **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)** — Technical developer documentation (Russian)
- **[docs/client_server_protocol.md](docs/client_server_protocol.md)** — Protocol specification (source of truth)
- **[AGENTS.md](AGENTS.md)** — Guide for AI coding agents

---

## 🌐 Resources

- **GitHub**: https://github.com/gigabelka/l2ts-interlude-client-l2jmobius
- **Target Server**: https://gitlab.com/MobiusDevelopment/L2J_Mobius
- **Reference Client**: https://github.com/npetrovski/l2js-client

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [L2J_Mobius](https://gitlab.com/MobiusDevelopment/L2J_Mobius) — Server reference for packet formats
- [l2js-client](https://github.com/npetrovski/l2js-client) — Client reference implementation
