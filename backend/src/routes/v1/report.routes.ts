import { Router } from 'express';
import {
  getDashboardSummary,
  getCashFlowReport,
  getExpensesByCategoryReport,
  getExpensesByEmployeeReport,
  getSalaryRegisterReport,
  getAdvancesAndLoansReport,
  exportReportCSV,
  getAuditLogs,
} from '../../controllers/report.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// All reports protected by REPORT_VIEW permission
router.use(authorize('REPORT_VIEW'));

router.get('/dashboard-summary', getDashboardSummary);
router.get('/cash-flow', getCashFlowReport);
router.get('/expenses-by-category', getExpensesByCategoryReport);
router.get('/expenses-by-employee', getExpensesByEmployeeReport);
router.get('/salary-register', getSalaryRegisterReport);
router.get('/advances-and-loans', getAdvancesAndLoansReport);
router.get('/export', exportReportCSV);
router.get('/audit-logs', getAuditLogs);

export default router;
