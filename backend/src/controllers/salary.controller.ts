import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { z } from 'zod';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

// Validators
const upsertStructureSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  basic: z.number().nonnegative('Basic must be non-negative'),
  hra: z.number().nonnegative('HRA must be non-negative'),
  conveyance: z.number().nonnegative('Conveyance must be non-negative'),
  medical: z.number().nonnegative('Medical must be non-negative'),
  special: z.number().nonnegative('Special must be non-negative'),
  pf: z.number().nonnegative('PF must be non-negative'),
  professionalTax: z.number().nonnegative('Professional Tax must be non-negative'),
  tds: z.number().nonnegative('TDS must be non-negative'),
  effectiveDate: z.string().transform((val) => new Date(val)),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const generatePayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2050),
});

const settlePayrollSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

export const getSalaryStructures = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const structures = await prisma.salaryStructure.findMany({
      where: { companyId },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ status: 'success', data: structures });
  } catch (error) {
    next(error);
  }
};

export const upsertSalaryStructure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check permission
    if (
      !req.user!.permissions.includes('SALARY_CREATE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to manage salary structures.');
    }

    const validated = upsertStructureSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Verify employee
    const employee = await prisma.employee.findFirst({
      where: { id: validated.employeeId, companyId },
    });
    if (!employee) throw new NotFoundError('Employee not found.');

    // Start database operation
    const structure = await prisma.$transaction(async (tx) => {
      // Deactivate older structures for this employee
      await tx.salaryStructure.updateMany({
        where: { employeeId: validated.employeeId, companyId, status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      });

      // Create new structure
      return tx.salaryStructure.create({
        data: {
          companyId,
          employeeId: validated.employeeId,
          basic: validated.basic,
          hra: validated.hra,
          conveyance: validated.conveyance,
          medical: validated.medical,
          special: validated.special,
          pf: validated.pf,
          professionalTax: validated.professionalTax,
          tds: validated.tds,
          effectiveDate: validated.effectiveDate,
          status: 'ACTIVE',
          createdBy: req.user!.id,
        },
        include: { employee: { select: { name: true } } },
      });
    });

    res.status(201).json({ status: 'success', data: structure });
  } catch (error) {
    next(error);
  }
};

export const updateSalaryStructure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const permissions = req.user!.permissions;
    if (
      !permissions.includes('SALARY_CREATE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to manage salary structures.');
    }

    const { id } = req.params;
    const validated = upsertStructureSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const existingStructure = await prisma.salaryStructure.findFirst({
      where: { id, companyId },
    });

    if (!existingStructure) {
      throw new NotFoundError('Salary structure not found.');
    }

    const structure = await prisma.salaryStructure.update({
      where: { id },
      data: {
        basic: validated.basic,
        hra: validated.hra,
        conveyance: validated.conveyance,
        medical: validated.medical,
        special: validated.special,
        pf: validated.pf,
        professionalTax: validated.professionalTax,
        tds: validated.tds,
        effectiveDate: validated.effectiveDate,
        status: validated.status,
      },
      include: { employee: { select: { name: true } } },
    });

    res.status(200).json({ status: 'success', data: structure });
  } catch (error) {
    next(error);
  }
};

