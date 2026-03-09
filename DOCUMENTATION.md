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
├── index.ts              Entry point: LoginClient → GameClient pipeline
├── config.ts             Server address, credentials, character slot
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

## Packet Opcode Reference

### Game Server — Client → Server (L2J Mobius CT0)

| Opcode | Packet                 | Description                          | Connection State |
| ------ | ---------------------- | ------------------------------------ | ---------------- |
| 0x00   | ProtocolVersion        | Protocol version (746), unencrypted  | CONNECTED        |
| 0x08   | AuthRequest           | Session tokens + Username (UTF-16LE) | WAIT_CHAR_LIST   |
| 0x0D   | CharacterSelected     | Character slot + 14 bytes padding   | WAIT_CHAR_SELECTED |
| 0x9D   | (empty)              | EnterWorld part 1                   | WAIT_USER_INFO   |
| 0xD0-08 | EnterGameServer     | EnterWorld part 2                   | WAIT_USER_INFO   |
| 0x03   | EnterWorld           | EnterWorld part 3 (104 bytes padding) | WAIT_USER_INFO   |
| 0xA8   | NetPing              | Pong response                       | IN_GAME          |
| 0xCE   | RequestKeyMapping    | Key bindings                        | IN_GAME          |
| 0xD0   | ExPacket (sub-opcodes) | Extended packets                  | ALL              |

### Game Server — Server → Client

| Opcode | Packet                       | Description                   |
| ------ | ---------------------------- | ----------------------------- |
| 0x00   | CryptInit (KeyPacket)       | XOR key seed, encryption flag |
| 0x04   | UserInfo / CharSelectInfo    | Full character info / list    |
| 0x13   | CharSelectInfo              | Character list (alternative)  |
| 0x15   | CharSelected                | Character selected confirm    |
| 0x1B   | InventoryUpdate             | Item changes                 |
| 0x45   | SkillList                  | Skill list                   |
| 0x80   | QuestList                  | Active quest list            |
| 0xCE   | RequestKeyMapping          | Key bindings                 |
| 0xD3   | NetPingRequest             | Keepalive ping               |
| 0xE4   | SystemMessage              | Server messages              |
| 0xF8   | SSQInfo                   | Seven Signs sky color        |
| 0xFE   | ExSendManorList           | Manor zone list              |

### Login Server — Client → Server

| Opcode | Packet             |
| ------ | ------------------ |
| 0x00   | RequestAuthLogin  |
| 0x02   | RequestServerLogin |
| 0x05   | RequestServerList |
| 0x07   | RequestGGAuth     |

### Login Server — Server → Client

| Opcode | Packet     |
| ------ | ---------- |
| 0x00   | Init       |
| 0x01   | LoginFail  |
| 0x03   | LoginOk    |
| 0x04   | ServerList |
| 0x06   | PlayFail   |
| 0x07   | PlayOk     |
| 0x0B   | GGAuth     |

---

## Crypto Details

### Login Server Crypto (LoginCrypt + NewCrypt)

1. **Init packet decryption:**
   - Blowfish ECB decrypt with static key
   - Extract rolling XOR seed from last 8 bytes
   - Reverse XOR pass (decXORPass)
   - Remove trailing 8-byte XOR block

2. **Regular packet decryption:**
   - Blowfish ECB decrypt with session key (from Init)
   - Verify 4-byte checksum

3. **Outgoing packet encryption:**
   - Align to 4-byte boundary
   - Append 8-byte checksum block
   - Align to 8-byte boundary (Blowfish requirement)
   - Compute and write checksum
   - Blowfish ECB encrypt

### Game Server Crypto (GameCrypt)

The server sends an **encryption flag** in CryptInit packet:
- Flag = 0: Encryption DISABLED (used by L2J Mobius CT0)
- Flag != 0: Encryption ENABLED

When disabled, packets pass through unchanged:
```typescript
encrypt(data): Buffer { return data; }
decrypt(data): Buffer { return data; }
```

When enabled, uses simple XOR:
```typescript
for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i & 7];
}
```

### RSA Encryption (RSACrypt)

- 128-byte plaintext with login at offset 0x5E (14 bytes) and password at 0x6E (16 bytes)
- RSA_NO_PADDING with 1024-bit key (exponent 0x010001)
- Modulus from Init packet must be unscrambled first (ScrambledRSAKey)

---

## AuthRequest Packet Format (0x08)

**CRITICAL:** This is the key packet that makes the client work with L2J Mobius.

```
Offset  Size  Type     Description
------  ----  -------- -----------
0x00    1     uint8    Opcode = 0x08
0x01    var   UTF-16LE Username (null-terminated)
...     2     uint16   Null terminator (0x0000)
...     4     int32    playOkId2
...     4     int32    playOkId1
...     4     int32    loginOkId1
...     4     int32    loginOkId2
...     4     int32    Language = 1
```

**Example (from Wireshark frame 199):**
```
08 71 00 77 00 65 00 72 00 74 00 79 00 00 00  [opcode + "qwerty" + null]
XX XX XX XX                                         [playOkId2]
XX XX XX XX                                         [playOkId1]
XX XX XX XX                                         [loginOkId1]
XX XX XX XX                                         [loginOkId2]
01 00 00 00                                         [language]
```

---

## CharacterSelected Packet Format (0x0D)

