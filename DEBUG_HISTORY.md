# Debug History - Game Server Connection Issue

## Problem Statement

The headless L2 client successfully connects to Login Server but fails to connect to Game Server. The connection resets with ECONNRESET after receiving CryptInit packet.

## What Works

### Login Server (port 2106)

Full authentication flow works perfectly:

- Init (0x00) → GGAuth (0x0B) → AuthLogin (0x00) → LoginOk (0x03) → ServerList (0x04) → PlayOk (0x07)
- Session tokens received correctly:
  - loginOkId1, loginOkId2 (from LoginOk)
  - playOkId1, playOkId2 (from PlayOk)

## What Fails

### Game Server (port 7777)

Connection fails after CryptInit:

- ProtocolVersion (0x00) → accepted by server ✓
- CryptInit (0x00) → accepted, XOR keys initialized ✓
- Any subsequent encrypted packet → ECONNRESET

## Attempted Fixes (All Failed)

### 1. ProtocolVersion opcode 0x0B (instead of 0x00)

- Changed from 0x00 to 0x0B
- Result: No response from server (silent connection)
- Conclusion: Game Server expects 0x00, not 0x0B

### 2. AuthLogin (0x08) after CryptInit

- Format: opcode + username + sessionId + playOkId
- Result: ECONNRESET immediately after sending

### 3. AuthLogin with sessionId + loginOkId1 + playOkId1

- Format: opcode + username + sessionId + loginOkId1 + playOkId1
- Result: ECONNRESET immediately after sending

### 4. Skip AuthLogin, send game entry packets directly

- Sent: RequestAuthLogin (0x9D) + EnterGameServer (0xD0-08) + CharacterSelected (0xD0-03)
- Result: ECONNRESET after first encrypted packet

### 5. Sending nothing after CryptInit

- Wait for server to respond first
- Result: Server doesn't send anything, eventually times out

## Root Cause Analysis

### Key Insight from Wireshark Document

The document "Working packets from Wireshark.md" explicitly states:

```
## Game Server (port 2106) - FAILED ATTEMPT
Note: The first attempt to connect to Game Server (frames 721-768) fails.
The server sends encrypted data without proper handshake.
```

**This means even the original Wireshark capture couldn't connect to the game server successfully.**

### Hypothesis

The L2J Mobius CT0 server requires a different or custom game server handshake that's not in standard L2 protocol documentation. The session is stored server-side (evidenced by "Account already in use" error on quick reconnection), but the game server authentication protocol differs from standard Interlude.

## Key Observations

1. **Session tracking works**: "Account already in use" appears when reconnecting quickly
2. **XOR encryption initializes correctly**: CryptInit packet is parsed and keys are set
3. **Server accepts ProtocolVersion (0x00)**: This is correct for game server
4. **Server resets on any encrypted packet**: The server doesn't like our encrypted packets
5. **Server does NOT accept ProtocolVersion (0x0B)**: Silent connection, no response

## Possible Solutions

### Option 1: Fresh Wireshark Capture (Recommended)

Capture network traffic from a **working** L2 client connecting to this specific L2J Mobius server. Analyze the exact packet sequence after CryptInit.

### Option 2: Try Different Protocol Versions

- Protocol 746 (Interlude) - current
- Protocol 266 (Chronicle 1-5)
- Protocol other variants

### Option 3: Server-Side Configuration

The server might have specific settings that require certain packets or formats. Check server configuration.

### Option 4: Different XOR Algorithm

Some L2 servers use slightly different XOR implementations. Try:

- Different key derivation from CryptInit
- Different rolling counter behavior
- Different static key bytes

## Files Modified During Debugging

1. **src/game/GameClient.ts** - Modified packet handling flow multiple times
2. **src/game/packets/outgoing/ProtocolVersion.ts** - Tested opcodes 0x00 and 0x0B
3. **src/game/packets/outgoing/AuthRequest.ts** - Changed format and opcode multiple times
4. **src/game/GameCrypt.ts** - XOR encryption implementation

## Test Results Timeline

| Test                     | Login Server | Game Server                  |
| ------------------------ | ------------ | ---------------------------- |
| Initial test (0x00)      | ✓ Works      | ✗ ECONNRESET after CryptInit |
| ProtocolVersion 0x0B     | ✓ Works      | ✗ No response from server    |
| AuthLogin 0x08           | ✓ Works      | ✗ ECONNRESET                 |
| AuthLogin with sessionId | ✓ Works      | ✗ ECONNRESET                 |
| Game entry packets only  | ✓ Works      | ✗ ECONNRESET                 |
| Send nothing             | ✓ Works      | ✗ Server doesn't respond     |

## Conclusion

The login server implementation is complete and working. The game server connection requires further investigation with actual server traffic capture from a working client, as documented in the original Wireshark file the game server connection was marked as "FAILED ATTEMPT".

---

## Current Implementation (2024)

### Working Configuration

After extensive debugging, the following configuration works for Login Server:

