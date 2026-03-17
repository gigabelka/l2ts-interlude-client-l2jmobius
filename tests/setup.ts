import { beforeAll, afterAll } from 'vitest';
import { MockL2Server } from './utils/mockServer';
import { GameStateStore } from '../src/core/GameStateStore';
import { EventBus } from '../src/core/EventBus';
import { GameCommandManager } from '../src/game/GameCommandManager';
import { TEST_CONFIG } from './config';

/**
 * Global test setup
 * Runs once before all tests
 */
beforeAll(async () => {
    // Reset global state
    GameStateStore.reset();
    
    // Clear all EventBus listeners
    EventBus.removeAllListeners();
    
    // Unregister any existing game client
    GameCommandManager.setGameClient(null);

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = TEST_CONFIG.api.apiKey;
    process.env.LOG_LEVEL = 'SILENT';

    console.log('Test environment initialized');
});

/**
 * Global test teardown
 * Runs once after all tests
 */
afterAll(async () => {
    // Final cleanup
    GameStateStore.reset();
    EventBus.removeAllListeners();
    GameCommandManager.setGameClient(null);

    console.log('Test environment cleaned up');
});

/**
 * Test context for sharing mock server across tests
 */
export interface TestContext {
    mockServer: MockL2Server;
}

/**
 * Setup helper for packet tests
 */
export function setupPacketTest() {
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state before each test
        GameStateStore.reset();
        EventBus.removeAllListeners();
        
        // Create and start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        // Stop mock server after each test
        await mockServer.stop();
        
        // Clean up state
        GameStateStore.reset();
        EventBus.removeAllListeners();
    });

    return {
        getMockServer: () => mockServer
    };
}

/**
 * Setup helper for API tests
 */
export function setupApiTest() {
    let mockServer: MockL2Server;

    beforeEach(async () => {
        // Reset state before each test
        GameStateStore.reset();
        EventBus.removeAllListeners();
        
        // Create and start mock server
        mockServer = new MockL2Server();
        await mockServer.start();
    });

    afterEach(async () => {
        // Stop mock server after each test
        await mockServer.stop();
        
        // Clean up state
        GameStateStore.reset();
        EventBus.removeAllListeners();
    });

    return {
        getMockServer: () => mockServer
    };
}

// Vitest-style helper types
type TestFn = () => void | Promise<void>;

// Global test utilities
declare global {
    // eslint-disable-next-line no-var
    var testContext: TestContext | undefined;
}

// Helper to wait for a specific event
export function waitForEvent<T>(
    eventType: string, 
    timeout: number = TEST_CONFIG.timeouts.response
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            EventBus.off(eventType, handler);
            reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);

        function handler(event: T) {
            clearTimeout(timer);
            EventBus.off(eventType, handler);
            resolve(event);
        }

        EventBus.on(eventType, handler);
    });
}

// Helper to wait for a condition
export async function waitForCondition(
    condition: () => boolean,
    timeout: number = TEST_CONFIG.timeouts.response,
    interval: number = 50
): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Timeout waiting for condition');
}