```
Offset  Size  Type     Description
------  ----  -------- -----------
0x00    1     uint8    Opcode = 0x0D
0x01    4     int32    Slot index (0-based)
0x05    14    bytes    Padding (0x00)
```

Total body length: 19 bytes

---

## EnterWorld Sequence (after CharSelected)

Three packets sent sequentially:

1. **0x9D** - Empty packet (body length = 1)
2. **0xD0 0x08 0x00** - EnterGameServer (body length = 3)
3. **0x03 + 104 bytes** - EnterWorld with padding (body length = 105)

---

## CharSelectionInfo Packet Format (0x04/0x13)

Per L2J Mobius CT0 Interlude `CharSelectionInfo.writeImpl()`:

```
Header:
  D(charCount)

Per character:
  S(name) D(objectId) S(loginName) D(sessionId) D(clanId)
  D(builderLevel=0) D(sex) D(race) D(baseClassId) D(active=1)
  D(0) D(0) D(0)                          // x,y,z hardcoded to 0 in CT0
  F(currentHp) F(currentMp) D(sp) Q(exp) D(level) D(karma)
  D(0) x9                                  // pkKills, pvpKills, 7 unknowns
  D(paperdollObjectId) x17                 // 17 equipment slots
  D(paperdollItemId) x17                   // 17 equipment slots
  D(hairStyle) D(hairColor) D(face)
  F(maxHp) F(maxMp)
  D(deleteTimeSec) D(classId) D(isLastUsed)
  C(enchantEffect) D(augmentationId)
```

Type legend: C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated string

---

## Configuration

Edit `src/config.ts`:

```typescript
export const CONFIG = {
  Username: "qwerty",      // Login account name
  Password: "password",     // Login password
  LoginIp: "192.168.0.33", // Login server IP
  LoginPort: 2106,         // Login server port (default 2106)
  GamePort: 7777,          // Game server port (default 7777)
  Protocol: 746,          // Protocol version (746 = Interlude)
  ServerId: 2,            // Game server ID from server list
  CharSlotIndex: 0,        // Character slot index (0-based)
} as const;
```

---

## Running

```bash
npm install
npm run dev
```

Requires Node.js 20+.

### Running Modes

#### Development (Silent)
```bash
npm run dev
```
Runs silently — no console output. Use for normal operation.

#### Debug
```bash
npm run debug
```
Runs with full debug output — all packet logs, state transitions, hex dumps, etc.

---

## Debugging Tips

- Set `Logger.level = 'DEBUG'` in `index.ts` to see all packet hex dumps
- Monitor `[STATE]` log lines to track FSM transitions
- All opcodes verified against working Wireshark capture from L2J Mobius CT0 Interlude
- Check `DEBUG_HISTORY.md` for detailed troubleshooting history
- The CryptInit packet contains `useEncryption` flag - if it's 0, no encryption is used

---

## Key Design Decisions

1. **Two separate PacketReader classes:** `network/PacketReader` for game packets (uses `readInt32LE`, `readDouble`, `readStringUTF16`), `login/.../IncomingLoginPacket.PacketReader` for login packets (uses `readInt32`, `readBytes`). They serve different packet families.

2. **FSM-driven architecture:** Both LoginClient and GameClient use explicit state enums. Each state only processes specific opcodes; all others are ignored with debug logging.

3. **Crypto flag from server:** GameCrypt reads the `useEncryption` flag from CryptInit packet and enables/disables XOR encryption accordingly. L2J Mobius CT0 sends flag=0 (disabled).

4. **Three-packet EnterWorld:** After CharSelected, client sends three packets (0x9D, 0xD0-08-00, 0x03+padding) to fully enter the game world.

---

## Implementation Status (2026-03-08)

### Working ✅

- **Login Server:** Init → GGAuth → AuthLogin → ServerList → PlayOk — FULLY WORKING
- **Game Server TCP connection** — WORKING
- **ProtocolVersion (0x00)** — server accepts and responds with CryptInit — WORKING
- **CryptInit (0x00)** — XOR key received, encryption flag read — WORKING
- **AuthRequest (0x08)** — sends username + session tokens — WORKING
- **CharSelectInfo (0x13/0x04)** — receives character list — WORKING
- **CharacterSelected (0x0D)** — selects character by slot — WORKING
- **EnterWorld sequence** — three packets to enter game — WORKING
- **IN_GAME state** — receives and processes game packets — WORKING
- **NetPing keepalive** — ping/pong working — WORKING

### Verified Opcodes

- Client→Server: 0x00 (ProtocolVersion), 0x08 (AuthRequest), 0x0D (CharacterSelected), 0x9D, 0xD0-08, 0x03 (EnterWorld), 0xA8 (NetPing)
- Server→Client: 0x00 (CryptInit), 0x13 (CharSelectInfo), 0x15 (CharSelected), 0x04 (UserInfo), 0xD3 (NetPingRequest)

### Key Findings

- ProtocolVersion uses opcode **0x00** (NOT 0x0E as in official L2 protocol)
- AuthRequest uses opcode **0x08** (NOT 0x9D or 0x2B)
- **Encryption is DISABLED** by server (flag=0 in CryptInit) — this was the main blocker!
- Session data is sent in AuthRequest packet, NOT in ProtocolVersion
- CharacterSelected sends slot + 14 bytes padding (total 19 bytes)