**Login Server Flow (Port 2106):**

- Init (0x00) → GGAuth (0x0B) → AuthLogin (0x00) → LoginOk (0x03) → ServerList (0x04) → PlayOk (0x07)
- Session tokens received: loginOkId1, loginOkId2, playOkId1, playOkId2

### Game Server Flow

The correct game server connection flow (confirmed from Wireshark capture and working implementation):

```
Client                          Game Server
  |--- TCP connect (port 7777) ->|
  |--- ProtocolVersion (0x00) -->|  (UNENCRYPTED)
  |<---- CryptInit (0x00) -----|  Contains: encryption flag (0=DISABLED)
  |--- AuthRequest (0x08) ----->|  (UTF-16LE username + session tokens)
  |<---- CharSelectInfo (0x13)->|  Character list
  |--- CharacterSelected (0x0D)->|  Slot index + 14 bytes padding
  |<---- CharSelected (0x15) ---|  Confirmation
  |--- 0x9D (empty) ---------->|
  |--- 0xD0-08-00 ------------>|
  |--- EnterWorld (0x03) ----->|  104 bytes padding
  |<---- UserInfo (0x04) --------| Full character info
  |                              |
  |<---- NetPingRequest (0xD3) --| Keepalive
  |--- NetPing (0xA8) ---------->|
```

**Key Points:**

1. ProtocolVersion uses opcode 0x00 (NOT 0x0B) - confirmed from Wireshark
2. **Encryption is DISABLED by server** - CryptInit sends flag=0, packets pass through unchanged
3. AuthRequest (0x08) sends username in UTF-16LE + session tokens
4. No CharSelected (0x1E) from server before our AuthRequest

---

## Debugging Checklist

Use this checklist to verify each step of the connection:

### Phase 1: Login Server

- [ ] Connect to Login Server (port 2106)
- [ ] Receive Init packet (0x00) - extract sessionId, RSA key, Blowfish key
- [ ] Send RequestGGAuth (0x07)
- [ ] Receive GGAuth response (0x0B)
- [ ] Send RequestAuthLogin (0x00) - RSA encrypted credentials
- [ ] Receive LoginOk (0x03) - extract loginOkId1, loginOkId2
- [ ] Send RequestServerList (0x05)
- [ ] Receive ServerList (0x04) - note server IPs and ports
- [ ] Send RequestServerLogin (0x02) - with desired ServerId
- [ ] Receive PlayOk (0x07) - extract playOkId1, playOkId2

### Phase 2: Game Server

- [ ] Connect to Game Server (port 7777)
- [ ] Send ProtocolVersion (0x00) - UNENCRYPTED
- [ ] Receive CryptInit (0x00) - extract encryption flag (if 0, encryption is DISABLED)
- [ ] Send AuthRequest (0x08) - username (UTF-16LE) + session tokens
- [ ] Receive CharSelectInfo (0x13/0x04) - character list
- [ ] Send CharacterSelected (0x0D) - slot index + 14 bytes padding
- [ ] Receive CharSelected (0x15) - confirmation
- [ ] Send 0x9D (empty), 0xD0-08-00, EnterWorld (0x03 + 104 bytes)
- [ ] Receive UserInfo (0x04) - Character entered game world!

### Phase 3: In-Game

- [ ] Receive NetPingRequest (0xD3)
- [ ] Send NetPing (0xA8) response
- [ ] Connection stable - ping/pong working

---

## Debug Commands

### Enable Debug Logging

In `src/index.ts`, set:

```typescript
Logger.level = "DEBUG";
```

### Common Issues and Solutions

| Issue                          | Cause                   | Solution                               |
| ------------------------------ | ----------------------- | -------------------------------------- |
| ECONNRESET after CryptInit     | Wrong packet format     | Check AuthRequest (0x08) packet layout |
| No response to ProtocolVersion | Wrong opcode            | Use 0x00, NOT 0x0B                     |
| Wrong character selected       | CharSlotIndex wrong     | Set correct slot in config.ts          |
| Login fails                    | Wrong credentials       | Check Username/Password in config.ts   |
| Server not found               | Wrong IP/port           | Verify LoginIp/LoginPort in config.ts  |
| Server resets on AuthRequest   | Encryption not disabled | Check CryptInit packet flag=0          |

### Key Files for Debugging

- `src/game/GameClient.ts` - Main game server FSM
- `src/game/GameCrypt.ts` - XOR encryption (pass-through when disabled)
- `src/game/packets/outgoing/ProtocolVersion.ts` - Protocol version packet (opcode 0x00)
- `src/game/packets/outgoing/AuthRequest.ts` - Auth packet (opcode 0x08)
- `src/game/packets/outgoing/CharacterSelected.ts` - Character selection packet
- `src/logger/Logger.ts` - Logging utilities

### Hex Dump Reference

- **Sent packet**: Look for `[ opcode ]` in the packet data
- **Encrypted packet**: Should be different each time due to rolling key
- **Decrypted packet**: Should match packet structure defined in `client_server_protocol.md`
  Debug session saved at Sat Mar 7 13:08:00 RTZ 2026

