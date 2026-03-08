/**
 * Shared test helpers for API route testing.
 * Provides a buildApp() function that creates a Fastify instance
 * with mocked Prisma, suitable for inject()-based testing.
 */

import Fastify from 'fastify';
import { ZodError } from 'zod';

/** Creates a Fastify app with global error handler (no DB, no plugins) */
export function buildApp() {
    const app = Fastify({ logger: false });

    // Mirror the global error handler from src/index.ts
    app.setErrorHandler((error: Error, _request, reply) => {
        if (error instanceof ZodError) {
            const issues = error.issues.map(i => ({
                path: i.path.join('.'),
                message: i.message,
            }));
            return reply.status(400).send({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: issues,
                },
            });
        }

        const errorWithCode = error as Error & { code?: string; statusCode?: number };
        if (errorWithCode.code === 'P2025') {
            return reply.status(404).send({
                error: { code: 'NOT_FOUND', message: 'Record not found' },
            });
        }

        return reply.status(errorWithCode.statusCode || 500).send({
            error: { code: 'INTERNAL_ERROR', message: error.message },
        });
    });

    return app;
}

/** Generates a mock transaction row matching Prisma schema */
export function mockTransaction(overrides: Record<string, unknown> = {}) {
    return {
        id: 'tx-001',
        userId: '00000000-0000-0000-0000-000000000001',
        type: 'BUY',
        timestamp: new Date('2025-03-01T10:00:00Z'),
        sentAsset: null,
        sentAmount: null,
        sentValueUsd: null,
        receivedAsset: 'BTC',
        receivedAmount: 1.5,
        receivedValueUsd: 45000,
        feeAsset: 'USD',
        feeAmount: 10,
        feeValueUsd: 10,
        notes: null,
        tags: [],
        sourceId: 'binance',
        externalId: null,
        originalType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}
