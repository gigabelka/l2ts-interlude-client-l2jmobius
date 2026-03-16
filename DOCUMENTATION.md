# L2 Headless Client — Developer Documentation

## Overview

Headless Lineage 2 client for **L2J Mobius CT_0_Interlude** servers. Connects via TCP, authenticates through the Login Server, selects a character on the Game Server, and enters the game world with ping/pong keepalive.

**Target server:** L2J_Mobius CT_0_Interlude (https://gitlab.com/MobiusDevelopment/L2J_Mobius)
**Protocol version:** 746 (Interlude)
**Reference client:** https://github.com/npetrovski/l2js-client
**Node.js:** 20+

---

## Architecture

```
src/
├── index.ts              Entry point: LoginClient → GameClient + API Server
├── config.ts             Server address, credentials, character slot, API config
├── core/
│   ├── EventBus.ts       Typed EventEmitter for real-time events
│   └── GameStateStore.ts Central state store for character, world, inventory, combat
├── api/
│   ├── ApiServer.ts      Express REST API server
│   ├── ws/
│   │   └── WsServer.ts   WebSocket server for real-time events
│   ├── middleware/       Auth, rate limiting, request ID
│   └── routes/           API endpoints (status, character, combat, etc.)
├── logger/Logger.ts      Logging with levels, hex dump, crypto/state/packet helpers
├── network/
│   ├── Connection.ts     Abstract TCP client with L2 packet framing (uint16LE length prefix)
│   ├── PacketReader.ts   Binary reader for game server packets (little-endian)
│   └── PacketWriter.ts   Binary writer for game server packets (little-endian)
├── crypto/
│   ├── RSACrypt.ts       RSA encryption for login credentials (1024-bit, NO_PADDING)
│   ├── ScrambledRSAKey.ts Unscramble RSA modulus from Init packet (4-step XOR+swap)
│   ├── NewCrypt.ts       Blowfish ECB wrapper + L2 checksum + rolling XOR
│   └── BlowfishEngine.ts Pure TypeScript Blowfish implementation (used by NewCrypt)
├── login/
│   ├── LoginClient.ts    FSM login flow: Init→GGAuth→AuthLogin→ServerList→PlayOk
│   ├── LoginCrypt.ts     Login crypto: static key for Init, dynamic key for rest
│   ├── LoginPacketHandler.ts Opcode router for login server packets
│   ├── types.ts          LoginConfig, SessionData, LoginState enum
│   └── packets/
│       ├── incoming/     InitPacket, GGAuthPacket, LoginOkPacket, LoginFailPacket,
│       │                ServerListPacket, PlayOkPacket, PlayFailPacket
│       └── outgoing/     RequestGGAuth, RequestAuthLogin, RequestServerList,
│                         RequestServerLogin
└── game/
    ├── GameClient.ts      FSM game flow: CryptInit→Auth→CharSelect→EnterWorld→InGame
    ├── GameCrypt.ts       XOR encryption (enabled/disabled based on CryptInit flag)
    ├── GamePacketHandler.ts Opcode router for game server packets
    ├── GameState.ts       GameState enum
    └── packets/
        ├── incoming/      CryptInitPacket, CharSelectInfoPacket, CharSelectedPacket,
        │                 SSQInfoPacket, ExSendManorListPacket, QuestListPacket,
        │                 UserInfoPacket, NetPingRequestPacket
        └── outgoing/     ProtocolVersion, AuthRequest, CharacterSelected,
                          RequestManorList, RequestQuestList, RequestKeyMapping,
                          EnterWorld, NetPing, EnterGameServer
```

---

## API Layer (REST + WebSocket)

The client exposes a **Hybrid API** (REST + WebSocket) for external control and monitoring.

### Base URLs

```
REST API:   http://localhost:3000/api/v1
WebSocket:  ws://localhost:3000/ws?token=YOUR_API_KEY
Health:     http://localhost:3000/health
```

### Authentication

All API requests require a Bearer token in the Authorization header:

```http
Authorization: Bearer dev_api_key_change_in_production
```

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/status` | Connection status and phase |
| GET | `/api/v1/character` | Full character state |
| GET | `/api/v1/character/stats` | Character stats only |
| GET | `/api/v1/character/buffs` | Active buffs/debuffs |
| GET | `/api/v1/inventory` | Inventory items |
| GET | `/api/v1/target` | Current target info |
| GET | `/api/v1/nearby/npcs` | NPCs in range |
| GET | `/api/v1/nearby/players` | Players in range |
| GET | `/api/v1/nearby/items` | Items on ground |
| GET | `/api/v1/party` | Party information |
| GET | `/api/v1/skills` | Character skills |
| GET | `/api/v1/skills/shortcuts` | Skill shortcuts |
| GET | `/api/v1/chat/history` | Chat history |
| POST | `/api/v1/connect` | Initiate connection |
| POST | `/api/v1/disconnect` | Disconnect gracefully |
| POST | `/api/v1/reconnect` | Reconnect to server |
| POST | `/api/v1/move/to` | Move to coordinates |
| POST | `/api/v1/move/stop` | Stop movement |
| POST | `/api/v1/combat/attack` | Attack target |
| POST | `/api/v1/combat/stop` | Stop attack |
| POST | `/api/v1/target/set` | Set target |
| POST | `/api/v1/target/clear` | Clear target |
| POST | `/api/v1/skills/use` | Use skill |
| POST | `/api/v1/party/invite` | Invite to party |
| POST | `/api/v1/party/leave` | Leave party |
| POST | `/api/v1/chat/send` | Send chat message |

### WebSocket Events

Subscribe to channels via WebSocket:

```javascript
ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'world']
}));
```

**Available channels:** `system`, `character`, `combat`, `chat`, `world`, `movement`, `party`

**Event types:**
- `system.connected`, `system.disconnected`, `system.error`
- `character.stats_changed`, `character.level_up`, `character.buff_added`, `character.died`
- `combat.attack_sent`, `combat.attack_received`, `combat.target_died`
- `world.npc_spawned`, `world.npc_despawned`, `world.item_dropped`
- `movement.position_changed`
- `chat.message`

---

## Connection Flow

### Phase 1: Login Server (LoginClient)

```
Client                          Login Server
  |--- TCP connect ------------->|
  |<---- Init (0x00) -----------|  (static Blowfish + rolling XOR encrypted)
  |                              |  Contains: sessionId, scrambled RSA key, Blowfish key
  |--- RequestGGAuth (0x07) --->|
  |<---- GGAuth (0x0B) ---------|  Contains: ggAuthResponse
  |--- RequestAuthLogin (0x00)->|  RSA-encrypted credentials + ggAuthResponse
  |<---- LoginOk (0x03) --------|  Contains: loginOkId1, loginOkId2
  |--- RequestServerList (0x05)->|
  |<---- ServerList (0x04) -----|  Contains: server IPs, ports, status
  |--- RequestServerLogin (0x02)->|
  |<---- PlayOk (0x07) ---------|  Contains: playOkId1, playOkId2
  |--- disconnect -------------->|
