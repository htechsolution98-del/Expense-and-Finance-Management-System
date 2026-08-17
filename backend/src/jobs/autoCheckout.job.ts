import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Auto-Checkout Cron Job
 * Runs every day at 00:01 AM (1 minute past midnight).
 * Finds all CHECKED_IN or ON_BREAK attendance records from the PREVIOUS day
 * and automatically checks them out at the configured office end time.
 */
export function startAutoCheckoutCron() {
  // Runs at 00:01 every night
  cron.schedule('1 0 * * *', async () => {
    logger.info('[AutoCheckout] Cron triggered — processing unchecked records from yesterday...');

    try {
      const now = new Date();
      // Yesterday midnight
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      // Today midnight (exclusive upper bound)
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find all unclosed records from yesterday
      const openRecords = await prisma.attendanceRecord.findMany({
        where: {
          date: { gte: yesterday, lt: todayMidnight },
          status: { in: ['CHECKED_IN', 'ON_BREAK'] },
          checkOutTime: null,
        },
        include: { breaks: { orderBy: { breakStart: 'asc' } } },
      });

      if (openRecords.length === 0) {
        logger.info('[AutoCheckout] No open records found. Nothing to process.');
        return;
      }

      logger.info('[AutoCheckout] Found ' + openRecords.length + ' open record(s).');

      for (const record of openRecords) {
        const config = await prisma.attendanceConfig.findUnique({
          where: { companyId: record.companyId },
        });

        // Use office end time from config, default 18:00
        const officeEndStr = config?.officeEndTime ?? '18:00';
        const [endH, endM] = officeEndStr.split(':').map(Number);

        const autoCheckOut = new Date(yesterday);
        autoCheckOut.setHours(endH, endM, 0, 0);

        const checkInTime = new Date(record.checkInTime);
        // Ensure checkout is always after check-in
        const effectiveCheckOut = autoCheckOut > checkInTime
          ? autoCheckOut
          : new Date(checkInTime.getTime() + 60000);

        // Close any open break
        const openBreak = record.breaks.find((b) => b.breakEnd == null);
        let totalBreakMinutes = record.breaks
          .filter((b) => b.breakEnd != null)
          .reduce((acc, b) => acc + (b.durationMinutes ?? 0), 0);

        if (openBreak) {
          const breakMs = effectiveCheckOut.getTime() - new Date(openBreak.breakStart).getTime();
          const breakMins = Math.max(0, Math.round(breakMs / 60000));
          totalBreakMinutes += breakMins;
          await prisma.attendanceBreak.update({
            where: { id: openBreak.id },
            data: { breakEnd: effectiveCheckOut, durationMinutes: breakMins },
          });
        }

        // Net work minutes
        const grossMins = Math.round((effectiveCheckOut.getTime() - checkInTime.getTime()) / 60000);
        const netWorkMins = Math.max(0, grossMins - totalBreakMinutes);

        // Early exit calculation
        let earlyExitBy: number | null = null;
        if (config) {
          const [eh, em] = config.officeEndTime.split(':').map(Number);
          const officeEndMins = eh * 60 + em;
          const checkOutMins = effectiveCheckOut.getHours() * 60 + effectiveCheckOut.getMinutes();
          if (checkOutMins < officeEndMins) earlyExitBy = officeEndMins - checkOutMins;
        }

        // Half-day check
        let isHalfDay = record.isHalfDay;
        if (config && config.halfDayMinutes > 0) {
          isHalfDay = netWorkMins < config.halfDayMinutes;
        }

        await prisma.attendanceRecord.update({
          where: { id: record.id },
          data: {
            checkOutTime: effectiveCheckOut,
            status: 'CHECKED_OUT',
            totalWorkMinutes: netWorkMins,
            totalBreakMinutes,
            earlyExitBy,
            isHalfDay,
            checkOutNote: 'Auto-checked out at end of day by system.',
          },
        });

        logger.info('[AutoCheckout] Record ' + record.id + ' auto-checked out. Work: ' + netWorkMins + 'm, Break: ' + totalBreakMinutes + 'm');
      }

      logger.info('[AutoCheckout] Done — ' + openRecords.length + ' record(s) processed.');
    } catch (err) {
      logger.error(err, '[AutoCheckout] Error during cron execution');
    }
  });

  logger.info('[AutoCheckout] Scheduled: runs daily at 00:01 AM.');
}