---

## Session 2026-03-07 - Progress Update

### Working:

1. Login Server - WORKS (Init → GGAuth → AuthLogin → ServerList → PlayOk)
2. Game Server connection - WORKS (TCP connects)
3. ProtocolVersion (0x00) - SERVER RESPONDS with CryptInit
4. CryptInit (0x00) - XOR key received and initialized

### Broken:

- After sending RequestAuthLogin (0x9D) + EnterGameServer (0xD0-08) + CharacterSelected (0xD0-03)
- Server responds with ECONNRESET (connection reset)

### Key Findings:

- ProtocolVersion opcode 0x00 WORKS (not 0x0B)
- L2J Mobius expects data IMMEDIATELY after CryptInit (not waiting for CharSelected from server)
- XOR encryption may be incorrect

### Code Changes:

1. src/game/packets/outgoing/ProtocolVersion.ts - changed opcode from 0x0B to 0x00
2. src/game/GameClient.ts - removed immediate send after CryptInit, now waits for CharSelected, then sends

---

## Session 2026-03-08 - Critical Finding

### Key Discovery

**ECONNRESET happens regardless of what we send after CryptInit!**

Even when sending NO packets after CryptInit, server still closes connection.
This means the server EXPECTS data but REJECTS all our attempts.

### Tested Variations (All Failed with ECONNRESET):

1. AuthRequest (0x08) + EnterGameServer + CharacterSelected - with XOR encryption
2. EnterGameServer only - with XOR encryption
3. CharacterSelected only - with XOR encryption
4. EnterGameServer without encryption (raw buffer)
5. CharacterSelected without encryption (raw buffer)
6. NO packets after CryptInit - server closes anyway

### Root Cause Analysis

The L2J Mobius CT0 game server seems to require a DIFFERENT handshake protocol than standard L2 Interlude. Possible issues:

1. XOR encryption implementation is wrong
2. Packet format is wrong
3. Game server expects completely different first packet
4. Session tokens need to be handled differently

### What Works

- Login Server (port 2106): Full auth works perfectly
- Game Server connection: TCP connects
- ProtocolVersion (0x00): Server accepts
- CryptInit (0x00): Server sends XOR key correctly
- Any subsequent packet: ECONNRESET

### Files to Check

- src/game/GameCrypt.ts - XOR encryption algorithm
- src/game/packets/outgoing/ProtocolVersion.ts - first packet
- Need Wireshark capture from working L2 client to this specific server

---

## Session 2026-03-08 - Current Progress

### Key Fixes Applied:

1. ProtocolVersion - uses opcode 0x00, sends 4-byte INT32 version
2. RequestAuthLogin (0x08) - sends username in UTF-16LE format
3. GameCrypt - simplified XOR without chaining, uses 8-byte key + static bytes
4. GameClient - sends packets immediately after CryptInit

### Current Status:

- Login Server: WORKING
- Game Server ProtocolVersion: WORKING (result=1)
- Game Server encrypted packets: Server accepts but doesn't respond

### What's Working:

- Login Server flow complete
- Game Server accepts ProtocolVersion (0x00)
- CryptInit received with result=1
- XOR keys initialized

### What's Not Working:

- Server doesn't respond to encrypted packets (RequestAuthLogin, EnterGameServer, CharacterSelected)
- Possible issue: XOR encryption algorithm doesn't match server expectations

### Next Steps Needed:

- Capture Wireshark traffic from working L2 client to this specific server
- Compare encrypted packet format with server expectations
- Try different XOR key derivation methods

---

## Session 2026-03-08 - Fixed Handshake Issue

### Key Fixes Applied based on Wireshark analysis:

1. **Disabled Encryption:** The `CryptInit` packet from the server actually sends an encryption flag (`useBlowfish`). For this server, the flag is 0, meaning encryption is disabled. The client now reads this flag and respects it.
2. **AuthLogin (0x08):** Fixed the packet layout to exactly match Wireshark frame 199 (Opcode + Username + playOkId2 + playOkId1 + loginOkId1 + loginOkId2 + language flag).
3. **CharacterSelect (0x0D):** Fixed the packet layout and padding to exactly match Wireshark frame 230.
4. **GameClient FSM Rewrite:** Updated the state machine to send `AuthLogin` immediately after `CryptInit`, then transition step-by-step through `WAIT_CHAR_LIST` -> `CharacterSelected` -> `WAIT_CHAR_SELECTED` -> `EnterWorld`.
5. **Packet Handler:** Updated `GamePacketHandler.ts` to map opcode `0x13` to `CharSelectInfoPacket` and `0x15` to `CharSelectedPacket`.

### Current Status:

- Game Server connects and correctly disables encryption based on `CryptInit`.
- Handshake logic precisely matches Wireshark capture.
- Character select works and the client enters the game (`IN_GAME` state).