```

**Crypto:** Init packet uses static Blowfish key `6B 60 CB 5B 82 CE 90 B1 CC 2B 6C 55 6C 6C 6C 6C`. After Init, all packets use the dynamic Blowfish key from the Init packet. Outgoing packets get checksum + Blowfish ECB. Incoming packets get Blowfish ECB + checksum verify.

### Phase 2: Game Server (GameClient)

```
Client                          Game Server
  |--- TCP connect (7777) ----->|
  |--- ProtocolVersion (0x00) ->|  (UNENCRYPTED, sends protocol=746)
  |<---- CryptInit (0x00) ------|  Contains: XOR key seed and encryption flag
  |                              |  If flag=0, encryption is DISABLED
  |--- AuthRequest (0x08) ------>|  Username + session tokens (UTF-16LE)
  |<---- CharSelectInfo (0x13) --|  Character list with full details
  |--- CharacterSelected (0x0D)->|  Selects character by slot (14 bytes padding)
  |<---- CharSelected (0x15) ----|  Confirms selected character
  |--- 0x9D (empty) ---------->|
  |--- 0xD0-08-00 ------------->|
  |--- EnterWorld (0x03) ------>|  (with 104 bytes of 0x00 padding)
  |<---- UserInfo (0x04) -------|  Full character info → IN_GAME state
  |                              |
  |<---- NetPingRequest (0xD3) -|  (periodic keepalive, every ~3 seconds)
  |--- NetPing (0xA8) --------->|
