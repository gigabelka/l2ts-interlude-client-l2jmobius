# L2 Headless Client for L2J_Mobius_CT_0_Interlude

A headless Lineage 2 bot client written in TypeScript. Connects to the Login Server, authenticates with credentials, selects a character, enters the game world, and maintains a keepalive connection.

This client is designed for the [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude) server.

## Features

- Automatic Login Server authentication
- Automatic character selection
- Seamless game world entry
- Ping/Pong keepalive connection

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

Edit `src/config.ts` with your server address, credentials, and character slot.

## Running

```bash
npm run dev
```

## Version History

- 0.1.33 — Initial commit. Automatic character login into the game.
