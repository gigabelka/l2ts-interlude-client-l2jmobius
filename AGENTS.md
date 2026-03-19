# L2 Headless Client — Agent Guide

This file provides essential information for AI coding agents working on this project.

## Project Overview

**L2 Headless Client** is a TypeScript/Node.js bot client for Lineage 2 Interlude game servers. It connects to L2J Mobius CT_0_Interlude servers, authenticates, enters the game world, and provides a REST + WebSocket API for external control.

- **Target Server:** L2J_Mobius CT_0_Interlude (Protocol 746)
- **Node.js Version:** >= 24.14.0
- **License:** MIT

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.9.3 |
| Runtime | Node.js 24.14.0+ |
| Build | tsc (CommonJS output) |
| Testing | Vitest |
| Linting | ESLint with TypeScript |
| API Framework | Express.js 5.x |
| WebSocket | ws library |
| Validation | Zod |
| DI Container | Custom implementation |

## Architecture Overview

The project follows **Clean Architecture** principles with clear separation:

```
src/
├── index.ts                    # Entry point
├── config.ts                   # Environment configuration
├── config/di/                  # Dependency Injection container
│   ├── Container.ts            # DI container implementation
│   ├── appContainer.ts         # Singleton container instance
│   └── composition.ts          # Service registration
│
├── domain/                     # Domain Layer (business logic)
│   ├── entities/               # Character, Npc, Item
│   ├── value-objects/          # Position, Vitals, Stats, Experience
│   ├── events/                 # Domain events
│   └── repositories/           # Repository interfaces
│
├── application/                # Application Layer
│   └── ports/                  # Interfaces (IEventBus, IPacketProcessor, etc.)
│
├── infrastructure/             # Infrastructure Layer
│   ├── persistence/            # In-memory repository implementations
│   ├── event-bus/              # SimpleEventBus implementation
│   └── protocol/game/          # Packet processing (Factory + Strategy)
│       ├── packets/            # DTOs for incoming packets
│       ├── handlers/           # Strategy handlers
│       └── PacketRegistry.ts   # Centralized packet registration
│
├── api/                        # API Layer
│   ├── ApiServer.ts            # Express REST server
│   ├── routes/                 # API endpoints
│   ├── middleware/             # Auth, rate limiting
│   └── ws/WsServer.ts          # WebSocket server
│
├── network/                    # TCP & Packet Layer
│   ├── Connection.ts           # TCP client with L2 framing
│   ├── PacketReader.ts         # Binary reader (little-endian)
│   └── PacketWriter.ts         # Binary writer
│
├── crypto/                     # Encryption
│   ├── BlowfishEngine.ts       # Blowfish ECB
│   ├── RSACrypt.ts             # RSA (1024-bit, NO_PADDING)
│   ├── NewCrypt.ts             # Blowfish + checksum + XOR
│   └── ScrambledRSAKey.ts      # RSA modulus unscrambling
│
├── login/                      # Login Server Phase
│   ├── LoginClient.ts          # FSM-driven login client
│   ├── LoginCrypt.ts           # Login crypto
│   └── packets/                # Login packets
│
├── game/                       # Game Server Phase
│   ├── GameClient.ts           # FSM-driven game client
│   ├── GameCrypt.ts            # XOR encryption
│   ├── GameCommandManager.ts   # Command manager
│   └── packets/                # Game packets
│
├── logger/                     # Logging utilities
└── ui/                         # Dashboard UI
```

## Build and Run Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Run with ts-node (auto-connects to game)
npm run debug        # Verbose packet logging (LOG_LEVEL=DEBUG)

# Build & Production
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled code
npm run clean        # Remove dist/

# Testing
npm test             # Run all tests once
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI
npm run test:coverage # Coverage report

# Code Quality
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix linting errors
npm run typecheck    # TypeScript type check only

