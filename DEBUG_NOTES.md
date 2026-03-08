# L2 Client Debug Notes

## IMPORTANT: DO NOT CHANGE PORTS

For this L2J Mobius CT0 server (192.168.0.33), ports are SWAPPED from standard:

```
Login Server: port 2106 (non-standard)
Game Server: port 7777 (non-standard)
```

Standard L2 ports would be:
- Login: 7777
- Game: 2106

**DO NOT change these ports in config.ts during debugging!**

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

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| ECONNRESET after CryptInit | Wrong packet format | Check AuthRequest (0x08) packet layout |
| No response to ProtocolVersion | Wrong opcode | Use 0x00, NOT 0x0B |
| Wrong character selected | CharSlotIndex wrong | Set correct slot in config.ts |
| Login fails | Wrong credentials | Check Username/Password in config.ts |
| Server not found | Wrong IP/port | Verify LoginIp/LoginPort in config.ts |
| Server resets on AuthRequest | Encryption not disabled | Check CryptInit packet flag=0 |

---

## Key Files for Debugging

- `src/game/GameClient.ts` - Main game server FSM
- `src/game/GameCrypt.ts` - XOR encryption (pass-through when disabled)
- `src/game/packets/outgoing/ProtocolVersion.ts` - Protocol version packet (opcode 0x00)
- `src/game/packets/outgoing/AuthRequest.ts` - Auth packet (opcode 0x08)
- `src/game/packets/outgoing/CharacterSelected.ts` - Character selection packet
- `src/logger/Logger.ts` - Logging utilities

---

## Debug Commands

### Enable Debug Logging

In `src/index.ts`, set:

```typescript
Logger.level = 'DEBUG';
```

---

## Implementation Status (2026-03-08)

### Working

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

### Key Findings

- ProtocolVersion uses opcode **0x00** (NOT 0x0E as in official L2 protocol)
- AuthRequest uses opcode **0x08** (NOT 0x9D or 0x2B)
- **Encryption is DISABLED** by server (flag=0 in CryptInit)
- Session data is sent in AuthRequest packet, NOT in ProtocolVersion
- CharacterSelected sends slot + 14 bytes padding (total 19 bytes)

---

## Hex Dump Reference

When debugging, compare your sent/received packets with Wireshark captures:

- **Sent packet**: Look for `[ opcode ]` in the packet data
- **Encrypted packet**: Should be different each time due to rolling key
- **Decrypted packet**: Should match packet structure defined in `client_server_protocol.md`
