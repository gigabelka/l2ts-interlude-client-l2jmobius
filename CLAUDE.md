# CLAUDE.md

**Language:** Always respond to the user in Russian.

**IMPORTANT:** This file (CLAUDE.md) must always be written in English only.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **headless Lineage 2 client** for L2J Mobius CT_0_Interlude servers. It connects to a Login Server, authenticates with credentials, selects a character, enters the game world, and maintains a ping/pong keepalive connection.

**Target Server:** L2J_Mobius CT_0_Interlude (Protocol 746)
**Node.js:** 24.14.0

## Common Commands

```bash
npm install       # Install dependencies
npm run dev       # Run the client (silent logging)
npm run debug     # Run with verbose packet logging
npm run build     # Compile TypeScript to dist/
npm start         # Run production build

# Testing
npm test          # Run tests once
npm run test:watch # Run tests in watch mode
npm run test:ui   # Run Vitest UI
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint      # Check for linting errors
npm run lint:fix  # Auto-fix linting errors
npm run typecheck # Type checking without emit

# Data Export (requires L2J Mobius stats/ folder in project root)
npm run export:data # Full export: XML → JSON conversion + normalization

# Development
npm run clean     # Remove dist/ folder
npm run commit    # Bump version and commit changes
```

## Architecture

The project follows **Clean Architecture** principles with a layered approach:

### Clean Architecture Layers

- **Domain Layer** (`domain/`): Business entities, value objects, events, repository interfaces
- **Application Layer** (`application/`): Application services, use cases, port interfaces
- **Infrastructure Layer** (`infrastructure/`): Concrete implementations, packet processing, persistence
- **API Layer** (`api/`): REST endpoints, WebSocket server, middleware

### Dependency Injection

Uses a custom DI container (`config/di/`) with lazy initialization. All dependencies are resolved through the container using DI_TOKENS.

### Two-Phase Connection Model

The client uses FSM-driven clients for both connection phases:

#### Phase 1: Login Server (LoginClient)

- **Flow:** Init → GGAuth → AuthLogin → ServerList → PlayOk → disconnect
- **Crypto:** Static Blowfish for Init, dynamic Blowfish + XOR for rest, RSA for credentials
- **State Enum:** `LoginState` (IDLE, CONNECTING, WAIT_INIT, WAIT_GG_AUTH, WAIT_LOGIN_OK, WAIT_SERVER_LIST, WAIT_PLAY_OK, DONE, ERROR)

#### Phase 2: Game Server (GameClient)

- **Flow:** ProtocolVersion (0x00) → CryptInit (0x00) → AuthRequest (0x08) → CharSelectInfo (0x13) → CharacterSelected (0x0D) → CharSelected (0x15) → (0x9D + 0xD0-08-00 + EnterWorld 0x03) → UserInfo (0x04) → IN_GAME (ping/pong)
- **Crypto:** Encryption is disabled via flag sent in CryptInit.
- **State Enum:** `GameState` (IDLE, CONNECTING, WAIT_CRYPT_INIT, WAIT_CHAR_LIST, WAIT_CHAR_SELECTED, WAIT_USER_INFO, IN_GAME, ERROR)

### Event-Driven Architecture

Uses typed EventBus for loose coupling between components. Events are published from packet handlers and consumed by API layers.

### External APIs

- **REST API** (port 3000): HTTP endpoints for character control, combat, movement, inventory
- **WebSocket API**: Real-time game event streaming with channel-based subscriptions
- **Dashboard**: Web UI for monitoring client state and manual control

**CRITICAL:** The client strictly mimics the packet layout and padding observed in Wireshark captures to successfully connect.

## Directory Structure