```

**CRITICAL:** The server controls whether to use XOR encryption via the flag in CryptInit packet. For L2J Mobius CT0, this flag is **0** (encryption disabled), so GameCrypt passes packets through without modification.

---

## Key Implementation Details

### Packet Framing

Every L2 packet is length-prefixed with uint16LE (including the 2-byte header):

```
[uint16LE: total_length] [body bytes...]
```

### String Encoding

- **Login Server:** UTF-16LE, null-terminated, length-prefixed with uint16LE
- **Game Server:** UTF-16LE, null-terminated (no length prefix)

### RSA Encryption (Login)

- 1024-bit key
- NO_PADDING
- Modulus must be "unscrambled" using 4-step XOR+swap from Init packet

### Blowfish (Login)

- ECB mode
- Custom L2 checksum added before encryption
- Rolling XOR applied after encryption

### XOR Encryption (Game)

- Simple XOR with 8-byte key derived from seed
- Can be disabled via CryptInit flag

---

## State Management

### GameStateStore

Central in-memory store for all game state:

- **CharacterState:** HP/MP/CP, position, stats, level, class, buffs
- **WorldState:** NPCs, players, items on ground
- **InventoryState:** Items, adena, weight
- **CombatState:** Current target, combat status
- **PartyState:** Party members, leader status
- **ConnectionState:** Connection phase, uptime, ping

### EventBus

Typed EventEmitter for real-time event streaming:

```typescript
EventBus.emitEvent({
    type: 'character.stats_changed',
    channel: 'character',
    data: { hp: { current: 1200, max: 1500, delta: -100 } },
    timestamp: new Date().toISOString()
});

EventBus.onAny((event) => {
    console.log(event.type, event.data);
});
```

---

## Configuration

Edit `src/config.ts`:

```typescript
export const CONFIG = {
    Username: "your_login",
    Password: "your_password",
    LoginIp: "192.168.0.33",
    LoginPort: 2106,
    GamePort: 7777,
    Protocol: 746,
    ServerId: 2,
    CharSlotIndex: 0,
} as const;

export const API_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    apiKey: process.env.API_KEY || 'dev_api_key_change_in_production',
} as const;
```

---

## Development

### Commands

```bash
npm install       # Install dependencies
npm run dev       # Run client with API server
npm run debug     # Run with DEBUG logging
npm run build     # Compile TypeScript to dist/
```

### Testing API

```bash
# Health check
curl http://localhost:3000/health

# Get character info
curl -H "Authorization: Bearer dev_api_key_change_in_production" \
     http://localhost:3000/api/v1/character

# Send move command
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"x": 83500, "y": 54000, "z": -1490}' \
     http://localhost:3000/api/v1/move/to
```

---

## Project Status

**Current Phase:** API Layer Implementation (Phases 0-3 Complete)

- ✅ State Store and EventBus
- ✅ REST API Core (GET endpoints)
- ✅ WebSocket real-time events
- ✅ Action API (POST endpoints)
- ⏳ Full game packet parsing (NPC info, combat, chat)
- ⏳ Integration tests

---

*Documentation last updated: 2025-03-17*
