import { Router } from 'express';
import { getTransactions, reverseTransaction } from '../../controllers/transaction.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { ForbiddenError } from '../../utils/errors';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Retrieve ledger history
router.get('/', authorize(['REPORT_VIEW', 'PAYMENT_VIEW']), getTransactions);

// Reversal triggers - restricted to SUPER_ADMIN or ADMIN roles
router.post(
  '/:id/reverse',
  (req, _res, next) => {
    if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'ADMIN') {
      return next(new ForbiddenError('Only Super Admin or Admin can reverse ledger transactions'));
    }
    next();
  },
  reverseTransaction
);

export default router;
