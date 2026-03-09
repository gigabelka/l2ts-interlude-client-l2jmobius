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
npm run dev       # Run the client
npm run build     # Compile TypeScript to dist/
```

## Architecture

The client has two distinct connection phases managed by FSM-driven clients:

### Phase 1: Login Server (LoginClient)

- **Flow:** Init → GGAuth → AuthLogin → ServerList → PlayOk → disconnect
- **Crypto:** Static Blowfish for Init, dynamic Blowfish + XOR for rest, RSA for credentials
- **State Enum:** `LoginState` (IDLE, CONNECTING, WAIT_INIT, WAIT_GG_AUTH, WAIT_LOGIN_OK, WAIT_SERVER_LIST, WAIT_PLAY_OK, DONE, ERROR)

### Phase 2: Game Server (GameClient)

- **Flow:** ProtocolVersion (0x00) → CryptInit (0x00) → AuthRequest (0x08) → CharSelectInfo (0x13) → CharacterSelected (0x0D) → CharSelected (0x15) → (0x9D + 0xD0-08-00 + EnterWorld 0x03) → UserInfo (0x04) → IN_GAME (ping/pong)
- **Crypto:** Encryption is disabled via flag sent in CryptInit.
- **State Enum:** `GameState` (IDLE, CONNECTING, WAIT_CRYPT_INIT, WAIT_CHAR_LIST, WAIT_CHAR_SELECTED, WAIT_USER_INFO, IN_GAME, ERROR)

**CRITICAL:** The client strictly mimics the packet layout and padding observed in Wireshark captures to successfully connect.

## Directory Structure

```
src/
├── index.ts           # Entry point: LoginClient → GameClient pipeline
├── config.ts          # Server address, credentials, character slot
├── logger/            # Logging with hex dump utilities
├── network/           # TCP connection with L2 packet framing
├── crypto/            # Blowfish, XOR, RSA implementations
├── login/             # Login server client + packets
│   ├── LoginClient.ts
│   ├── LoginCrypt.ts
│   └── packets/      # incoming/outgoing login packets
└── game/              # Game server client + packets
    ├── GameClient.ts
    ├── GameCrypt.ts   # XOR encryption
    └── packets/       # incoming/outgoing game packets
```

## Key Implementation Details

- **Packet framing:** Each L2 packet starts with uint16LE length (including the 2-byte header)
- **Two crypto systems:** Login uses Blowfish ECB (NewCrypt → BlowfishEngine), Game uses XOR (GameCrypt)
- **RSA encryption:** 1024-bit with NO_PADDING, modulus must be unscrambled first using ScrambledRSAKey
- **Packet format types:** C=uint8, H=uint16, D=int32, Q=int64, F=double, S=UTF-16LE null-terminated string
- **Game Server ProtocolVersion:** Uses opcode 0x00 (NOT 0x0B), confirmed from working Wireshark capture

## Configuration

Edit `src/config.ts` with your server settings:

- `Username` / `Password` - Login credentials
- `LoginIp` / `LoginPort` - Login server address (default 2106)
- `GamePort` - Game server port (default 7777)
- `ServerId` - Server ID from server list
- `CharSlotIndex` - Character slot to select (0-based)

## Documentation Source of Truth

**IMPORTANT:** The following files are the single source of truth and **MUST NOT BE EDITED**:

- `client_server_protocol.md` — client-server protocol documentation

All information about protocol, packet formats and crypto must be taken exclusively from these files. Code in `src/` must match them, not the other way around.

**DOCUMENTATION.md** is a documentation file that must always be kept up to date. It must be regularly updated based on newly received information. This file should contain the most current and accurate information about the project.

## Debugging

- Set `Logger.level = 'DEBUG'` in `src/index.ts` for verbose packet logging
- Monitor `[STATE]` log lines to track FSM transitions
- Check `docs.md` for detailed packet formats and crypto specifications
- Check `Working packets from Wireshark.md` for reference captures
- **Required:** Read `DEBUG_HISTORY.md` before debugging - it contains a history of previous problems and solutions.
- **Recommendation:** See `DEBUG_NOTES.md` for general debugging tips.
