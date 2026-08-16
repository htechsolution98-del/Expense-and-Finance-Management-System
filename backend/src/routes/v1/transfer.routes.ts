import { Router } from 'express';
import { executeTransfer } from '../../controllers/transfer.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.post('/', authorize('PAYMENT_CREATE'), executeTransfer);

export default router;
