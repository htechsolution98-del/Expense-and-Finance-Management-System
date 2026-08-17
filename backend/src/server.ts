import * as dotenv from 'dotenv';
import app from './app';
import { prisma } from './config/database';
import { logger } from './config/logger';
import { startAutoCheckoutCron } from './jobs/autoCheckout.job';

dotenv.config();

const PORT = process.env.PORT || 5000;

function getDatabaseProviderName(url: string): string {
  if (!url) return 'Database';
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.startsWith('file:') || lowercaseUrl.includes('.db') || lowercaseUrl.includes('sqlite')) {
    return 'SQLite';
  }
  if (lowercaseUrl.startsWith('postgresql:') || lowercaseUrl.startsWith('postgres:')) {
    return 'PostgreSQL';
  }
  if (lowercaseUrl.startsWith('mysql:')) {
    return 'MySQL';
  }
  if (lowercaseUrl.startsWith('mongodb:') || lowercaseUrl.startsWith('mongodb+srv:')) {
    return 'MongoDB';
  }
  if (lowercaseUrl.startsWith('sqlserver:')) {
    return 'SQL Server';
  }
  return 'Database';
}

async function bootstrap() {
  try {
    // 1. Verify connection to Database
    const dbUrl = process.env.DATABASE_URL || '';
    const dbProviderName = getDatabaseProviderName(dbUrl);
    
    logger.info(`Connecting to ${dbProviderName} database...`);
    try {
      await prisma.$connect();
      if (dbProviderName === 'SQLite') {
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
      }
      logger.info(`${dbProviderName} database connection established successfully`);
    } catch (dbErr) {
      logger.error(`
======================================================================
DATABASE CONNECTION ERROR:
Failed to connect to the ${dbProviderName} database.

Please check the following:
1. The database server is running or the database file exists.
2. The credentials and permissions allow read/write access.
3. The Prisma schema is correctly compiled and migrated.
4. Active DATABASE_URL: ${dbUrl}

Error details: ${(dbErr as Error).message}
======================================================================
`);
      throw dbErr;
    }

    // 2. Start Express Listener
    const server = app.listen(PORT, () => {
      logger.info(
        `Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
      );
      // 3. Start background cron jobs
      startAutoCheckoutCron();
    });

    // 3. Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down server gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await prisma.$disconnect();
        logger.info('Database connections disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to bootstrap server due to initialization error');
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Global handlers for unhandled errors
process.on('uncaughtException', (err) => {
  logger.error(err, 'Uncaught Exception thrown');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ promise, reason }, 'Unhandled Rejection at Promise');
  process.exit(1);
});

bootstrap();
