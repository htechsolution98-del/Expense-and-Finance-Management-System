import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { BadRequestError, ForbiddenError } from '../utils/errors';


// ── Validators ────────────────────────────────────────────────────────────────

const configSchema = z.object({
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  graceMinutes: z.number().int().min(0).max(120),
  breakDurationMinutes: z.number().int().min(0).max(180),
  halfDayMinutes: z.number().int().min(0).max(720).optional(),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional(),
  geoLat: z.number().min(-90).max(90).nullable().optional(),
  geoLng: z.number().min(-180).max(180).nullable().optional(),
  geoRadiusMeters: z.number().int().min(50).max(5000).optional(),
  geoFencingEnabled: z.boolean().optional(),
  selfieRequired: z.boolean().optional(),
});

const checkInSchema = z.object({
  latitude: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().optional()),
  longitude: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().optional()),
});

const checkOutSchema = z.object({
  latitude: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().optional()),
  longitude: z.preprocess((val) => val === undefined || val === '' || val === null ? undefined : Number(val), z.number().optional()),
});

export const shiftSchema = z.object({
  name: z.string().min(2, 'Shift name must be at least 2 characters'),
  code: z.string().optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM'),
  graceMinutes: z.number().int().min(0).max(120).default(15),
  halfDayMinutes: z.number().int().min(0).max(720).default(240),
  breakDurationMinutes: z.number().int().min(0).max(180).default(60),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional().nullable(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').optional().nullable(),
  selfieRequired: z.boolean().default(false),
  geoFencingEnabled: z.boolean().default(false),
  geoLat: z.preprocess((val) => val === '' || val === null || val === undefined ? null : Number(val), z.number().nullable().optional()),
  geoLng: z.preprocess((val) => val === '' || val === null || val === undefined ? null : Number(val), z.number().nullable().optional()),
  geoRadiusMeters: z.preprocess((val) => val === '' || val === null || val === undefined ? 200 : Number(val), z.number().int().min(20).max(10000).optional().nullable()),
  isNightShift: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const DEFAULT_COMPANY_SHIFTS = [
  {
    name: 'General Shift',
    code: 'GEN',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    halfDayMinutes: 240,
    breakDurationMinutes: 60,
    breakStartTime: '13:00',
    breakEndTime: '14:00',
    isNightShift: false,
    isDefault: true,
  },
  {
    name: 'Morning Shift',
    code: 'MORN',
    startTime: '07:00',
    endTime: '15:00',
    graceMinutes: 15,
    halfDayMinutes: 240,
    breakDurationMinutes: 45,
    breakStartTime: '11:00',
    breakEndTime: '11:45',
    isNightShift: false,
    isDefault: false,
  },
  {
    name: 'Evening Shift',
    code: 'EVE',
    startTime: '15:00',
    endTime: '23:00',
    graceMinutes: 15,
    halfDayMinutes: 240,
    breakDurationMinutes: 45,
    breakStartTime: '19:00',
    breakEndTime: '19:45',
    isNightShift: false,
    isDefault: false,
  },
  {
    name: 'Night Shift',
    code: 'NIGHT',
    startTime: '23:00',
    endTime: '07:00',
    graceMinutes: 15,
    halfDayMinutes: 240,
    breakDurationMinutes: 45,
    breakStartTime: '03:00',
    breakEndTime: '03:45',
    isNightShift: true,
    isDefault: false,
  },
];

// ── Haversine Distance ────────────────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Helper: Get today's date (midnight) in UTC ────────────────────────────────

function getTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ── Helper: Parse HH:MM to minutes since midnight ────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function validateShiftBreakTiming(
  startTime: string,
  endTime: string,
  breakStartTime: string | null | undefined,
  breakEndTime: string | null | undefined,
  breakDurationMinutes: number,
  isNightShift: boolean
): string | null {
  if (!breakStartTime && !breakEndTime) {
    return null;
  }
  if (!breakStartTime || !breakEndTime) {
    return 'Both Break Allowed From and Break Allowed Until must be provided.';
  }

  const startM = timeToMinutes(startTime);
  const endM = timeToMinutes(endTime);
  const bStartM = timeToMinutes(breakStartTime);
  const bEndM = timeToMinutes(breakEndTime);

  if (!isNightShift) {
    if (startM >= endM) {
      return `Shift End Time (${endTime}) must be after Shift Start Time (${startTime}). If shift crosses midnight, please enable Night Shift.`;
    }
    if (bStartM < startM || bStartM >= endM) {
      return `Break Allowed From (${breakStartTime}) is outside working hours (${startTime} - ${endTime}). Break must be within shift hours.`;
    }
    if (bEndM <= startM || bEndM > endM) {
      return `Break Allowed Until (${breakEndTime}) is outside working hours (${startTime} - ${endTime}). Break must be within shift hours.`;
    }
    if (bEndM <= bStartM) {
      return `Break Allowed Until (${breakEndTime}) must be later than Break Allowed From (${breakStartTime}).`;
    }
    const windowMinutes = bEndM - bStartM;
    if (breakDurationMinutes > windowMinutes) {
      return `Allowed break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${breakStartTime} - ${breakEndTime}).`;
    }
  } else {
    // Night shift (crosses midnight, e.g. 23:00 to 07:00)
    const isWithinNightShift = (m: number) => m >= startM || m <= endM;
    if (!isWithinNightShift(bStartM)) {
      return `Break Allowed From (${breakStartTime}) is outside night shift hours (${startTime} - ${endTime}). Break must be within shift hours.`;
    }
    if (!isWithinNightShift(bEndM)) {
      return `Break Allowed Until (${breakEndTime}) is outside night shift hours (${startTime} - ${endTime}). Break must be within shift hours.`;
    }

    let windowMinutes = 0;
    if (bStartM >= startM && bEndM <= endM) {
      // Break crosses midnight (e.g. 23:30 to 00:30)
      windowMinutes = (1440 - bStartM) + bEndM;
    } else if ((bStartM >= startM && bEndM >= startM) || (bStartM <= endM && bEndM <= endM)) {
      if (bEndM <= bStartM) {
        return `Break Allowed Until (${breakEndTime}) must be later than Break Allowed From (${breakStartTime}).`;
      }
      windowMinutes = bEndM - bStartM;
    } else {
      return `Break window (${breakStartTime} - ${breakEndTime}) is outside the night shift schedule (${startTime} - ${endTime}).`;
    }

    if (breakDurationMinutes > windowMinutes) {
      return `Allowed break duration (${breakDurationMinutes} mins) cannot exceed the break window of ${windowMinutes} mins (${breakStartTime} - ${breakEndTime}).`;
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const getAttendanceConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    let config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    if (!config) {
      // Return defaults
      config = {
        id: '',
        companyId,
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        graceMinutes: 15,
        breakDurationMinutes: 60,
        halfDayMinutes: 240,
        breakStartTime: '13:00',
        breakEndTime: '14:00',
        geoLat: null,
        geoLng: null,
        geoRadiusMeters: 200,
        geoFencingEnabled: false,
        selfieRequired: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
};

export const upsertAttendanceConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can configure attendance settings.');
    }

    const companyId = req.user!.companyId;
    const data = configSchema.parse(req.body);

    const breakError = validateShiftBreakTiming(
      data.officeStartTime,
      data.officeEndTime,
      data.breakStartTime,
      data.breakEndTime,
      data.breakDurationMinutes,
      false
    );
    if (breakError) {
      throw new BadRequestError(breakError);
    }

    // Geofencing coordinates validation: if shift geofencing is on, verify either shift or company has coordinates
    if (data.geoFencingEnabled && (data.geoLat == null || data.geoLng == null)) {
      const companyConfig = await prisma.attendanceConfig.findUnique({ where: { companyId } });
      if (!companyConfig || companyConfig.geoLat == null || companyConfig.geoLng == null) {
        throw new BadRequestError('GPS Coordinates (Latitude & Longitude) must be provided when Geofencing is enabled.');
      }
    }

    const config = await prisma.attendanceConfig.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });

    res.json({ status: 'success', message: 'Attendance configuration saved.', data: config });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CHECK-IN / CHECK-OUT
// ══════════════════════════════════════════════════════════════════════════════

export const checkIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new BadRequestError('No linked employee profile found for this user.');

    const { latitude, longitude } = checkInSchema.parse(req.body);
    const today = getTodayDate();
    const now = new Date();

    // Check if already checked in today
    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (existing) {
      throw new BadRequestError('You have already checked in today.');
    }

    // Check if an open attendance session exists from yesterday (e.g. overnight night shift)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const openYesterday = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: yesterday } },
    });
    if (openYesterday && (openYesterday.status === 'CHECKED_IN' || openYesterday.status === 'ON_BREAK')) {
      throw new BadRequestError('You currently have an active check-in session from your previous shift. Please check out before starting a new shift.');
    }

    // Get employee to check WFH permission and assigned shift
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });
    if (!employee) throw new BadRequestError('Employee profile not found.');

    // Check if employee has an approved leave request covering today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const approvedLeaveToday = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: 'APPROVED',
        fromDate: { lte: endOfDay },
        toDate: { gte: startOfDay },
      },
      include: {
        leaveType: true,
      },
    });

    if (approvedLeaveToday && approvedLeaveToday.dayType !== 'HALF_DAY') {
      throw new BadRequestError(
        `Check-in blocked: You are currently on an approved leave today (${approvedLeaveToday.leaveType?.name || 'Leave'}). If you reported to work and need to check in, please contact Admin or Super Admin to mark your attendance manually.`
      );
    }

    // Get config
    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    const activeShift = employee.shift;
    const isGeoRequired = activeShift?.geoFencingEnabled || config?.geoFencingEnabled || false;
    const isSelfieRequired = activeShift?.selfieRequired || config?.selfieRequired || false;

    // Shift coordinates override company office coordinates if provided
    const targetLat = activeShift?.geoLat ?? config?.geoLat;
    const targetLng = activeShift?.geoLng ?? config?.geoLng;
    const targetRadius = activeShift?.geoRadiusMeters ?? config?.geoRadiusMeters ?? 200;

    // Selfie check
    if (isSelfieRequired && !req.file) {
      throw new BadRequestError('Check-in blocked: A live selfie verification photo is required for your shift.');
    }

    // Geofence check
    let isWithinGeofence = true;
    if (isGeoRequired && targetLat != null && targetLng != null) {
      if (latitude && longitude) {
        const distance = haversineDistance(targetLat, targetLng, latitude, longitude);
        isWithinGeofence = distance <= targetRadius;
        if (!isWithinGeofence) {
          if (!employee.allowWFH) {
            throw new BadRequestError(`Check-in blocked: You are outside the shift geofence boundary (${Math.round(distance)}m away, limit is ${targetRadius}m) and do not have Work From Home permission.`);
          }
          // If WFH is allowed, treat as geofence compliant
          isWithinGeofence = true;
        }
      } else {
        if (!employee.allowWFH) {
          throw new BadRequestError('Check-in blocked: Geolocation is required for attendance verification.');
        }
      }
    }

    // Shift-aware late calculation:
    // If employee has a specific shift assigned, use its startTime & graceMinutes; otherwise fallback to company config
    let lateBy: number | null = null;
    const startTimeStr = activeShift?.startTime ?? config?.officeStartTime ?? '09:00';
    const graceMin = activeShift?.graceMinutes ?? config?.graceMinutes ?? 15;
    const isNightShift = activeShift?.isNightShift ?? false;

    const startMinutes = timeToMinutes(startTimeStr);
    const graceEnd = startMinutes + graceMin;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (!isNightShift) {
      if (currentMinutes > graceEnd) {
        lateBy = currentMinutes - startMinutes;
      }
    } else {
      // Overnight / night shift handling (e.g. shift starts 23:00 / 1380m)
      if (startMinutes > 12 * 60) {
        if (currentMinutes > graceEnd) {
          lateBy = currentMinutes - startMinutes;
        } else if (currentMinutes < 12 * 60 && currentMinutes > graceMin) {
          lateBy = (1440 - startMinutes) + currentMinutes;
        }
      }
    }

    // Handle selfie upload
    let checkInSelfie: string | null = null;
    if (req.file) {
      checkInSelfie = req.file.path.replace(/\\/g, '/');
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        companyId,
        employeeId,
        shiftId: employee.shiftId || activeShift?.id || null,
        date: today,
        checkInTime: now,
        checkInLat: latitude || null,
        checkInLng: longitude || null,
        checkInSelfie,
        status: 'CHECKED_IN',
        lateBy,
        isWithinGeofence,
      },
    });

    res.status(201).json({
      status: 'success',
      message: lateBy ? `Checked in (${lateBy} min late).` : 'Checked in successfully!',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new BadRequestError('No linked employee profile found for this user.');

    const { latitude, longitude } = checkOutSchema.parse(req.body);
    const today = getTodayDate();
    const now = new Date();

    let record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: {
        breaks: true,
        shift: true,
        employee: {
          include: { shift: true },
        },
      },
    });

    // For night shifts crossing midnight: if today has no record, check yesterday's open record
    if (!record) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayRecord = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: yesterday } },
        include: {
          breaks: true,
          shift: true,
          employee: {
            include: { shift: true },
          },
        },
      });

      if (yesterdayRecord && (yesterdayRecord.status === 'CHECKED_IN' || yesterdayRecord.status === 'ON_BREAK')) {
        record = yesterdayRecord;
      }
    }

    if (!record) throw new BadRequestError('You have not checked in today.');
    if (record.status === 'CHECKED_OUT') throw new BadRequestError('You have already checked out today.');
    if (record.status === 'ON_BREAK') throw new BadRequestError('Please end your break before checking out.');

    // Get config for early exit & half day fallback
    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    // Effective shift timings
    const activeShift = record.shift || record.employee.shift;
    const endTimeStr = activeShift?.endTime ?? config?.officeEndTime ?? '18:00';
    const halfDayThreshold = activeShift?.halfDayMinutes ?? config?.halfDayMinutes ?? 240;

    let earlyExitBy: number | null = null;
    const officeEnd = timeToMinutes(endTimeStr);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (!activeShift?.isNightShift) {
      if (currentMinutes < officeEnd) {
        earlyExitBy = officeEnd - currentMinutes;
      }
    } else {
      // Night shift concluding next morning (e.g. shift ends at 07:00 / 420 mins)
      if (currentMinutes < officeEnd && currentMinutes >= 0) {
        earlyExitBy = officeEnd - currentMinutes;
      }
    }

    // Calculate total work & break minutes
    const totalBreakMinutes = record.breaks.reduce((acc, b) => {
      return acc + (b.durationMinutes || 0);
    }, 0);

    const workMs = now.getTime() - record.checkInTime.getTime();
    const totalWorkMinutes = Math.round(workMs / 60000) - totalBreakMinutes;

    // Check if half day based on shift requirements
    let isHalfDay = false;
    if (halfDayThreshold > 0) {
      isHalfDay = totalWorkMinutes < halfDayThreshold;
    }

    const isSelfieRequired = activeShift?.selfieRequired || config?.selfieRequired || false;
    if (isSelfieRequired && !req.file) {
      throw new BadRequestError('Check-out blocked: A live selfie verification photo is required for your shift.');
    }

    const isGeoRequired = activeShift?.geoFencingEnabled || config?.geoFencingEnabled || false;
    const targetLat = activeShift?.geoLat ?? config?.geoLat;
    const targetLng = activeShift?.geoLng ?? config?.geoLng;
    const targetRadius = activeShift?.geoRadiusMeters ?? config?.geoRadiusMeters ?? 200;

    if (isGeoRequired && targetLat != null && targetLng != null) {
      if (latitude && longitude) {
        const distance = haversineDistance(targetLat, targetLng, latitude, longitude);
        if (distance > targetRadius && !record.employee.allowWFH) {
          throw new BadRequestError(`Check-out blocked: You are outside the shift geofence boundary (${Math.round(distance)}m away, limit is ${targetRadius}m).`);
        }
      } else if (!record.employee.allowWFH) {
        throw new BadRequestError('Check-out blocked: Geolocation is required for attendance verification.');
      }
    }

    // Handle selfie
    let checkOutSelfie: string | null = null;
    if (req.file) {
      checkOutSelfie = req.file.path.replace(/\\/g, '/');
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        checkOutLat: latitude || null,
        checkOutLng: longitude || null,
        checkOutSelfie,
        totalWorkMinutes,
        totalBreakMinutes,
        earlyExitBy,
        status: 'CHECKED_OUT',
        isHalfDay,
      },
    });

    res.json({
      status: 'success',
      message: isHalfDay
        ? `Checked out (Half Day). Total work: ${Math.floor(totalWorkMinutes / 60)}h ${totalWorkMinutes % 60}m.`
        : `Checked out. Total work: ${Math.floor(totalWorkMinutes / 60)}h ${totalWorkMinutes % 60}m.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// BREAK MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

export const startBreak = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new BadRequestError('No linked employee profile found.');

    const today = getTodayDate();
    let record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: true, shift: true, employee: { include: { shift: true } } },
    });

    if (!record) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayRecord = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: yesterday } },
        include: { breaks: true, shift: true, employee: { include: { shift: true } } },
      });
      if (yesterdayRecord && (yesterdayRecord.status === 'CHECKED_IN' || yesterdayRecord.status === 'ON_BREAK')) {
        record = yesterdayRecord;
      }
    }

    if (!record) throw new BadRequestError('You have not checked in today.');
    if (record.status === 'CHECKED_OUT') throw new BadRequestError('You have already checked out.');
    if (record.status === 'ON_BREAK') throw new BadRequestError('You are already on a break.');

    const breakRecord = await prisma.attendanceBreak.create({
      data: {
        attendanceId: record.id,
        breakStart: new Date(),
      },
    });

    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { status: 'ON_BREAK' },
    });

    res.json({ status: 'success', message: 'Break started.', data: breakRecord });
  } catch (error) {
    next(error);
  }
};

export const endBreak = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new BadRequestError('No linked employee profile found.');

    const today = getTodayDate();
    let record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: { orderBy: { breakStart: 'desc' }, take: 1 } },
    });

    if (!record) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayRecord = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: yesterday } },
        include: { breaks: { orderBy: { breakStart: 'desc' }, take: 1 } },
      });
      if (yesterdayRecord && yesterdayRecord.status === 'ON_BREAK') {
        record = yesterdayRecord;
      }
    }

    if (!record) throw new BadRequestError('You have not checked in today.');
    if (record.status !== 'ON_BREAK') throw new BadRequestError('You are not on a break.');

    const activeBreak = record.breaks[0];
    if (!activeBreak || activeBreak.breakEnd) throw new BadRequestError('No active break found.');

    const now = new Date();
    const durationMs = now.getTime() - activeBreak.breakStart.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    await prisma.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: { breakEnd: now, durationMinutes },
    });

    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: { status: 'CHECKED_IN' },
    });

    res.json({ status: 'success', message: `Break ended. Duration: ${durationMinutes} minutes.` });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE QUERIES
// ══════════════════════════════════════════════════════════════════════════════

export const getTodayStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.json({ status: 'success', data: null });
      return;
    }

    const today = getTodayDate();
    let record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: { orderBy: { breakStart: 'asc' } }, shift: true },
    });

    // Check if employee has an active night shift session from yesterday
    if (!record || record.status === 'CHECKED_OUT') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayRecord = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId, date: yesterday } },
        include: { breaks: { orderBy: { breakStart: 'asc' } }, shift: true },
      });
      if (yesterdayRecord && (yesterdayRecord.status === 'CHECKED_IN' || yesterdayRecord.status === 'ON_BREAK')) {
        record = yesterdayRecord;
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { allowWFH: true },
    });

    // Check if employee has an approved leave request covering today
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const approvedLeaveToday = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: 'APPROVED',
        fromDate: { lte: endOfDay },
        toDate: { gte: startOfDay },
      },
      include: { leaveType: true },
    });

    res.json({
      status: 'success',
      data: record,
      allowWFH: employee?.allowWFH || false,
      approvedLeaveToday: approvedLeaveToday
        ? {
            id: approvedLeaveToday.id,
            leaveTypeName: approvedLeaveToday.leaveType?.name || 'Leave',
            reason: approvedLeaveToday.reason,
            dayType: approvedLeaveToday.dayType,
            fromDate: approvedLeaveToday.fromDate,
            toDate: approvedLeaveToday.toDate,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) {
      res.json({ status: 'success', data: [] });
      return;
    }

    const { month, year } = req.query;
    const now = new Date();
    const m = month ? parseInt(month as string) : now.getMonth() + 1;
    const y = year ? parseInt(year as string) : now.getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      include: { breaks: { orderBy: { breakStart: 'asc' } } },
      orderBy: { date: 'desc' },
    });

    res.json({ status: 'success', data: records });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN QUERIES
// ══════════════════════════════════════════════════════════════════════════════

export const getAllAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      req.user!.role !== 'SUPER_ADMIN' &&
      req.user!.role !== 'ADMIN' &&
      !req.user!.role.startsWith('ACCOUNT')
    ) {
      throw new ForbiddenError('Only admins can view all attendance records.');
    }

    const companyId = req.user!.companyId;
    const { date, startDate, endDate } = req.query;

    let targetDate = getTodayDate();
    let dateFilter: any = {};
    if (date) {
      const [year, month, day] = (date as string).split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
      dateFilter = { date: targetDate };
    } else if (startDate && endDate) {
      const [sy, sm, sd] = (startDate as string).split('-').map(Number);
      const [ey, em, ed] = (endDate as string).split('-').map(Number);
      dateFilter = {
        date: {
          gte: new Date(sy, sm - 1, sd),
          lte: new Date(ey, em - 1, ed, 23, 59, 59),
        },
      };
    } else {
      // Default: today
      dateFilter = { date: targetDate };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { companyId, ...dateFilter },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: { select: { name: true } },
            shift: { select: { id: true, name: true, code: true, startTime: true, endTime: true, isNightShift: true } },
          },
        },
        shift: { select: { id: true, name: true, code: true, startTime: true, endTime: true, isNightShift: true } },
        breaks: { orderBy: { breakStart: 'asc' } },
      },
      orderBy: { checkInTime: 'asc' },
    });

    if (date || (!startDate && !endDate)) {
      // Single date query: merge active employees to show absent status
      const activeEmployees = await prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          department: { select: { name: true } },
          shift: { select: { id: true, name: true, code: true, startTime: true, endTime: true, isNightShift: true } },
        },
      });

      const recordMap = new Map<string, typeof records[0]>();
      for (const record of records) {
        recordMap.set(record.employeeId, record);
      }

      const mergedRecords = activeEmployees.map((emp) => {
        const existingRecord = recordMap.get(emp.id);
        if (existingRecord) {
          return existingRecord;
        }
        return {
          id: `absent-${emp.id}-${date || 'today'}`,
          employeeId: emp.id,
          companyId,
          date: targetDate,
          checkInTime: null,
          checkOutTime: null,
          checkInLat: null,
          checkInLng: null,
          checkOutLat: null,
          checkOutLng: null,
          checkInSelfie: null,
          checkOutSelfie: null,
          status: 'ABSENT',
          lateBy: null,
          earlyExitBy: null,
          isWithinGeofence: false,
          isHalfDay: false,
          totalWorkMinutes: null,
          totalBreakMinutes: null,
          breaks: [],
          employee: emp,
        };
      });

      // Sort: Present first (sorted by check-in time), then Absent (alphabetically by name)
      mergedRecords.sort((a, b) => {
        if (a.status === 'ABSENT' && b.status !== 'ABSENT') return 1;
        if (a.status !== 'ABSENT' && b.status === 'ABSENT') return -1;
        if (a.status !== 'ABSENT' && b.status !== 'ABSENT') {
          const aTime = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          const bTime = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          return aTime - bTime;
        }
        return (a.employee?.name || '').localeCompare(b.employee?.name || '');
      });

      res.json({ status: 'success', data: mergedRecords });
      return;
    }

    res.json({ status: 'success', data: records });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      req.user!.role !== 'SUPER_ADMIN' &&
      req.user!.role !== 'ADMIN' &&
      !req.user!.role.startsWith('ACCOUNT')
    ) {
      throw new ForbiddenError('Only admins can view attendance reports.');
    }

    const companyId = req.user!.companyId;
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const records = await prisma.attendanceRecord.findMany({
      where: { companyId, date: { gte: startDate, lte: endDate } },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate per employee
    const empMap = new Map<string, {
      name: string;
      code: string;
      department: string;
      totalDays: number;
      lateDays: number;
      earlyExitDays: number;
      avgWorkMinutes: number;
      totalWorkMinutes: number;
    }>();

    for (const r of records) {
      const key = r.employeeId;
      const existing = empMap.get(key);
      if (!existing) {
        empMap.set(key, {
          name: r.employee.name,
          code: r.employee.employeeCode,
          department: r.employee.department?.name || 'General',
          totalDays: 1,
          lateDays: r.lateBy && r.lateBy > 0 ? 1 : 0,
          earlyExitDays: r.earlyExitBy && r.earlyExitBy > 0 ? 1 : 0,
          totalWorkMinutes: r.totalWorkMinutes || 0,
          avgWorkMinutes: 0,
        });
      } else {
        existing.totalDays += 1;
        if (r.lateBy && r.lateBy > 0) existing.lateDays += 1;
        if (r.earlyExitBy && r.earlyExitBy > 0) existing.earlyExitDays += 1;
        existing.totalWorkMinutes += r.totalWorkMinutes || 0;
      }
    }

    const report = Array.from(empMap.entries()).map(([empId, data]) => ({
      employeeId: empId,
      ...data,
      avgWorkMinutes: data.totalDays > 0 ? Math.round(data.totalWorkMinutes / data.totalDays) : 0,
    }));

    // Today stats
    const today = getTodayDate();
    const todayRecords = await prisma.attendanceRecord.count({
      where: { companyId, date: today },
    });
    const todayLate = await prisma.attendanceRecord.count({
      where: { companyId, date: today, lateBy: { gt: 0 } },
    });
    const totalEmployees = await prisma.employee.count({
      where: { companyId, status: 'ACTIVE' },
    });

    res.json({
      status: 'success',
      data: {
        month,
        year,
        summary: {
          totalEmployees,
          presentToday: todayRecords,
          lateToday: todayLate,
          absentToday: totalEmployees - todayRecords,
        },
        report,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleEmployeeWFH = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can toggle WFH settings.');
    }

    const { id } = req.params;
    const { allowWFH } = req.body;

    const employee = await prisma.employee.update({
      where: { id },
      data: { allowWFH },
    });

    res.json({
      status: 'success',
      message: `WFH permission updated for ${employee.name}.`,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
};

export const createManualAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isSuperAdmin = req.user!.role === 'SUPER_ADMIN' || req.user!.permissions?.includes('*');
    const hasManualAttendanceRight =
      isSuperAdmin ||
      req.user!.permissions?.includes('ATTENDANCE_MANUAL_MARK') ||
      req.user!.permissions?.includes('ATTENDANCE_MANAGE');

    if (!hasManualAttendanceRight) {
      throw new ForbiddenError(
        'Access Denied: You do not have permission to mark manual attendance. Super Admin must grant you the "ATTENDANCE_MANUAL_MARK" permission.'
      );
    }

    const { employeeId, date, checkInTimeStr, checkOutTimeStr } = req.body;
    const companyId = req.user!.companyId;

    if (!employeeId || !date || !checkInTimeStr) {
      throw new BadRequestError('Employee, date, and check-in time are required.');
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const combineDateTime = (baseDate: Date, timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(baseDate);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const checkInTime = combineDateTime(targetDate, checkInTimeStr);
    let checkOutTime: Date | null = null;
    let totalWorkMinutes: number | null = null;
    let status = 'CHECKED_IN';

    if (checkOutTimeStr) {
      checkOutTime = combineDateTime(targetDate, checkOutTimeStr);
      if (checkOutTime < checkInTime) {
        throw new BadRequestError('Check-out time must be after check-in time.');
      }
      totalWorkMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
      status = 'CHECKED_OUT';
    }

    // Fetch employee with shift
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { shift: true },
    });
    if (!employee) throw new BadRequestError('Employee not found.');

    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });
    const activeShift = employee.shift;
    const startTimeStr = activeShift?.startTime ?? config?.officeStartTime ?? '09:00';
    const endTimeStr = activeShift?.endTime ?? config?.officeEndTime ?? '18:00';
    const graceMin = activeShift?.graceMinutes ?? config?.graceMinutes ?? 15;
    const halfDayThreshold = activeShift?.halfDayMinutes ?? config?.halfDayMinutes ?? 240;

    let lateBy: number | null = null;
    let earlyExitBy: number | null = null;
    let isHalfDay = false;

    const officeStart = timeToMinutes(startTimeStr);
    const officeEnd = timeToMinutes(endTimeStr);
    
    const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
    if (checkInMinutes > officeStart + graceMin) {
      lateBy = checkInMinutes - officeStart;
    }

    if (checkOutTime) {
      const checkOutMinutes = checkOutTime.getHours() * 60 + checkOutTime.getMinutes();
      if (!activeShift?.isNightShift && checkOutMinutes < officeEnd) {
        earlyExitBy = officeEnd - checkOutMinutes;
      }

      if (halfDayThreshold > 0 && totalWorkMinutes !== null) {
        isHalfDay = totalWorkMinutes < halfDayThreshold;
      }
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: targetDate } },
    });

    let record;
    if (existing) {
      record = await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          shiftId: employee.shiftId || null,
          checkInTime,
          checkOutTime,
          totalWorkMinutes,
          lateBy,
          earlyExitBy,
          isHalfDay,
          status,
          isWithinGeofence: true,
        },
      });
    } else {
      record = await prisma.attendanceRecord.create({
        data: {
          companyId,
          employeeId,
          shiftId: employee.shiftId || null,
          date: targetDate,
          checkInTime,
          checkOutTime,
          totalWorkMinutes,
          lateBy,
          earlyExitBy,
          isHalfDay,
          status,
          isWithinGeofence: true,
        },
      });
    }

    res.status(existing ? 200 : 201).json({
      status: 'success',
      message: existing ? 'Attendance record updated successfully.' : 'Manual attendance created successfully.',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// SHIFT MANAGEMENT ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

export const getShifts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    let shifts = await prisma.shift.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { startTime: 'asc' }],
    });

    // Auto-seed default shifts for companies that don't have shifts yet
    if (shifts.length === 0) {
      for (const defShift of DEFAULT_COMPANY_SHIFTS) {
        await prisma.shift.create({
          data: {
            ...defShift,
            companyId,
          },
        });
      }
      shifts = await prisma.shift.findMany({
        where: { companyId },
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { startTime: 'asc' }],
      });
    }

    res.json({ status: 'success', data: shifts });
  } catch (error) {
    next(error);
  }
};

export const createShift = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can create shifts.');
    }
    const companyId = req.user!.companyId;
    const data = shiftSchema.parse(req.body);

    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    const autoNightShift = data.isNightShift || (endH * 60 + endM <= startH * 60 + startM);

    const breakError = validateShiftBreakTiming(
      data.startTime,
      data.endTime,
      data.breakStartTime,
      data.breakEndTime,
      data.breakDurationMinutes,
      autoNightShift
    );
    if (breakError) {
      throw new BadRequestError(breakError);
    }

    // Geofencing coordinates validation: if shift geofencing is on, verify either shift or company has coordinates
    if (data.geoFencingEnabled && (data.geoLat == null || data.geoLng == null)) {
      const companyConfig = await prisma.attendanceConfig.findUnique({ where: { companyId } });
      if (!companyConfig || companyConfig.geoLat == null || companyConfig.geoLng == null) {
        throw new BadRequestError('GPS Coordinates (Latitude & Longitude) must be provided when Geofencing is enabled.');
      }
    }

    if (data.isDefault) {
      await prisma.shift.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const shift = await prisma.shift.create({
      data: {
        ...data,
        isNightShift: autoNightShift,
        companyId,
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      message: `Shift "${shift.name}" created successfully.`,
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

export const updateShift = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can modify shifts.');
    }
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const data = shiftSchema.parse(req.body);

    const existing = await prisma.shift.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new BadRequestError('Shift not found.');

    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    const autoNightShift = data.isNightShift || (endH * 60 + endM <= startH * 60 + startM);

    const breakError = validateShiftBreakTiming(
      data.startTime,
      data.endTime,
      data.breakStartTime,
      data.breakEndTime,
      data.breakDurationMinutes,
      autoNightShift
    );
    if (breakError) {
      throw new BadRequestError(breakError);
    }

    // Geofencing coordinates validation: if shift geofencing is on, verify either shift or company has coordinates
    if (data.geoFencingEnabled && (data.geoLat == null || data.geoLng == null)) {
      const companyConfig = await prisma.attendanceConfig.findUnique({ where: { companyId } });
      if (!companyConfig || companyConfig.geoLat == null || companyConfig.geoLng == null) {
        throw new BadRequestError('GPS Coordinates (Latitude & Longitude) must be provided when Geofencing is enabled.');
      }
    }

    if (data.isDefault) {
      await prisma.shift.updateMany({
        where: { companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...data,
        isNightShift: autoNightShift,
      },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    res.json({
      status: 'success',
      message: `Shift "${updated.name}" updated successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteShift = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can delete shifts.');
    }
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const existing = await prisma.shift.findFirst({
      where: { id, companyId },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) throw new BadRequestError('Shift not found.');

    // Unassign employees from this shift first (or reassign to company default shift)
    const defaultShift = await prisma.shift.findFirst({
      where: { companyId, isDefault: true, id: { not: id } },
    });

    await prisma.employee.updateMany({
      where: { companyId, shiftId: id },
      data: { shiftId: defaultShift?.id || null },
    });

    await prisma.shift.delete({
      where: { id },
    });

    res.json({
      status: 'success',
      message: `Shift "${existing.name}" deleted. Any assigned employees were reallocated to ${defaultShift ? defaultShift.name : 'unassigned'}.`,
    });
  } catch (error) {
    next(error);
  }
};

export const assignEmployeeShift = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only Admin or Super Admin can assign employee shifts.');
    }
    const { id } = req.params;
    const { shiftId } = req.body;
    const companyId = req.user!.companyId;

    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
    });
    if (!employee) throw new BadRequestError('Employee not found in company.');

    if (shiftId) {
      const shift = await prisma.shift.findFirst({
        where: { id: shiftId, companyId },
      });
      if (!shift) throw new BadRequestError('Specified shift was not found.');
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { shiftId: shiftId || null },
      include: {
        shift: {
          select: {
            id: true,
            name: true,
            code: true,
            startTime: true,
            endTime: true,
            isNightShift: true,
          },
        },
      },
    });

    res.json({
      status: 'success',
      message: `Shift assigned to ${updated.name} successfully.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};


