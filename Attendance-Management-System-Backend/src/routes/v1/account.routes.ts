import { Router } from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../../controllers/account.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', authorize(['ACCOUNT_VIEW', 'PAYMENT_CREATE']), getAccounts);
router.post('/', authorize('ACCOUNT_CREATE'), createAccount);
// Restrict edit and delete to SUPER_ADMIN only (who has wildcard '*')
router.patch('/:id', authorize('SUPER_ADMIN_ONLY'), updateAccount);
router.delete('/:id', authorize('SUPER_ADMIN_ONLY'), deleteAccount);

export default router;
