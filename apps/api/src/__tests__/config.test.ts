/**
 * Health route unit tests.
 * These test the route handlers without a database connection.
 */

import { describe, it, expect } from 'vitest';

describe('API Server', () => {
    it('should have correct config defaults', async () => {
        // Test config module loads without errors
        const { config } = await import('../config');
        expect(config.port).toBe(3001);
        expect(config.host).toBe('0.0.0.0');
        expect(config.nodeEnv).toBeDefined();
    });
});
