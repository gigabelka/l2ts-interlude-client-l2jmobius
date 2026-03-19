import "dotenv/config";

import { Logger } from "./logger/Logger";

export const CONFIG = {
  Username: process.env["L2_USERNAME"] || "qwerty",
  Password: process.env["L2_PASSWORD"] || "qwerty",
  LoginIp: process.env["L2_LOGIN_IP"] || "192.168.0.33",
  LoginPort: parseInt(process.env["L2_LOGIN_PORT"] || "2106", 10),
  GamePort: parseInt(process.env["L2_GAME_PORT"] || "7777", 10),
  Protocol: parseInt(process.env["L2_PROTOCOL"] || "746", 10),
  ServerId: parseInt(process.env["L2_SERVER_ID"] || "2", 10),
  CharSlotIndex: parseInt(process.env["L2_CHAR_SLOT"] || "0", 10),
} as const;

// Validate credentials at startup (warn only - user might run API only)
if (!CONFIG.Username) {
  Logger.warn("CONFIG", "L2_USERNAME not set in .env file");
}
if (!CONFIG.Password) {
  Logger.warn("CONFIG", "L2_PASSWORD not set in .env file");
}

// API Server Configuration
// Set apiKey to enable authentication, leave empty to disable
export const API_CONFIG = {
  port: parseInt(process.env["API_PORT"] || "3000", 10),
  host: "0.0.0.0",
  apiKey: process.env["API_KEY"] || "", // Empty = no auth required
  enableCors: true,
  rateLimit: {
    windowMs: 1000, // 1 second
    maxRequests: 100, // 100 requests per second
    moveLimit: 10, // 10 move commands per second
    combatLimit: 5, // 5 combat commands per second
  },
} as const;

// Dashboard Configuration
export const DASHBOARD_CONFIG = {
  enabled: true,
  title: "🎮 L2 Bot Dashboard",
  refreshInterval: 2000, // Status polling interval (ms)
  wsReconnect: {
    initialDelay: 1000, // Initial reconnect delay (ms)
    maxDelay: 30000, // Maximum reconnect delay (ms)
    multiplier: 2, // Exponential backoff multiplier
  },
  theme: "dark" as const,
} as const;