# Data Export (from L2J_Mobius XML files)
npm run export:data  # Full XML → JSON conversion
```

## Configuration

Create `.env` file (copy from `.env.example`):

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

## Key Implementation Details

### Two-Phase Connection Model

**Phase 1: Login Server**
```
IDLE → CONNECTING → WAIT_INIT → WAIT_GG_AUTH → WAIT_LOGIN_OK → 
WAIT_SERVER_LIST → WAIT_PLAY_OK → DONE
```
- Encryption: Static Blowfish → Dynamic Blowfish + XOR → RSA for credentials

**Phase 2: Game Server**
```
IDLE → CONNECTING → WAIT_CRYPT_INIT → WAIT_CHAR_LIST → 
WAIT_CHAR_SELECTED → WAIT_USER_INFO → IN_GAME
```
- Encryption: XOR (can be disabled via CryptInit flag)

### Packet Format

- Each L2 packet starts with `uint16LE` length (including 2-byte header)
- Data types: C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated

### Adding New Packets

1. Create Packet DTO in `src/infrastructure/protocol/game/packets/`
2. Create Handler in `src/infrastructure/protocol/game/handlers/`
3. Register in `src/infrastructure/protocol/game/PacketRegistry.ts`
4. Add event type to `src/core/EventBus.ts` (if new event)

Example packet structure:
```typescript
export class MyPacket implements IIncomingPacket {
    readonly opcode = 0xXX;
    
    decode(reader: IPacketReader): this {
        // Read packet data
        return this;
    }
}
```

## Testing Strategy

- **Test Location:** `tests/` directory
- **Pattern:** `**/*.test.ts`
- **Setup:** `tests/setup.ts`
- **Coverage:** HTML, JSON, text reports

Test categories:
- Unit tests: Domain entities, value objects
- Integration tests: Packet encoding/decoding
- Infrastructure tests: Repositories, EventBus

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2022
- **Module:** CommonJS
- **Strict mode:** Enabled
- **Path aliases:**
  - `@/*` → `src/*`
  - `@domain/*` → `src/domain/*`
  - `@application/*` → `src/application/*`
  - `@infrastructure/*` → `src/infrastructure/*`
  - `@shared/*` → `src/shared/*`

### Naming Conventions

- Classes/Interfaces: PascalCase
- Methods/Properties: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: PascalCase for classes, camelCase for utilities

### ESLint Rules

- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-unused-vars`: warn (ignores `_` prefix)
- `@typescript-eslint/no-non-null-assertion`: off
- `prefer-const`: off

### Code Organization

- One class/interface per file
- Use `index.ts` for clean exports from directories
- Prefer interfaces over type aliases for public APIs
- Use `readonly` for immutable properties

## API Endpoints

### Public (No Auth)
- `GET /health` - Health check
- `GET /` - Dashboard
- `GET /api-docs` - API documentation

### Protected Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/status` | GET | Connection status |
| `/api/v1/character` | GET | Character state |
| `/api/v1/character/stats` | GET | Character stats |
| `/api/v1/character/skills` | GET | Character skills |
| `/api/v1/inventory` | GET | Inventory contents |
| `/api/v1/target` | GET/POST | Target management |
| `/api/v1/combat/attack` | POST | Attack target |
| `/api/v1/combat/use-skill` | POST | Use skill |
| `/api/v1/move/to` | POST | Move to position |
| `/api/v1/nearby/npcs` | GET | Nearby NPCs |
| `/api/v1/chat/say` | POST | Send chat message |
| `/api/v1/connect` | POST | Connect to game |
| `/api/v1/disconnect` | POST | Disconnect |

### Rate Limits

- Movement commands: 10 req/s
- Combat commands: 5 req/s
- General read: 100 req/s

## Documentation Files

| File | Purpose |
|------|---------|
| `docs/DOCUMENTATION.md` | Full API documentation (Russian) |
| `docs/client_server_protocol.md` | Protocol specification (SOURCE OF TRUTH) |
| `CLAUDE.md` | Claude Code guidance |
| `readme.md` | User-facing README |

**Important:** `docs/client_server_protocol.md` is the single source of truth for protocol details. Do not modify it. Code in `src/` must match the protocol documentation.

## Security Considerations

- Credentials stored in `.env` (gitignored)
- API key authentication optional (`API_KEY` in config)
- Rate limiting on sensitive endpoints
- Helmet middleware for HTTP security headers
- CORS enabled for API access

## Common Issues

1. **Connection fails:** Check server IP/port in `.env`
2. **Protocol mismatch:** Ensure server uses Protocol 746
3. **Login fails:** Verify credentials and ServerId
4. **Packet errors:** Check `docs/client_server_protocol.md` for format

## Language Notes

- Comments in source code are primarily in **Russian**
- This AGENTS.md file must be in **English**
- User-facing documentation is in Russian
