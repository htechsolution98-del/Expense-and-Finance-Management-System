import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { authorize } from '../../middleware/permission.middleware';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../controllers/payment-category.controller';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', authorize(['COMPANY_VIEW', 'PAYMENT_VIEW', 'PAYMENT_CREATE']), getCategories);
router.post('/', authorize('COMPANY_UPDATE'), createCategory);
router.patch('/:id', authorize('SUPER_ADMIN_ONLY'), updateCategory);
router.delete('/:id', authorize('SUPER_ADMIN_ONLY'), deleteCategory);

export default router;
