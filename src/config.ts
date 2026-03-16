export const CONFIG = {
    Username: "qwerty",
    Password: "qwerty",
    LoginIp: "192.168.0.33",
    LoginPort: 2106,
    GamePort: 7777,
    Protocol: 746,
    ServerId: 2,
    CharSlotIndex: 0,
} as const;

// API Server Configuration
// Set apiKey to enable authentication, leave empty to disable
export const API_CONFIG = {
    port: 3000,
    host: '0.0.0.0',
    apiKey: process.env.API_KEY || '',  // Empty = no auth required
    enableCors: true,
    rateLimit: {
        windowMs: 1000, // 1 second
        maxRequests: 100, // 100 requests per second
        moveLimit: 10, // 10 move commands per second
        combatLimit: 5, // 5 combat commands per second
    }
} as const;
