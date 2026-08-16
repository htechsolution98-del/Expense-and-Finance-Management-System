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

    // Get config
    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    // Geofence check
    let isWithinGeofence = true;
    if (config?.geoFencingEnabled && config.geoLat != null && config.geoLng != null && latitude && longitude) {
      const distance = haversineDistance(config.geoLat, config.geoLng, latitude, longitude);
      isWithinGeofence = distance <= config.geoRadiusMeters;
    }

    // Calculate late
    let lateBy: number | null = null;
    if (config) {
      const officeStart = timeToMinutes(config.officeStartTime);
      const graceEnd = officeStart + config.graceMinutes;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes > graceEnd) {
        lateBy = currentMinutes - officeStart;
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

    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: true },
    });

    if (!record) throw new BadRequestError('You have not checked in today.');
    if (record.status === 'CHECKED_OUT') throw new BadRequestError('You have already checked out today.');
    if (record.status === 'ON_BREAK') throw new BadRequestError('Please end your break before checking out.');

    // Get config for early exit calc
    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    let earlyExitBy: number | null = null;
    if (config) {
      const officeEnd = timeToMinutes(config.officeEndTime);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < officeEnd) {
        earlyExitBy = officeEnd - currentMinutes;
      }
    }

    // Calculate total work & break minutes
    const totalBreakMinutes = record.breaks.reduce((acc, b) => {
      return acc + (b.durationMinutes || 0);
    }, 0);

    const workMs = now.getTime() - record.checkInTime.getTime();
    const totalWorkMinutes = Math.round(workMs / 60000) - totalBreakMinutes;

    // Check if half day
    let isHalfDay = false;
    if (config && config.halfDayMinutes > 0) {
      isHalfDay = totalWorkMinutes < config.halfDayMinutes;
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
    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: true },
    });

    if (!record) throw new BadRequestError('You have not checked in today.');
    if (record.status === 'CHECKED_OUT') throw new BadRequestError('You have already checked out.');
    if (record.status === 'ON_BREAK') throw new BadRequestError('You are already on a break.');

    const companyId = req.user!.companyId;
    const config = await prisma.attendanceConfig.findUnique({ where: { companyId } });

    // Validate current time is within breakStartTime and breakEndTime window
    if (config && config.breakStartTime && config.breakEndTime) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = timeToMinutes(config.breakStartTime);
      const endMinutes = timeToMinutes(config.breakEndTime);
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        throw new BadRequestError(`Breaks are only allowed between ${config.breakStartTime} and ${config.breakEndTime}.`);
      }
    }

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
    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: { orderBy: { breakStart: 'desc' }, take: 1 } },
    });

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
    const record = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
      include: { breaks: { orderBy: { breakStart: 'asc' } } },
    });

    res.json({ status: 'success', data: record });
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

    let dateFilter: any = {};
    if (date) {
      const [year, month, day] = (date as string).split('-').map(Number);
      const d = new Date(year, month - 1, day);
      dateFilter = { date: d };
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
      dateFilter = { date: getTodayDate() };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { companyId, ...dateFilter },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } },
        },
        breaks: { orderBy: { breakStart: 'asc' } },
      },
      orderBy: { checkInTime: 'asc' },
    });

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
