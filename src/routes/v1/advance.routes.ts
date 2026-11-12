import { Router } from 'express';
import {
  getAdvances,
  createAdvance,
  updateAdvance,
  submitAdvance,
  approveAdvance,
  rejectAdvance,
  returnAdvance,
  disburseAdvance,
  settleAdvance,
  returnCash,
} from '../../controllers/advance.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(tenantScopeMiddleware);

// List & Create
router.get('/', authorize('ADVANCE_VIEW'), getAdvances);
router.post('/', authorize('ADVANCE_CREATE'), createAdvance);

// Update draft
router.patch('/:id', authorize('ADVANCE_CREATE'), updateAdvance);

// Workflow actions
router.post('/:id/submit', authorize('ADVANCE_CREATE'), submitAdvance);
router.post('/:id/approve', authorize('ADVANCE_APPROVE'), approveAdvance);
router.post('/:id/reject', authorize('ADVANCE_APPROVE'), rejectAdvance);
router.post('/:id/return', authorize('ADVANCE_APPROVE'), returnAdvance);

// Disburse & Settle
router.post('/:id/disburse', authorize('PAYMENT_CREATE'), disburseAdvance);
router.post('/:id/settle', authorize('ADVANCE_APPROVE'), settleAdvance);
router.post('/:id/return-cash', authorize('PAYMENT_CREATE'), returnCash);

export default router;
