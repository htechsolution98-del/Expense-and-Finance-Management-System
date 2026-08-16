import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getExpenses,
  createExpense,
  updateExpense,
  submitExpense,
  approveExpenseStep,
  rejectExpenseStep,
  returnExpenseStep,
  payExpense,
  deleteExpense,
} from '../../controllers/expense.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Categories
router.get('/categories', getCategories);
router.post('/categories', (req, res, next) => {
  const role = req.user!.role;
  const perms = req.user!.permissions || [];
  if (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'ACCOUNTS' ||
    role.startsWith('ACCOUNT') ||
    role.startsWith('ADMIN') ||
    perms.includes('*') ||
    perms.includes('EXPENSE_APPROVE')
  ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Only Super Admin, Admin, and Accounts roles can create expense categories',
      code: 'FORBIDDEN',
      errors: []
    });
  }
}, createCategory);
router.put('/categories/:id', (req, res, next) => {
  const role = req.user!.role;
  const perms = req.user!.permissions || [];
  if (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'ACCOUNTS' ||
    role.startsWith('ACCOUNT') ||
    role.startsWith('ADMIN') ||
    perms.includes('*')
  ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Only Super Admin, Admin, and Accounts roles can edit expense categories',
      code: 'FORBIDDEN',
      errors: []
    });
  }
}, updateCategory);
router.delete('/categories/:id', (req, res, next) => {
  const role = req.user!.role;
  const perms = req.user!.permissions || [];
  if (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'ACCOUNTS' ||
    role.startsWith('ACCOUNT') ||
    role.startsWith('ADMIN') ||
    perms.includes('*')
  ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Only Super Admin, Admin, and Accounts roles can delete expense categories',
      code: 'FORBIDDEN',
      errors: []
    });
  }
}, deleteCategory);

// Expenses Core Operations
router.get('/', authorize('EXPENSE_VIEW'), getExpenses);
router.post('/', authorize('EXPENSE_CREATE'), upload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'paymentProof', maxCount: 1 }]), createExpense);
router.patch('/:id', authorize('EXPENSE_CREATE'), upload.fields([{ name: 'receipt', maxCount: 1 }, { name: 'paymentProof', maxCount: 1 }]), updateExpense);
router.delete('/:id', authorize('EXPENSE_CREATE'), deleteExpense);
router.post('/:id/submit', authorize('EXPENSE_CREATE'), submitExpense);

// Workflow Sequences Approval Actions
router.post('/:id/approve', authorize('EXPENSE_APPROVE'), approveExpenseStep);
router.post('/:id/reject', authorize('EXPENSE_APPROVE'), rejectExpenseStep);
router.post('/:id/return', authorize('EXPENSE_APPROVE'), returnExpenseStep);

// Settle and Reimburse Payout
router.post('/:id/pay', authorize('PAYMENT_CREATE'), upload.single('paymentProof'), payExpense);

export default router;
