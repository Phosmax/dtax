/**
 * Application configuration loaded from environment variables.
 */

import 'dotenv/config';

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL || '',
} as const;
