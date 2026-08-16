import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import '../middleware/tenantScope.middleware';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

// Helper to calculate total leave days excluding weekends and company holidays
export async function calculateWorkingDays(
  companyId: string,
  fromDateStr: string,
  toDateStr: string,
  dayType: string = 'FULL_DAY'
): Promise<{ totalDays: number; totalCalendarDays: number; holidaysCount: number; weekendsCount: number }> {
  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new BadRequestError('Invalid date format');
  }

  if (fromDate > toDate) {
    throw new BadRequestError('From Date cannot be after To Date');
  }

  if (dayType === 'HALF_DAY') {
    return { totalDays: 0.5, totalCalendarDays: 1, holidaysCount: 0, weekendsCount: 0 };
  }

  const currentYear = fromDate.getFullYear();

  // Fetch company leave policy
  const policy = await prisma.leavePolicy.findFirst({
    where: { companyId, year: currentYear }
  });

  const excludeWeekends = policy ? policy.excludeWeekends : true;
  const excludeHolidays = policy ? policy.excludeHolidays : true;

  // Fetch holidays for the year
  const holidays = excludeHolidays
    ? await prisma.holiday.findMany({
        where: {
          companyId,
          date: {
            gte: new Date(currentYear, 0, 1),
            lte: new Date(currentYear, 11, 31),
          },
          isOptional: false,
        },
      })
    : [];

  const holidayDatesSet = new Set(
    holidays.map((h) => new Date(h.date).toISOString().split('T')[0])
  );

  let totalDays = 0;
  let totalCalendarDays = 0;
  let holidaysCount = 0;
  let weekendsCount = 0;

  const cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    totalCalendarDays++;
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = cur.toISOString().split('T')[0];

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDatesSet.has(dateStr);

    if (isWeekend && excludeWeekends) {
      weekendsCount++;
    } else if (isHoliday && excludeHolidays) {
      holidaysCount++;
    } else {
      totalDays++;
    }

    cur.setDate(cur.getDate() + 1);
  }

  return { totalDays, totalCalendarDays, holidaysCount, weekendsCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE TYPES
// ─────────────────────────────────────────────────────────────────────────────
export const getLeaveTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const leaveTypes = await prisma.leaveType.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    sendSuccess(res, 'Leave types retrieved successfully', leaveTypes);
  } catch (err) {
    next(err);
  }
};

export const createLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { code, name, description, isPaid, annualQuota, maxConsecutiveDays, allowHalfDay, allowCarryForward, carryForwardLimit } = req.body;

    if (!code || !name) {
      throw new BadRequestError('Leave type code and name are required');
    }

    const existing = await prisma.leaveType.findUnique({
      where: { companyId_code: { companyId, code: code.toUpperCase().trim() } },
    });

    if (existing) {
      throw new BadRequestError(`Leave type with code '${code}' already exists`);
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        companyId,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        description: description || null,
        isPaid: isPaid !== undefined ? Boolean(isPaid) : true,
        annualQuota: Number(annualQuota) || 0,
        maxConsecutiveDays: maxConsecutiveDays ? Number(maxConsecutiveDays) : null,
        allowHalfDay: allowHalfDay !== undefined ? Boolean(allowHalfDay) : true,
        allowCarryForward: allowCarryForward !== undefined ? Boolean(allowCarryForward) : false,
        carryForwardLimit: carryForwardLimit ? Number(carryForwardLimit) : null,
        isActive: true,
      },
    });

    sendSuccess(res, 'Leave type created successfully', leaveType, 201);
  } catch (err) {
    next(err);
  }
};

