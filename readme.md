# L2 Headless Client for L2J_Mobius_CT_0_Interlude

A headless Lineage 2 bot client with **REST + WebSocket API** written in TypeScript. Connects to the Login Server, authenticates with credentials, selects a character, enters the game world, and provides a full external API for control and monitoring.

This client is designed for the [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude) server.

## Features

- ✅ Automatic Login Server authentication
- ✅ Automatic character selection
- ✅ Seamless game world entry
- ✅ Ping/Pong keepalive connection
- ✅ **REST API** — HTTP endpoints for state and control
- ✅ **WebSocket API** — Real-time game events
- ✅ **State Store** — Central game state management
- ✅ **Event Bus** — Typed event streaming

## API Overview

### REST Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Get character state
curl -H "Authorization: Bearer dev_api_key_change_in_production" \
     http://localhost:3000/api/v1/character

# Get nearby NPCs
curl -H "Authorization: Bearer dev_api_key_change_in_production" \
     "http://localhost:3000/api/v1/nearby/npcs?radius=600&attackable=true"

# Move to coordinates
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"x": 83500, "y": 54000, "z": -1490}' \
     http://localhost:3000/api/v1/move/to

# Attack target
curl -X POST \
     -H "Authorization: Bearer dev_api_key_change_in_production" \
     -H "Content-Type: application/json" \
     -d '{"objectId": 268701234}' \
     http://localhost:3000/api/v1/combat/attack
```

### WebSocket Events

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=dev_api_key_change_in_production');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['character', 'combat', 'world']
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg.data);
};
```

## Based On

- [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude) — server reference for packet formats and opcodes
- [l2js-client](https://github.com/npetrovski/l2js-client) — client reference for packet formats and opcodes

## Resources

YouTube Channel: https://youtube.com/@lineage2interludeclientforl2jm

Telegram Channel: t.me/Lineage2InterludeClientForL2jm

## Requirements

- Node.js LTS 24.14.0

## Installation

```bash
npm install
```

## Configuration

Edit `src/config.ts` with your server address, credentials, and character slot:

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
```

## Running

```bash
# Development mode
npm run dev

# With debug logging
npm run debug

# Build for production
npm run build
```

## Documentation

- [DOCUMENTATION.md](DOCUMENTATION.md) — Technical documentation
- [L2TS_API_DOCUMENTATION.md](L2TS_API_DOCUMENTATION.md) — Full API specification
- [client_server_protocol.md](client_server_protocol.md) — Protocol documentation

## Version History

- 0.1.38 — Added REST + WebSocket API layer, GameStateStore, EventBus
- 0.1.33 — Initial commit. Automatic character login into the game.
