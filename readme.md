# L2 Headless Client for L2J_Mobius_CT_0_Interlude

Headless Lineage 2 bot client written in TypeScript. Connects to Login Server, authenticates, selects a character, and enters the game world with keepalive.
The client is developed for the server L2J_Mobius_CT_0_Interlude.
This project is created for enthusiast developers.
The goal of the project is to create a universal API.

## Based on

- [L2J_Mobius CT_0_Interlude](https://gitlab.com/MobiusDevelopment/L2J_Mobius/-/tree/master/L2J_Mobius_CT_0_Interlude) — server reference for packet formats and opcodes

- [l2js-client](https://github.com/npetrovski/l2js-client) — client reference for packet formats and opcodes

## Requirements

- Node.js LTS 24.14.0

## Setup

```bash
npm install
```

## Configuration

Edit `src/config.ts` with your server address, credentials, and character slot.

## Run

```bash
npm run dev
```

## Version history:

- 0.1.33 — Initial commit. Automatic character login into the game.