export const updateLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;
    const { name, description, isPaid, annualQuota, maxConsecutiveDays, allowHalfDay, allowCarryForward, carryForwardLimit, isActive } = req.body;

    const existing = await prisma.leaveType.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Leave type not found');
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(isPaid !== undefined && { isPaid: Boolean(isPaid) }),
        ...(annualQuota !== undefined && { annualQuota: Number(annualQuota) }),
        ...(maxConsecutiveDays !== undefined && { maxConsecutiveDays: maxConsecutiveDays ? Number(maxConsecutiveDays) : null }),
        ...(allowHalfDay !== undefined && { allowHalfDay: Boolean(allowHalfDay) }),
        ...(allowCarryForward !== undefined && { allowCarryForward: Boolean(allowCarryForward) }),
        ...(carryForwardLimit !== undefined && { carryForwardLimit: carryForwardLimit ? Number(carryForwardLimit) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    // If annualQuota changed, auto update allocated & remaining for all employee leave balances of this leave type
    if (annualQuota !== undefined && Number(annualQuota) !== existing.annualQuota) {
      const newQuota = Number(annualQuota);
      const balances = await prisma.leaveBalance.findMany({
        where: { companyId, leaveTypeId: id },
      });

      for (const bal of balances) {
        const newRemaining = newQuota + bal.carriedForward - bal.used - bal.pending;
        await prisma.leaveBalance.update({
          where: { id: bal.id },
          data: {
            allocated: newQuota,
            remaining: Math.max(0, newRemaining),
          },
        });
      }
    }

    sendSuccess(res, 'Leave type updated successfully and employee balances synced', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteLeaveType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;

    const existing = await prisma.leaveType.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Leave type not found');
    }

    // Toggle active state to false
    const updated = await prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });

    // Remove un-used balance entries for this deactivated type so it disappears from quotas
    await prisma.leaveBalance.deleteMany({
      where: { companyId, leaveTypeId: id, used: 0, pending: 0 },
    });

    sendSuccess(res, 'Leave type deactivated and un-used quotas removed', updated);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE POLICY
// ─────────────────────────────────────────────────────────────────────────────
export const getLeavePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;

    let policies = await prisma.leavePolicy.findMany({
      where: { companyId },
      orderBy: { year: 'desc' },
    });

    if (policies.length === 0) {
      const defaultPolicy = await prisma.leavePolicy.create({
        data: {
          companyId,
          name: `${new Date().getFullYear()} Default Corporate Leave Policy`,
          year: new Date().getFullYear(),
          workingDaysOnly: true,
          excludeWeekends: true,
          excludeHolidays: true,
          advanceNoticeDays: 0,
          allowNegativeBalance: false,
          autoApprove: false,
          customRules: JSON.stringify([
            { id: '1', name: 'Exclude Weekends from Leave Count', enabled: true },
            { id: '2', name: 'Exclude Public Holidays from Count', enabled: true },
            { id: '3', name: 'Allow Negative Balance (Over-draw)', enabled: false }
          ]),
          isActive: true,
        },
      });
      policies = [defaultPolicy];
    }

    const formattedPolicies = policies.map((p) => {
      let parsedRules = [];
      if (p.customRules) {
        try {
          parsedRules = typeof p.customRules === 'string' ? JSON.parse(p.customRules) : p.customRules;
        } catch (e) {
          parsedRules = [];
        }
      }
      return {
        ...p,
        customRules: parsedRules,
      };
    });

    sendSuccess(res, 'Leave policies retrieved successfully', formattedPolicies);
  } catch (err) {
    next(err);
  }
};

export const updateLeavePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;
    const { name, year, workingDaysOnly, excludeWeekends, excludeHolidays, advanceNoticeDays, maxConsecutiveDays, allowNegativeBalance, autoApprove, customRules } = req.body;

    const existing = await prisma.leavePolicy.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Leave policy not found');
    }

    const customRulesStr = customRules !== undefined
      ? (typeof customRules === 'string' ? customRules : JSON.stringify(customRules))
      : undefined;

    const updated = await prisma.leavePolicy.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(year && { year: Number(year) }),
        ...(workingDaysOnly !== undefined && { workingDaysOnly: Boolean(workingDaysOnly) }),
        ...(excludeWeekends !== undefined && { excludeWeekends: Boolean(excludeWeekends) }),
        ...(excludeHolidays !== undefined && { excludeHolidays: Boolean(excludeHolidays) }),
        ...(advanceNoticeDays !== undefined && { advanceNoticeDays: Number(advanceNoticeDays) }),
        ...(maxConsecutiveDays !== undefined && { maxConsecutiveDays: maxConsecutiveDays ? Number(maxConsecutiveDays) : null }),
        ...(allowNegativeBalance !== undefined && { allowNegativeBalance: Boolean(allowNegativeBalance) }),
        ...(autoApprove !== undefined && { autoApprove: Boolean(autoApprove) }),
        ...(customRulesStr !== undefined && { customRules: customRulesStr }),
      },
    });

    let parsedRules = [];
    if (updated.customRules) {
      try {
        parsedRules = JSON.parse(updated.customRules);
      } catch (e) {
        parsedRules = [];
      }
    }

    sendSuccess(res, 'Leave policy updated successfully', { ...updated, customRules: parsedRules });
  } catch (err) {
    next(err);
  }
};

