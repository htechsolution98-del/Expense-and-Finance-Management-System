import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Auto-Checkout Cron Job
 * Runs every hour at minute 1 to check unclosed attendance records.
 * For normal day shifts, checks out at shift end time.
 * For night shifts (crossing midnight), preserves the shift until the next morning and checks out at morning end time.
 */
export function startAutoCheckoutCron() {
  // Runs every hour at minute 1
  cron.schedule('1 * * * *', async () => {
    logger.info('[AutoCheckout] Cron triggered — evaluating open attendance records...');

    try {
      const now = new Date();
      // Look for open records from the last 48 hours
      const openRecords = await prisma.attendanceRecord.findMany({
        where: {
          status: { in: ['CHECKED_IN', 'ON_BREAK'] },
          checkOutTime: null,
          checkInTime: { gte: new Date(Date.now() - 48 * 3600 * 1000) },
        },
        include: {
          breaks: { orderBy: { breakStart: 'asc' } },
          shift: true,
          employee: { include: { shift: true } },
        },
      });

      if (openRecords.length === 0) {
        return;
      }

      logger.info('[AutoCheckout] Found ' + openRecords.length + ' open record(s) to evaluate.');

      for (const record of openRecords) {
        const config = await prisma.attendanceConfig.findUnique({
          where: { companyId: record.companyId },
        });

        const activeShift = record.shift || record.employee?.shift;
        const isNight = activeShift?.isNightShift ?? false;
        const officeEndStr = activeShift?.endTime ?? config?.officeEndTime ?? '18:00';
        const [endH, endM] = officeEndStr.split(':').map(Number);

        // Calculate target checkout time
        const checkOutDate = new Date(record.date);
        if (isNight) {
          // Night shifts cross into the next morning
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
        checkOutDate.setHours(endH, endM, 0, 0);

        // If the shift has not concluded, or within a 2-hour handover buffer after shift end, skip!
        // This gives employees 2 hours to complete patient handovers/charting and check out themselves.
        const handoverGraceThreshold = new Date(checkOutDate.getTime() + 2 * 3600 * 1000);
        if (now < handoverGraceThreshold) {
          continue;
        }

        const autoCheckOut = checkOutDate;
        const checkInTime = new Date(record.checkInTime);
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

        // Early exit calculation based on shift
        let earlyExitBy: number | null = null;
        const [eh, em] = officeEndStr.split(':').map(Number);
        const officeEndMins = eh * 60 + em;
        const checkOutMins = effectiveCheckOut.getHours() * 60 + effectiveCheckOut.getMinutes();
        if (!activeShift?.isNightShift && checkOutMins < officeEndMins) {
          earlyExitBy = officeEndMins - checkOutMins;
        }

        // Half-day check based on shift requirements
        const halfDayThreshold = activeShift?.halfDayMinutes ?? config?.halfDayMinutes ?? 240;
        let isHalfDay = record.isHalfDay;
        if (halfDayThreshold > 0) {
          isHalfDay = netWorkMins < halfDayThreshold;
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
            checkOutNote: 'Auto-checked out at end of shift by system.',
          },
        });

        logger.info('[AutoCheckout] Record ' + record.id + ' auto-checked out. Work: ' + netWorkMins + 'm, Break: ' + totalBreakMinutes + 'm');
      }
    } catch (err) {
      logger.error(err, '[AutoCheckout] Error during cron execution');
    }
  });

  logger.info('[AutoCheckout] Scheduled: runs hourly to evaluate concluded shifts.');
}
