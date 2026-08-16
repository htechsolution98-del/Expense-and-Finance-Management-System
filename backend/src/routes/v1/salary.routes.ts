import { Router } from 'express';
import {
  getSalaryStructures,
  upsertSalaryStructure,
  updateSalaryStructure,
  deleteSalaryStructure,
  getPayrolls,
  getPayrollById,
  generatePayroll,
  approvePayroll,
  payPayrollItem,
  payPayrollBatch,
  toggleHoldPayrollItem,
} from '../../controllers/salary.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Salary structures mapping configuration
router.get('/structures', authorize('SALARY_VIEW'), getSalaryStructures);
router.post('/structures', authorize('SALARY_CREATE'), upsertSalaryStructure);
router.put('/structures/:id', authorize('SALARY_CREATE'), updateSalaryStructure);
router.delete('/structures/:id', authorize('SALARY_CREATE'), deleteSalaryStructure);

// Payroll batch configurations
router.get('/payrolls', authorize('SALARY_VIEW'), getPayrolls);
router.get('/payrolls/:id', authorize('SALARY_VIEW'), getPayrollById);
router.post('/payrolls', authorize('SALARY_CREATE'), generatePayroll);
router.post('/payrolls/:id/approve', authorize('SALARY_APPROVE'), approvePayroll);

// Payout and Settlements
router.post('/payrolls/:id/pay', authorize('PAYMENT_CREATE'), payPayrollBatch);
router.post('/items/:itemId/pay', authorize('PAYMENT_CREATE'), payPayrollItem);
router.patch('/items/:itemId/hold', authorize('SALARY_APPROVE'), toggleHoldPayrollItem);

export default router;