export const createLeavePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, year, excludeWeekends, excludeHolidays, advanceNoticeDays, allowNegativeBalance, customRules } = req.body;

    const targetYear = Number(year) || new Date().getFullYear();
    const customRulesStr = customRules !== undefined
      ? (typeof customRules === 'string' ? customRules : JSON.stringify(customRules))
      : JSON.stringify([]);

    const created = await prisma.leavePolicy.create({
      data: {
        companyId,
        name: name ? name.trim() : `${targetYear} Corporate Leave Policy`,
        year: targetYear,
        workingDaysOnly: true,
        excludeWeekends: excludeWeekends !== undefined ? Boolean(excludeWeekends) : true,
        excludeHolidays: excludeHolidays !== undefined ? Boolean(excludeHolidays) : true,
        advanceNoticeDays: advanceNoticeDays !== undefined ? Number(advanceNoticeDays) : 0,
        allowNegativeBalance: allowNegativeBalance !== undefined ? Boolean(allowNegativeBalance) : false,
        autoApprove: false,
        customRules: customRulesStr,
        isActive: true,
      },
    });

    let parsedRules = [];
    if (created.customRules) {
      try {
        parsedRules = JSON.parse(created.customRules);
      } catch (e) {
        parsedRules = [];
      }
    }

    sendSuccess(res, 'Leave policy created successfully', { ...created, customRules: parsedRules }, 201);
  } catch (err) {
    next(err);
  }
};

export const deleteLeavePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;

    const existing = await prisma.leavePolicy.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Leave policy not found');
    }

    await prisma.leavePolicy.delete({ where: { id } });
    sendSuccess(res, 'Leave policy deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HOLIDAYS
// ─────────────────────────────────────────────────────────────────────────────
export const getHolidays = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const year = Number(req.query.year) || new Date().getFullYear();

    const holidays = await prisma.holiday.findMany({
      where: {
        companyId,
        date: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31),
        },
      },
      orderBy: { date: 'asc' },
    });

    sendSuccess(res, 'Holidays retrieved successfully', holidays);
  } catch (err) {
    next(err);
  }
};

export const createHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { name, date, description, isOptional } = req.body;

    if (!name || !date) {
      throw new BadRequestError('Holiday name and date are required');
    }

    const holiday = await prisma.holiday.create({
      data: {
        companyId,
        name: name.trim(),
        date: new Date(date),
        description: description || null,
        isOptional: isOptional !== undefined ? Boolean(isOptional) : false,
      },
    });

    sendSuccess(res, 'Holiday created successfully', holiday, 201);
  } catch (err) {
    next(err);
  }
};