export const deleteSalaryStructure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const structure = await prisma.salaryStructure.findFirst({
      where: { id, companyId },
    });

    if (!structure) {
      throw new NotFoundError('Salary structure not found.');
    }

    await prisma.salaryStructure.delete({
      where: { id },
    });

    res.status(200).json({ status: 'success', message: 'Salary structure deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export const toggleHoldPayrollItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      !req.user!.permissions.includes('SALARY_APPROVE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to modify salary slip status.');
    }

    const { itemId } = req.params;
    const companyId = req.user!.companyId;

    const item = await prisma.payrollItem.findFirst({
      where: { id: itemId, payroll: { companyId } },
    });
    
    if (!item) throw new NotFoundError('Payroll item slip not found.');
    if (item.status === 'PAID') {
      throw new BadRequestError('Cannot hold a PAID salary slip.');
    }

    const newStatus = item.status === 'PENDING' ? 'ON_HOLD' : 'PENDING';

    const updated = await prisma.payrollItem.update({
      where: { id: itemId },
      data: { status: newStatus },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const getPayrolls = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const payrolls = await prisma.payroll.findMany({
      where: { companyId },
      include: {
        _count: { select: { payrollItems: true } },
        payrollItems: { select: { netSalary: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format totals
    const formatted = payrolls.map((p) => {
      const totalNet = p.payrollItems.reduce((acc, item) => acc + item.netSalary, 0);
      return {
        id: p.id,
        payrollNo: p.payrollNo,
        month: p.month,
        year: p.year,
        status: p.status,
        slipsCount: p._count.payrollItems,
        totalNetSalary: totalNet,
        createdAt: p.createdAt,
      };
    });

    res.json({ status: 'success', data: formatted });
  } catch (error) {
    next(error);
  }
};

export const getPayrollById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
      include: {
        payrollItems: {
          include: {
            employee: { select: { name: true, employeeCode: true } },
            account: { select: { name: true } },
          },
        },
      },
    });

    if (!payroll) throw new NotFoundError('Payroll batch not found.');

    res.json({ status: 'success', data: payroll });
  } catch (error) {
    next(error);
  }
};

export const generatePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      !req.user!.permissions.includes('SALARY_CREATE') &&
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('You do not hold permissions to generate payroll batches.');
    }

    const { month, year } = generatePayrollSchema.parse(req.body);
    const companyId = req.user!.companyId;

    // Assert that a batch does not exist already
    const existing = await prisma.payroll.findFirst({
      where: { companyId, month, year },
    });
    if (existing) {
      throw new BadRequestError(`A payroll batch for ${month}/${year} already exists.`);
    }

    // Get all active employees who have an active structure
    const employees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        salaryStructures: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    const activeEmpWithStructures = employees.filter((e) => e.salaryStructures.length > 0);
    if (activeEmpWithStructures.length === 0) {
      throw new BadRequestError(
        'No active employees with configured active salary structures were found.'
      );
    }

    // Generate unique payroll batch number
    const payrollNo = `PAY-${year}${month.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const employeeIds = activeEmpWithStructures.map((e) => e.id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create payroll batch
      const payroll = await tx.payroll.create({
        data: {
          companyId,
          payrollNo,
          month,
          year,
          status: 'DRAFT',
          createdBy: req.user!.id,
        },
      });

      // Get all company holidays in that month
      const totalDaysInMonth = new Date(year, month, 0).getDate();
      const holidays = await tx.holiday.findMany({
        where: {
          companyId,
          date: {
            gte: new Date(year, month - 1, 1, 0, 0, 0),
            lte: new Date(year, month - 1, totalDaysInMonth, 23, 59, 59),
          },
        },
      });

      // Fetch leave requests for all these employees in that month
      const allLeaveRequests = await tx.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'APPROVED',
          OR: [
            {
              fromDate: { lte: new Date(year, month - 1, totalDaysInMonth, 23, 59, 59) },
              toDate: { gte: new Date(year, month - 1, 1, 0, 0, 0) },
            },
          ],
        },
        include: { leaveType: true },
      });

      // Fetch attendance records for all these employees in that month
      const allAttendanceRecords = await tx.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: {
            gte: new Date(year, month - 1, 1, 0, 0, 0),
            lte: new Date(year, month - 1, totalDaysInMonth, 23, 59, 59),
          },
        },
      });

      // 2. Create slips
      for (const emp of activeEmpWithStructures) {
        const struct = emp.salaryStructures[0];
        const grossEarnings =
          struct.basic + struct.hra + struct.conveyance + struct.medical + struct.special;
        const totalDeductions = struct.pf + struct.professionalTax + struct.tds;
        const netBefore = grossEarnings - totalDeductions;

        // Filter leave requests for this employee in-memory
        const leaveRequests = allLeaveRequests.filter((l) => l.employeeId === emp.id);

        // Filter attendance records for this employee in-memory
        const attendanceRecords = allAttendanceRecords.filter((a) => a.employeeId === emp.id);

        let lwpDays = 0;
        let absentDays = 0;
        let halfDays = 0;

        for (let d = 1; d <= totalDaysInMonth; d++) {
          const currentDate = new Date(year, month - 1, d);
          const dayOfWeek = currentDate.getDay(); // 0 is Sunday

          // 1. Weekend Check (Sunday)
          if (dayOfWeek === 0) {
            continue; // Sunday is a paid day off (no deduction)
          }

          // 2. Company Holiday Check
          const isHoliday = holidays.some((h) => {
            const hDate = new Date(h.date);
            return (
              hDate.getFullYear() === year &&
              hDate.getMonth() === month - 1 &&
              hDate.getDate() === d
            );
          });
          if (isHoliday) {
            continue;
          }

          // 3. Attendance Check
          const att = attendanceRecords.find((a) => {
            const aDate = new Date(a.date);
            return (
              aDate.getFullYear() === year &&
              aDate.getMonth() === month - 1 &&
              aDate.getDate() === d
            );
          });

          if (att) {
            if (att.isHalfDay) {
              halfDays += 1;
            }
            continue;
          }

          // 4. Approved Leave Check
          const leave = leaveRequests.find((l) => {
            const start = new Date(l.fromDate);
            const end = new Date(l.toDate);
            // normalize current date
            const currTime = new Date(year, month - 1, d, 12, 0, 0).getTime();
            return currTime >= start.getTime() && currTime <= end.getTime();
          });

          if (leave) {
            if (!leave.leaveType.isPaid) {
              lwpDays += 1;
            }
            continue;
          }

          // 5. If no check-in, no holiday, no weekend, and no leave -> Absent!
          absentDays += 1;
        }

        const dailyRate = netBefore / totalDaysInMonth;
        const unpaidDeductions =
          Math.round(
            (lwpDays * dailyRate + absentDays * dailyRate + halfDays * 0.5 * dailyRate) * 100
          ) / 100;
        const netSalary = Math.max(0, Math.round((netBefore - unpaidDeductions) * 100) / 100);

        await tx.payrollItem.create({
          data: {
            payrollId: payroll.id,
            employeeId: emp.id,
            basic: struct.basic,
            hra: struct.hra,
            conveyance: struct.conveyance,
            medical: struct.medical,
            special: struct.special,
            pf: struct.pf,
            professionalTax: struct.professionalTax,
            tds: struct.tds,
            grossEarnings,
            totalDeductions,
            netSalary,
            lwpDays,
            absentDays,
            halfDays,
            unpaidDeductions,
            status: 'PENDING',
          },
        });
      }

      return payroll;
    }, {
      maxWait: 10000,
      timeout: 60000,
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const approvePayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (
      req.user!.role !== 'ADMIN' &&
      req.user!.role !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError('Only Admin can approve payroll batches.');
    }

    const { id } = req.params;
    const companyId = req.user!.companyId;

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
    });
    if (!payroll) throw new NotFoundError('Payroll batch not found.');
    if (payroll.status !== 'DRAFT') {
      throw new BadRequestError('Only draft payroll batches can be approved.');
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};

export const payPayrollItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user!.permissions.includes('PAYMENT_CREATE') && req.user!.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You do not hold permissions to settle payroll payouts.');
    }

    const { itemId } = req.params;
    const { accountId } = settlePayrollSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const item = await prisma.payrollItem.findFirst({
      where: { id: itemId, payroll: { companyId } },
      include: { payroll: true, employee: { select: { name: true } } },
    });
    if (!item) throw new NotFoundError('Payroll item slip not found.');
    if (item.status === 'PAID') {
      throw new BadRequestError('This salary slip is already marked as PAID.');
    }
    if (item.status === 'ON_HOLD') {
      throw new BadRequestError('This salary slip is on hold and cannot be paid.');
    }
    if (item.payroll.status !== 'APPROVED' && item.payroll.status !== 'PAID') {
      throw new BadRequestError('Salary payouts are only permitted for APPROVED payroll batches.');
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Get account
        const account = await tx.account.findFirst({
          where: { id: accountId, companyId, status: 'ACTIVE', deletedAt: null },
        });
        if (!account) throw new NotFoundError('Payout bank/cash account not found.');
        if (account.currentBalance < item.netSalary) {
          throw new BadRequestError(
            `Insufficient balance in account: current balance is ${account.currentBalance}`
          );
        }

        // 1. Decrement account balance
        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: {
            currentBalance: { decrement: item.netSalary },
            version: { increment: 1 },
          },
        });

        // 2. Generate unique numbers
        const trxPrefix = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const trxCount = await tx.transaction.count({
          where: { companyId, transactionNo: { startsWith: trxPrefix } },
        });
        const transactionNo = `${trxPrefix}-${(trxCount + 1).toString().padStart(4, '0')}`;

        /*
        const vchPrefix = 'VCH-PAY';
        const vchCount = await tx.voucher.count({
          where: { companyId, voucherNo: { startsWith: vchPrefix } },
        });
        const voucherNo = `${vchPrefix}-${(vchCount + 1).toString().padStart(5, '0')}`;
        */

        // 3. Create Transaction Ledger entry
        const transaction = await tx.transaction.create({
          data: {
            companyId,
            transactionNo,
            type: 'PAYMENT_OUT',
            category: 'SALARY_PAYMENT',
            date: new Date(),
            amount: item.netSalary,
            runningBalance: updatedAccount.currentBalance,
            accountId,
            purpose: `Salary Payout for ${item.employee.name} - ${item.payroll.month}/${item.payroll.year}`,
            paymentMode: 'BANK_TRANSFER',
            employeeId: item.employeeId,
            payrollItemId: item.id,
            createdBy: req.user!.id,
          },
        });

        // 4. Create Voucher (Bypassed - User requested no vouchers for salary payouts)
        /*
        await tx.voucher.create({
          data: {
            companyId,
            voucherNo,
            transactionId: transaction.id,
          },
        });
        */

        // 5. Update slip status
        const updatedItem = await tx.payrollItem.update({
          where: { id: item.id },
          data: {
            status: 'PAID',
            paidAccountId: accountId,
            paidAt: new Date(),
            transactionId: transaction.id,
          },
        });

        // 6. Check if entire batch is complete
        const pendingItems = await tx.payrollItem.count({
          where: { payrollId: item.payrollId, status: 'PENDING' },
        });

        if (pendingItems === 0) {
          await tx.payroll.update({
            where: { id: item.payrollId },
            data: { status: 'PAID' },
          });
        }

        return {
          item: updatedItem,
          account: updatedAccount,
          transaction,
        };
      },
      { timeout: 15000 }
    );

    res.json({
      status: 'success',
      message: 'Salary payout successfully settled.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const payPayrollBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user!.permissions.includes('PAYMENT_CREATE') && req.user!.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('You do not hold permissions to settle payroll payouts.');
    }

    const { id } = req.params;
    const { accountId } = settlePayrollSchema.parse(req.body);
    const companyId = req.user!.companyId;

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
      include: {
        payrollItems: {
          where: { status: 'PENDING' },
          include: { employee: { select: { name: true } } },
        },
      },
    });

    if (!payroll) throw new NotFoundError('Payroll batch not found.');
    if (payroll.status !== 'APPROVED') {
      throw new BadRequestError('Only APPROVED payroll batches can be settled.');
    }
    if (payroll.payrollItems.length === 0) {
      throw new BadRequestError('All eligible employee slips in this batch are already PAID or ON HOLD.');
    }

    const totalRequired = payroll.payrollItems.reduce((acc, item) => acc + item.netSalary, 0);

    const result = await prisma.$transaction(
      async (tx) => {
        // Get account
        const account = await tx.account.findFirst({
          where: { id: accountId, companyId, status: 'ACTIVE', deletedAt: null },
        });
        if (!account) throw new NotFoundError('Payout bank/cash account not found.');
        if (account.currentBalance < totalRequired) {
          throw new BadRequestError(
            `Insufficient balance in account for batch: required is ${totalRequired}, current balance is ${account.currentBalance}`
          );
        }

        // 1. Decrement account balance
        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: {
            currentBalance: { decrement: totalRequired },
            version: { increment: 1 },
          },
        });

        // 2. Loop and pay each pending item
        const paidSlips = [];
        let currentRunningBalance = account.currentBalance;
        for (const item of payroll.payrollItems) {
          currentRunningBalance -= item.netSalary;
          // Generate unique numbers
          const trxPrefix = `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
          const trxCount = await tx.transaction.count({
            where: { companyId, transactionNo: { startsWith: trxPrefix } },
          });
          const transactionNo = `${trxPrefix}-${(trxCount + 1).toString().padStart(4, '0')}`;

          /*
          const vchPrefix = 'VCH-PAY';
          const vchCount = await tx.voucher.count({
            where: { companyId, voucherNo: { startsWith: vchPrefix } },
          });
          const voucherNo = `${vchPrefix}-${(vchCount + 1).toString().padStart(5, '0')}`;
          */

          // Create Transaction
          const transaction = await tx.transaction.create({
            data: {
              companyId,
              transactionNo,
              type: 'PAYMENT_OUT',
              category: 'SALARY_PAYMENT',
              date: new Date(),
              amount: item.netSalary,
              runningBalance: currentRunningBalance,
              accountId,
              purpose: `Salary Batch Payout for ${item.employee.name} - ${payroll.month}/${payroll.year}`,
              paymentMode: 'BANK_TRANSFER',
              employeeId: item.employeeId,
              payrollItemId: item.id,
              createdBy: req.user!.id,
            },
          });

          // Create Voucher (Bypassed - User requested no vouchers for salary payouts)
          /*
          await tx.voucher.create({
            data: {
              companyId,
              voucherNo,
              transactionId: transaction.id,
            },
          });
          */

          // Update item status
          const updatedItem = await tx.payrollItem.update({
            where: { id: item.id },
            data: {
              status: 'PAID',
              paidAccountId: accountId,
              paidAt: new Date(),
              transactionId: transaction.id,
            },
          });

          paidSlips.push(updatedItem);
        }

        // 3. Mark payroll batch PAID only if ALL items (including ON_HOLD) are now PAID
        const remainingItems = await tx.payrollItem.count({
          where: { payrollId: payroll.id, status: { notIn: ['PAID'] } },
        });
        const newBatchStatus = remainingItems === 0 ? 'PAID' : 'APPROVED';
        const updatedPayroll = await tx.payroll.update({
          where: { id: payroll.id },
          data: { status: newBatchStatus },
        });

        return {
          payroll: updatedPayroll,
          account: updatedAccount,
          slips: paidSlips,
        };
      },
      { timeout: 30000 }
    ); // longer timeout for batch loop

    res.json({
      status: 'success',
      message: 'Payroll batch successfully paid and settled.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
