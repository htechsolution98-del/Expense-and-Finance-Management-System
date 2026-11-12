import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

// ─────────────────────────────────────────────────────────────
// GET /reports/dashboard-summary
// ─────────────────────────────────────────────────────────────
export const getDashboardSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    // 1. Total Money In (PAYMENT_IN)
    const moneyInAgg = await prisma.transaction.aggregate({
      where: { companyId, type: 'PAYMENT_IN' },
      _sum: { amount: true },
    });
    const totalMoneyIn = moneyInAgg._sum.amount || 0;

    // 2. Total Money Out (PAYMENT_OUT)
    const moneyOutAgg = await prisma.transaction.aggregate({
      where: { companyId, type: 'PAYMENT_OUT' },
      _sum: { amount: true },
    });
    const totalMoneyOut = moneyOutAgg._sum.amount || 0;

    // 3. Company Liquidity (Current Balance across active accounts)
    const accounts = await prisma.account.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, type: true, currentBalance: true },
    });
    const netLiquidity = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

    // 4. Pending Approvals Count
    const [pendingExpenses, pendingAdvances, pendingBanks] = await Promise.all([
      prisma.expense.count({ where: { companyId, status: 'UNDER_REVIEW' } }),
      prisma.advance.count({ where: { companyId, status: 'UNDER_REVIEW' } }),
      prisma.employeeBankAccount.count({ where: { companyId, status: 'PENDING_VERIFICATION' } }),
    ]);

    const pendingApprovalsCount = pendingExpenses + pendingAdvances + pendingBanks;

    res.json({
      status: 'success',
      data: {
        totalMoneyIn,
        totalMoneyOut,
        netLiquidity,
        pendingApprovalsCount,
        pendingBreakdown: {
          expenses: pendingExpenses,
          advances: pendingAdvances,
          bankAccounts: pendingBanks,
        },
        accounts,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/cash-flow
// ─────────────────────────────────────────────────────────────
export const getCashFlowReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query;

    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate) dateFilter.lte = new Date(endDate as string);

    const where: Record<string, unknown> = { companyId };
    if (startDate || endDate) {
      where.date = dateFilter;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        transactionNo: true,
        type: true,
        category: true,
        amount: true,
        date: true,
        paymentMode: true,
        purpose: true,
        account: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Payment Mode Breakdown
    const byMode: Record<string, { moneyIn: number; moneyOut: number }> = {};
    let totalIn = 0;
    let totalOut = 0;

    for (const t of transactions) {
      const mode = t.paymentMode || 'OTHER';
      if (!byMode[mode]) byMode[mode] = { moneyIn: 0, moneyOut: 0 };

      if (t.type === 'PAYMENT_IN') {
        byMode[mode].moneyIn += t.amount;
        totalIn += t.amount;
      } else if (t.type === 'PAYMENT_OUT') {
        byMode[mode].moneyOut += t.amount;
        totalOut += t.amount;
      }
    }

    res.json({
      status: 'success',
      data: {
        totalIn,
        totalOut,
        netFlow: totalIn - totalOut,
        byMode,
        transactionCount: transactions.length,
        transactions: transactions.slice(0, 100), // top 100 recent
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/expenses-by-category
// ─────────────────────────────────────────────────────────────
export const getExpensesByCategoryReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const expenses = await prisma.expense.findMany({
      where: { companyId, status: { in: ['APPROVED', 'REIMBURSED'] } },
      include: { category: { select: { id: true, name: true } } },
    });

    const categoryMap: Record<
      string,
      { id: string; name: string; totalAmount: number; count: number }
    > = {};
    let grandTotal = 0;

    for (const exp of expenses) {
      const catId = exp.category.id;
      const catName = exp.category.name;
      if (!categoryMap[catId]) {
        categoryMap[catId] = { id: catId, name: catName, totalAmount: 0, count: 0 };
      }
      categoryMap[catId].totalAmount += exp.amount;
      categoryMap[catId].count += 1;
      grandTotal += exp.amount;
    }

    const categories = Object.values(categoryMap)
      .map((cat) => ({
        ...cat,
        percentage:
          grandTotal > 0 ? parseFloat(((cat.totalAmount / grandTotal) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      status: 'success',
      data: {
        grandTotal,
        totalExpensesCount: expenses.length,
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/expenses-by-employee
// ─────────────────────────────────────────────────────────────
export const getExpensesByEmployeeReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const expenses = await prisma.expense.findMany({
      where: { companyId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const empMap: Record<
      string,
      {
        id: string;
        name: string;
        code: string;
        department: string;
        approvedAmount: number;
        pendingAmount: number;
        count: number;
      }
    > = {};

    for (const exp of expenses) {
      const empId = exp.employeeId;
      if (!empMap[empId]) {
        empMap[empId] = {
          id: empId,
          name: exp.employee.name,
          code: exp.employee.employeeCode,
          department: exp.employee.department?.name || 'General',
          approvedAmount: 0,
          pendingAmount: 0,
          count: 0,
        };
      }
      empMap[empId].count += 1;
      if (['APPROVED', 'REIMBURSED'].includes(exp.status)) {
        empMap[empId].approvedAmount += exp.amount;
      } else if (['SUBMITTED', 'UNDER_REVIEW'].includes(exp.status)) {
        empMap[empId].pendingAmount += exp.amount;
      }
    }

    const employees = Object.values(empMap).sort((a, b) => b.approvedAmount - a.approvedAmount);

    res.json({
      status: 'success',
      data: { employees },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/salary-register
// ─────────────────────────────────────────────────────────────
export const getSalaryRegisterReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const payrolls = await prisma.payroll.findMany({
      where: { companyId },
      include: {
        payrollItems: {
          select: {
            id: true,
            basic: true,
            hra: true,
            conveyance: true,
            medical: true,
            special: true,
            pf: true,
            professionalTax: true,
            tds: true,
            grossEarnings: true,
            totalDeductions: true,
            netSalary: true,
            status: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const monthlySummaries = payrolls.map((p) => {
      const totalGross = p.payrollItems.reduce((s, i) => s + i.grossEarnings, 0);
      const totalDeductions = p.payrollItems.reduce((s, i) => s + i.totalDeductions, 0);
      const totalNet = p.payrollItems.reduce((s, i) => s + i.netSalary, 0);
      const totalPF = p.payrollItems.reduce((s, i) => s + i.pf, 0);
      const totalTDS = p.payrollItems.reduce((s, i) => s + i.tds, 0);
      const totalPT = p.payrollItems.reduce((s, i) => s + i.professionalTax, 0);
      const paidItemsCount = p.payrollItems.filter((i) => i.status === 'PAID').length;

      return {
        id: p.id,
        payrollNo: p.payrollNo,
        month: p.month,
        year: p.year,
        status: p.status,
        employeeCount: p.payrollItems.length,
        paidItemsCount,
        totalGross,
        totalDeductions,
        totalNet,
        statutory: {
          pf: totalPF,
          tds: totalTDS,
          professionalTax: totalPT,
        },
      };
    });

    res.json({
      status: 'success',
      data: { monthlySummaries },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/advances-and-loans
// ─────────────────────────────────────────────────────────────
export const getAdvancesAndLoansReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;

    const [advances, loans] = await Promise.all([
      prisma.advance.findMany({
        where: { companyId },
        include: { employee: { select: { name: true, employeeCode: true } } },
      }),
      prisma.loan.findMany({
        where: { companyId },
        include: { transactions: true },
      }),
    ]);

    const totalAdvancesIssued = advances.reduce(
      (s, a) => s + (a.status !== 'DRAFT' && a.status !== 'REJECTED' ? a.amount : 0),
      0
    );
    const totalAdvancesOutstanding = advances.reduce((s, a) => s + a.outstandingAmount, 0);

    const loanMetrics = loans.map((l) => {
      const utilizations = l.transactions.filter((t) => t.category === 'LOAN_UTILIZATION');
      const repayments = l.transactions.filter((t) => t.category === 'LOAN_REPAYMENT');
      const totalUtilized = utilizations.reduce((s, u) => s + u.amount, 0);
      const totalPrincipalRepaid = repayments.reduce((s, r) => s + r.amount, 0);
      const unallocated = l.principal - totalUtilized;
      const principalOutstanding = l.principal - totalPrincipalRepaid;

      return {
        id: l.id,
        loanNo: l.loanNo,
        lender: l.lender,
        principal: l.principal,
        totalUtilized,
        unallocated,
        principalOutstanding,
        status: l.status,
      };
    });

    res.json({
      status: 'success',
      data: {
        advances: {
          totalIssued: totalAdvancesIssued,
          totalOutstanding: totalAdvancesOutstanding,
          activeCount: advances.filter((a) => a.outstandingAmount > 0).length,
          list: advances,
        },
        loans: {
          loanMetrics,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/export — CSV Data Exporter
// ─────────────────────────────────────────────────────────────
export const exportReportCSV = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { type = 'ledger' } = req.query;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}_report_${new Date().toISOString().slice(0, 10)}.csv"`
    );

    if (type === 'expenses') {
      const expenses = await prisma.expense.findMany({
        where: { companyId },
        include: {
          employee: { select: { name: true, employeeCode: true } },
          category: { select: { name: true } },
        },
      });

      let csv = 'Expense No,Employee Code,Employee Name,Category,Amount,Purpose,Status,Date\n';
      for (const e of expenses) {
        csv += `"${e.expenseNo}","${e.employee.employeeCode}","${e.employee.name}","${e.category.name}",${e.amount},"${e.purpose.replace(/"/g, '""')}","${e.status}","${e.date.toISOString().slice(0, 10)}"\n`;
      }
      res.send(csv);
      return;
    }

    if (type === 'salaries') {
      const payrollItems = await prisma.payrollItem.findMany({
        where: { payroll: { companyId } },
        include: {
          payroll: { select: { month: true, year: true, payrollNo: true } },
          employee: { select: { name: true, employeeCode: true } },
        },
      });

      let csv =
        'Payroll No,Month/Year,Employee Code,Employee Name,Gross Earnings,Total Deductions,Net Salary,Status\n';
      for (const item of payrollItems) {
        csv += `"${item.payroll.payrollNo}","${item.payroll.month}/${item.payroll.year}","${item.employee.employeeCode}","${item.employee.name}",${item.grossEarnings},${item.totalDeductions},${item.netSalary},"${item.status}"\n`;
      }
      res.send(csv);
      return;
    }

    // Default: Ledger Export
    const transactions = await prisma.transaction.findMany({
      where: { companyId },
      include: { account: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    let csv = 'Transaction No,Type,Category,Date,Account,Amount,Purpose,Payment Mode\n';
    for (const t of transactions) {
      csv += `"${t.transactionNo}","${t.type}","${t.category}","${t.date.toISOString().slice(0, 10)}","${t.account.name}",${t.amount},"${t.purpose.replace(/"/g, '""')}","${t.paymentMode}"\n`;
    }
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /reports/audit-logs — Read-only Audit History Viewer
// ─────────────────────────────────────────────────────────────
export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { module: mod, action, search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { companyId };
    if (mod) where.module = mod;
    if (action) where.action = action;
    if (search) {
      where.OR = [
        { recordId: { contains: search as string } },
        { action: { contains: search as string } },
        { module: { contains: search as string } },
        { user: { email: { contains: search as string } } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Unique user count and today's logs count for KPI header
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.auditLog.count({
      where: { companyId, createdAt: { gte: todayStart } },
    });

    res.json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
        todayCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

