/**
 * Health check routes.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';

export async function healthRoutes(app: FastifyInstance) {
    // Basic health check
    app.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Deep health check (includes DB)
    app.get('/health/deep', async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return {
                status: 'ok',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'connected',
                },
            };
        } catch {
            return {
                status: 'degraded',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'disconnected',
                },
            };
        }
    });
}
