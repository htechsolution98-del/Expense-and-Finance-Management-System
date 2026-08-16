import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getMyBankAccount,
  upsertMyBankAccount,
  getPendingBankAccounts,
  verifyBankAccount,
  rejectBankAccount,
  getMySalarySlips,
  getMySalarySlipDetail,
} from '../../controllers/employee.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Self-service profile & bank account
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.get('/me/bank-account', getMyBankAccount);
router.post('/me/bank-account', upsertMyBankAccount);
router.put('/me/bank-account', upsertMyBankAccount);

// Bank account verification management (Accounts / Admin)
router.get('/bank-accounts/pending', authorize('SALARY_VIEW'), getPendingBankAccounts);
router.post('/bank-accounts/:id/verify', authorize('SALARY_VIEW'), verifyBankAccount);
router.post('/bank-accounts/:id/reject', authorize('SALARY_VIEW'), rejectBankAccount);

// Self-service salary slips
router.get('/me/salary-slips', getMySalarySlips);
router.get('/me/salary-slips/:id', getMySalarySlipDetail);

export default router;
