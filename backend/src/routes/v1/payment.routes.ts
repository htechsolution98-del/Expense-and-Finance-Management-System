import { Router } from 'express';
import { createPaymentIn, createPaymentOut } from '../../controllers/payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

import { upload } from '../../middleware/upload.middleware';

import { getVouchers, approveVoucher, disburseVoucher } from '../../controllers/payment.controller';

router.get('/vouchers', authorize('PAYMENT_VIEW'), getVouchers);
router.post('/in', authorize('PAYMENT_CREATE'), createPaymentIn);
router.post('/out', authorize('PAYMENT_CREATE'), upload.single('bill'), createPaymentOut);
router.post('/out/:id/approve', authenticate, approveVoucher); // Permissions checked in controller
router.post('/out/:id/disburse', authorize('PAYMENT_CREATE'), disburseVoucher);

export default router;