export const updateHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;
    const { name, date, description, isOptional } = req.body;

    const existing = await prisma.holiday.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Holiday not found');
    }

    const updated = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(date && { date: new Date(date) }),
        ...(description !== undefined && { description: description || null }),
        ...(isOptional !== undefined && { isOptional: Boolean(isOptional) }),
      },
    });

    sendSuccess(res, 'Holiday updated successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const deleteHoliday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { id } = req.params;

    const existing = await prisma.holiday.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Holiday not found');
    }

    await prisma.holiday.delete({ where: { id } });
    sendSuccess(res, 'Holiday deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE BALANCES
// ─────────────────────────────────────────────────────────────────────────────
export const getLeaveBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const year = Number(req.query.year) || new Date().getFullYear();
    const isAll = req.query.all === 'true';
    let employeeId = req.query.employeeId as string;

    if (!employeeId && !isAll) {
      employeeId = req.user?.employeeId || '';
    }

    if (isAll) {
      const balances = await prisma.leaveBalance.findMany({
        where: { companyId, year },
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } } },
          leaveType: { select: { id: true, code: true, name: true, isPaid: true } },
        },
        orderBy: { employee: { name: 'asc' } },
      });
      sendSuccess(res, 'All employee leave balances retrieved', balances);
      return;
    }

    if (!employeeId) {
      // Find or auto-create Employee profile for Super Admin/User
      const userRecord = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      let emp = userRecord?.email
        ? await prisma.employee.findFirst({
            where: { companyId, email: userRecord.email },
          })
        : null;

      if (!emp && userRecord) {
        const empCount = await prisma.employee.count({ where: { companyId } });
        emp = await prisma.employee.create({
          data: {
            companyId,
            employeeCode: `EMP${String(empCount + 1).padStart(4, '0')}`,
            name: userRecord.name || 'Super Admin',
            email: userRecord.email,
            mobile: userRecord.phone || '9999999999',
            joiningDate: new Date(),
            address: 'Head Office',
            status: 'ACTIVE',
          },
        });

        await prisma.user.update({
          where: { id: req.user!.id },
          data: { employeeId: emp.id },
        });
      }
      employeeId = emp ? emp.id : '';
    }

    // Ensure leave balances exist for employee for all active leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { companyId, isActive: true },
    });

    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: lt.id,
            year,
          },
        },
        update: {},
        create: {
          companyId,
          employeeId,
          leaveTypeId: lt.id,
          year,
          allocated: lt.annualQuota,
          used: 0,
          pending: 0,
          remaining: lt.annualQuota,
          carriedForward: 0,
        },
      });
    }

    const balances = await prisma.leaveBalance.findMany({
      where: {
        companyId,
        employeeId,
        year,
        leaveType: { isActive: true },
      },
      include: {
        leaveType: { select: { id: true, code: true, name: true, isPaid: true, allowHalfDay: true, annualQuota: true } },
      },
    });

    sendSuccess(res, 'Employee leave balances retrieved', balances);
  } catch (err) {
    next(err);
  }
};

export const adjustLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { employeeId, leaveTypeId, year, allocated, used, remaining, carriedForward } = req.body;

    if (!employeeId || !leaveTypeId) {
      throw new BadRequestError('Employee ID and Leave Type ID are required');
    }

    const targetYear = Number(year) || new Date().getFullYear();
    const newAllocated = allocated !== undefined ? Number(allocated) : 0;
    const newUsed = used !== undefined ? Number(used) : 0;
    const newCarry = carriedForward !== undefined ? Number(carriedForward) : 0;

    const existing = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year: targetYear,
        },
      },
    });

    const pending = existing ? existing.pending : 0;
    const calcRemaining = remaining !== undefined ? Number(remaining) : Math.max(0, newAllocated + newCarry - newUsed - pending);

    const updated = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year: targetYear,
        },
      },
      update: {
        allocated: newAllocated,
        used: newUsed,
        carriedForward: newCarry,
        remaining: calcRemaining,
      },
      create: {
        companyId,
        employeeId,
        leaveTypeId,
        year: targetYear,
        allocated: newAllocated,
        used: newUsed,
        pending: 0,
        remaining: calcRemaining,
        carriedForward: newCarry,
      },
    });

    sendSuccess(res, 'Leave balance adjusted successfully', updated);
  } catch (err) {
    next(err);
  }
};

export const syncLeaveBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const year = Number(req.body.year) || new Date().getFullYear();

    const activeTypes = await prisma.leaveType.findMany({
      where: { companyId, isActive: true },
    });

    const employees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    let updatedCount = 0;

    for (const emp of employees) {
      for (const lt of activeTypes) {
        const existing = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year,
            },
          },
        });

        if (existing) {
          const newRemaining = lt.annualQuota + existing.carriedForward - existing.used - existing.pending;
          await prisma.leaveBalance.update({
            where: { id: existing.id },
            data: {
              allocated: lt.annualQuota,
              remaining: Math.max(0, newRemaining),
            },
          });
        } else {
          await prisma.leaveBalance.create({
            data: {
              companyId,
              employeeId: emp.id,
              leaveTypeId: lt.id,
              year,
              allocated: lt.annualQuota,
              used: 0,
              pending: 0,
              remaining: lt.annualQuota,
              carriedForward: 0,
            },
          });
        }
        updatedCount++;
      }
    }

    sendSuccess(res, `Synced ${updatedCount} leave balances for ${employees.length} active employees`, { updatedCount });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE CALCULATOR HELPER