```
src/
├── index.ts                    # Entry point with DI container bootstrap
├── config/                     # Configuration and DI container
├── api/                        # REST API + WebSocket server
│   ├── routes/                # HTTP endpoints (character, combat, movement)
│   ├── middleware/            # Authentication, rate limiting
│   └── ws/                    # WebSocket server
├── domain/                     # Business logic layer
│   ├── entities/              # Character, Npc, Item domain entities
│   ├── value-objects/         # Position, Vitals, Stats immutable objects
│   ├── events/                # Domain events (typed)
│   └── repositories/          # Repository interfaces
├── application/                # Application service layer
│   └── ports/                 # Interface definitions (IEventBus, etc.)
├── infrastructure/             # Implementation layer
│   ├── persistence/           # In-memory repository implementations
│   ├── event-bus/             # EventBus implementation
│   ├── protocol/game/         # Packet processing with Factory+Strategy patterns
│   └── integration/           # Legacy integration adapters
├── ui/                         # Dashboard UI components
├── logger/                     # Logging with hex dump utilities
├── network/                    # TCP connection with L2 packet framing
├── crypto/                     # Blowfish, XOR, RSA implementations
├── login/                      # Login server client + packets
│   ├── LoginClient.ts
│   ├── LoginCrypt.ts
│   └── packets/               # incoming/outgoing login packets
├── game/                       # Game server client + packets
│   ├── GameClient.ts
│   ├── GameCrypt.ts           # XOR encryption
│   └── packets/               # incoming/outgoing game packets
└── data/                       # Exported game data (items, NPCs, skills)
    └── export/                # JSON data from L2J Mobius XML
```

## Key Implementation Details

- **Packet framing:** Each L2 packet starts with uint16LE length (including the 2-byte header)
- **Two crypto systems:** Login uses Blowfish ECB (NewCrypt → BlowfishEngine), Game uses XOR (GameCrypt)
- **RSA encryption:** 1024-bit with NO_PADDING, modulus must be unscrambled first using ScrambledRSAKey
- **Packet format types:** C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated string
- **Game Server ProtocolVersion:** Uses opcode 0x00 (NOT 0x0B), confirmed from working Wireshark capture

## Configuration

The project uses environment variables via `.env` file:

```bash
# L2 Server Connection
L2_LOGIN_IP=192.168.0.33         # Login server IP address
L2_LOGIN_PORT=2106               # Login server port
L2_GAME_PORT=7777                # Game server port
L2_USERNAME=your_login           # Game account login
L2_PASSWORD=your_password        # Game account password
L2_SERVER_ID=2                   # Server ID from server list
L2_CHAR_SLOT=0                   # Character slot (0-based index)

# API
API_KEY=                         # API authentication key (empty = no auth)
API_PORT=3000                    # API server port

# Logging
LOG_LEVEL=ERROR                  # DEBUG, INFO, WARN, ERROR, SILENT
AUTO_CONNECT_GAME=true           # Auto-connect on startup
```

Copy `.env.example` to `.env` and configure your settings.

## Data Export

The project can export game data from L2J Mobius server XML files:

1. **Download L2J_Mobius CT_0 Interlude** from GitLab
2. **Copy `data/stats` folder** from server to project root (next to `package.json`)
3. **Run export command**: `npm run export:data`

Exported data is saved to `src/data/export/` in JSON format (items, NPCs, skills, armorsets, etc.).

## Documentation Source of Truth

**IMPORTANT:** The following files are the single source of truth and **MUST NOT BE EDITED**:

- `docs/client_server_protocol.md` — client-server protocol documentation

All information about protocol, packet formats and crypto must be taken exclusively from these files. Code in `src/` must match them, not the other way around.

**docs/DOCUMENTATION.md** is a documentation file that must always be kept up to date. It must be regularly updated based on newly received information. This file should contain the most current and accurate information about the project.

## Debugging

- Use `npm run debug` for verbose packet logging (instead of manually setting Logger.level)
- Monitor `[STATE]` log lines to track FSM transitions
- Use `npm run test:watch` for TDD development
- Check Dashboard at `http://localhost:3000` for real-time client state
- WebSocket events can be monitored via browser DevTools or WebSocket clients
- Check `docs/client_server_protocol.md` for detailed packet formats and crypto specifications

## API Access

- **REST API**: `http://localhost:3000/api/v1/*`
- **WebSocket**: `ws://localhost:3000/ws`
- **API Documentation**: `http://localhost:3000/api-docs`
- **Dashboard**: `http://localhost:3000`
- **Detailed API Reference**: See README.md for full endpoint documentation

## Adding New Packets

The project uses Factory + Strategy pattern for packet processing:

1. **Create Packet DTO** in `infrastructure/protocol/game/packets/` with `decode()` method
2. **Create Handler** in `infrastructure/protocol/game/handlers/` extending `BasePacketHandlerStrategy`
3. **Register in PacketRegistry** - add to `PACKET_REGISTRY` array with opcode mapping
4. **Add Event Types** in `core/EventBus.ts` if emitting new events

Handlers receive dependencies via DI (characterRepo, worldRepo, eventBus) and should:
- Check `canHandleInState()` for valid game states
- Update domain repositories
- Publish typed events via EventBus