// ─────────────────────────────────────────────────────────────────────────────
export const calculateLeaveDuration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const { fromDate, toDate, dayType } = req.query;

    if (!fromDate || !toDate) {
      throw new BadRequestError('fromDate and toDate parameters are required');
    }

    const calculation = await calculateWorkingDays(
      companyId,
      fromDate as string,
      toDate as string,
      (dayType as string) || 'FULL_DAY'
    );

    sendSuccess(res, 'Leave days calculated successfully', calculation);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE APPLICATION & REQUEST MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
export const applyLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const { leaveTypeId, fromDate, toDate, dayType, reason } = req.body;
    let employeeId = req.body.employeeId;

    if (!employeeId) {
      employeeId = req.user?.employeeId;
    }

    if (!employeeId) {
      throw new BadRequestError('Current user is not linked to an employee record. Please select an employee.');
    }

    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      throw new BadRequestError('Leave Type, From Date, To Date, and Reason are required.');
    }

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: leaveTypeId, companyId, isActive: true },
    });

    if (!leaveType) {
      throw new NotFoundError('Selected leave type is not available or inactive');
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      throw new BadRequestError('From date cannot be after To date');
    }

    const currentYear = from.getFullYear();

    // Check policy restrictions
    const policy = await prisma.leavePolicy.findFirst({
      where: { companyId, year: currentYear },
    });

    // 1. Calculate working days
    const calculation = await calculateWorkingDays(companyId, fromDate, toDate, dayType || 'FULL_DAY');
    const totalDays = calculation.totalDays;

    if (totalDays <= 0) {
      throw new BadRequestError('Selected date range contains 0 working days (all weekends/holidays).');
    }

    // 2. Check maximum consecutive days limit
    const maxConsecutive = leaveType.maxConsecutiveDays || policy?.maxConsecutiveDays;
    if (maxConsecutive && totalDays > maxConsecutive) {
      throw new BadRequestError(`Leave exceeds maximum allowed consecutive limit of ${maxConsecutive} days for ${leaveType.name}.`);
    }

    // 3. Check overlapping leave requests for this employee (PENDING or APPROVED)
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            fromDate: { lte: to },
            toDate: { gte: from },
          },
        ],
      },
    });

    if (overlap) {
      throw new BadRequestError(`Employee already has a ${overlap.status} leave request for the selected date range.`);
    }

    // 4. Check & Lock Leave Balance in Transaction
    const attachmentPath = req.file ? `uploads/${req.file.filename}` : null;

    const result = await prisma.$transaction(async (tx) => {
      // Find or create balance
      let balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year: currentYear,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            companyId,
            employeeId,
            leaveTypeId,
            year: currentYear,
            allocated: leaveType.annualQuota,
            used: 0,
            pending: 0,
            remaining: leaveType.annualQuota,
            carriedForward: 0,
          },
        });
      }

      // Check balance availability unless negative balance allowed
      const allowNegative = policy ? policy.allowNegativeBalance : false;
      if (!allowNegative && leaveType.isPaid && balance.remaining < totalDays) {
        throw new BadRequestError(
          `Insufficient leave balance for ${leaveType.name}. Requested: ${totalDays} day(s), Available: ${balance.remaining} day(s).`
        );
      }

      // Auto generate Leave Number (e.g., LV-837492)
      const leaveNo = `LV-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create Leave Request
      const request = await tx.leaveRequest.create({
        data: {
          companyId,
          leaveNo,
          employeeId,
          leaveTypeId,
          fromDate: from,
          toDate: to,
          totalDays,
          dayType: dayType || 'FULL_DAY',
          reason: reason.trim(),
          attachment: attachmentPath,
          status: policy?.autoApprove ? 'APPROVED' : 'PENDING',
          appliedAt: new Date(),
          ...(policy?.autoApprove && { approvedAt: new Date(), approvedBy: userId }),
        },
        include: {
          employee: { select: { name: true, employeeCode: true } },
          leaveType: { select: { code: true, name: true, isPaid: true } },
        },
      });

      // Update Leave Balance pending / used counts
      if (policy?.autoApprove) {
        const newUsed = balance.used + totalDays;
        const newRemaining = balance.allocated + balance.carriedForward - newUsed - balance.pending;
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: newUsed, remaining: newRemaining },
        });
      } else {
        const newPending = balance.pending + totalDays;
        const newRemaining = balance.allocated + balance.carriedForward - balance.used - newPending;
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: newPending, remaining: newRemaining },
        });
      }

      return request;
    });

    sendSuccess(res, 'Leave request submitted successfully', result, 201);
  } catch (err) {
    next(err);
  }
};

export const getLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userRole = req.user!.role;
    const userPermissions = req.user!.permissions || [];
    const userEmployeeId = req.user?.employeeId;

    const { status, employeeId, leaveTypeId, fromDate, toDate } = req.query;

    const canViewAll =
      userRole === 'SUPER_ADMIN' ||
      userRole === 'ADMIN' ||
      userPermissions.includes('*') ||
      userPermissions.includes('LEAVE_MANAGE') ||
      userPermissions.includes('LEAVE_APPROVE');

    let whereClause: any = { companyId };

    if (!canViewAll) {
      if (!userEmployeeId) {
        sendSuccess(res, 'No employee record linked', []);
        return;
      }
      whereClause.employeeId = userEmployeeId;
    } else if (employeeId) {
      whereClause.employeeId = employeeId as string;
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (leaveTypeId) {
      whereClause.leaveTypeId = leaveTypeId as string;
    }

    if (fromDate && toDate) {
      whereClause.fromDate = { lte: new Date(toDate as string) };
      whereClause.toDate = { gte: new Date(fromDate as string) };
    }

    const requests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, department: { select: { name: true } } } },
        leaveType: { select: { id: true, code: true, name: true, isPaid: true } },
        approver: { select: { id: true, name: true, email: true } },
        rejector: { select: { id: true, name: true, email: true } },
        canceller: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, 'Leave requests retrieved successfully', requests);
  } catch (err) {
    next(err);
  }
};

export const approveLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const userPermissions = req.user!.permissions || [];
    const isSuperAdmin = userRole === 'SUPER_ADMIN' || userPermissions.includes('*');

    const { id } = req.params;
    const { comments } = req.body;

    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id, companyId },
      include: { leaveType: true },
    });

    if (!leaveReq) {
      throw new NotFoundError('Leave request not found');
    }

    if (leaveReq.status !== 'PENDING' && leaveReq.status !== 'SUPER_APPROVED') {
      throw new BadRequestError(`Cannot approve leave request with status '${leaveReq.status}'.`);
    }

    const year = leaveReq.fromDate.getFullYear();

    // Multistage Approval Logic:
    // If totalDays > 1:
    //   Stage 1: Must be approved by Super Admin -> Status becomes SUPER_APPROVED
    //   Stage 2: Must be approved by Admin -> Status becomes APPROVED
    // If totalDays <= 1:
    //   Directly approved by Admin or Super Admin -> Status becomes APPROVED

    if (leaveReq.totalDays > 1 && leaveReq.status === 'PENDING') {
      if (!isSuperAdmin) {
        throw new ForbiddenError('Leave requests greater than 1 day require Super Admin approval first.');
      }

      // Stage 1 Approval by Super Admin
      const result = await prisma.$transaction(async (tx) => {
        const updatedReq = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'SUPER_APPROVED',
          },
        });

        await tx.leaveApproval.create({
          data: {
            leaveRequestId: id,
            approverId: userId,
            action: 'SUPER_APPROVED',
            comments: comments || 'Stage 1 approved by Super Admin. Pending final Admin approval.',
          },
        });

        return updatedReq;
      });

      sendSuccess(res, 'Stage 1 approved by Super Admin. Awaiting final Admin approval.', result);
      return;
    }

    // Final Approval (either totalDays <= 1 OR status === 'SUPER_APPROVED')
    const result = await prisma.$transaction(async (tx) => {
      // Update Leave Request status to APPROVED
      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // Record Audit Action
      await tx.leaveApproval.create({
        data: {
          leaveRequestId: id,
          approverId: userId,
          action: 'APPROVED',
          comments: comments || 'Leave request fully approved',
        },
      });

      // Update Leave Balance: pending decreases, used increases
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
      });

      if (balance) {
        const newPending = Math.max(0, balance.pending - leaveReq.totalDays);
        const newUsed = balance.used + leaveReq.totalDays;
        const newRemaining = balance.allocated + balance.carriedForward - newUsed - newPending;

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: newPending, used: newUsed, remaining: newRemaining },
        });
      }

      return updatedReq;
    });

    sendSuccess(res, 'Leave request fully approved', result);
  } catch (err) {
    next(err);
  }
};

export const rejectLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw new BadRequestError('Rejection reason is required');
    }

    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id, companyId },
    });

    if (!leaveReq) {
      throw new NotFoundError('Leave request not found');
    }

    if (leaveReq.status !== 'PENDING' && leaveReq.status !== 'SUPER_APPROVED') {
      throw new BadRequestError(`Cannot reject leave request with status '${leaveReq.status}'.`);
    }

    const year = leaveReq.fromDate.getFullYear();

    const result = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedBy: userId,
          rejectedAt: new Date(),
          rejectionReason: rejectionReason.trim(),
        },
      });

      await tx.leaveApproval.create({
        data: {
          leaveRequestId: id,
          approverId: userId,
          action: 'REJECTED',
          comments: rejectionReason,
        },
      });

      // Restore Balance: pending decreases
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
      });

      if (balance) {
        const newPending = Math.max(0, balance.pending - leaveReq.totalDays);
        const newRemaining = balance.allocated + balance.carriedForward - balance.used - newPending;

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { pending: newPending, remaining: newRemaining },
        });
      }

      return updatedReq;
    });

    sendSuccess(res, 'Leave request rejected successfully', result);
  } catch (err) {
    next(err);
  }
};

export const cancelLeave = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const userId = req.user!.id;
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const leaveReq = await prisma.leaveRequest.findFirst({
      where: { id, companyId },
    });

    if (!leaveReq) {
      throw new NotFoundError('Leave request not found');
    }

    if (leaveReq.status === 'CANCELLED' || leaveReq.status === 'REJECTED') {
      throw new BadRequestError(`Leave request is already ${leaveReq.status}`);
    }

    const year = leaveReq.fromDate.getFullYear();

    const result = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancellationReason: cancellationReason || 'User cancelled request',
        },
      });

      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveReq.employeeId,
            leaveTypeId: leaveReq.leaveTypeId,
            year,
          },
        },
      });

      if (balance) {
        if (leaveReq.status === 'PENDING') {
          const newPending = Math.max(0, balance.pending - leaveReq.totalDays);
          const newRemaining = balance.allocated + balance.carriedForward - balance.used - newPending;
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { pending: newPending, remaining: newRemaining },
          });
        } else if (leaveReq.status === 'APPROVED') {
          const newUsed = Math.max(0, balance.used - leaveReq.totalDays);
          const newRemaining = balance.allocated + balance.carriedForward - newUsed - balance.pending;
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { used: newUsed, remaining: newRemaining },
          });
        }
      }

      return updatedReq;
    });

    sendSuccess(res, 'Leave request cancelled successfully', result);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REPORTS & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
export const getLeaveReports = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.companyId!;
    const year = Number(req.query.year) || new Date().getFullYear();

    const employees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { department: { select: { name: true } } },
    });

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        fromDate: { gte: new Date(year, 0, 1) },
        toDate: { lte: new Date(year, 11, 31, 23, 59, 59) },
      },
      include: {
        leaveType: { select: { code: true, name: true, isPaid: true } },
      },
    });

    const totalRequests = leaveRequests.length;
    const pendingCount = leaveRequests.filter((r) => r.status === 'PENDING').length;
    const approvedCount = leaveRequests.filter((r) => r.status === 'APPROVED').length;
    const rejectedCount = leaveRequests.filter((r) => r.status === 'REJECTED').length;
    const cancelledCount = leaveRequests.filter((r) => r.status === 'CANCELLED').length;

    // Calculate total LWP (Leave Without Pay) days taken
    const totalLwpDays = leaveRequests
      .filter((r) => r.status === 'APPROVED' && (!r.leaveType.isPaid || r.leaveType.code === 'LWP'))
      .reduce((sum, r) => sum + r.totalDays, 0);

    const totalPaidLeaveDays = leaveRequests
      .filter((r) => r.status === 'APPROVED' && r.leaveType.isPaid && r.leaveType.code !== 'LWP')
      .reduce((sum, r) => sum + r.totalDays, 0);

    sendSuccess(res, 'Leave reports retrieved successfully', {
      year,
      totalEmployees: employees.length,
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      cancelledCount,
      totalPaidLeaveDays,
      totalLwpDays,
      requests: leaveRequests,
    });
  } catch (err) {
    next(err);
  }
};
