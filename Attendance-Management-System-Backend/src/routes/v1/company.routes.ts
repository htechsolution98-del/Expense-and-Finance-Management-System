import { Router } from 'express';
import { getCompanyProfile, updateCompanyProfile, subscribeToCompany, getActivePlans, createSubscriptionOrder } from '../../controllers/company.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', getCompanyProfile);
router.put('/', upload.single('logo'), updateCompanyProfile);
router.get('/plans', getActivePlans);
router.post('/create-subscription-order', createSubscriptionOrder);
router.post('/subscribe', subscribeToCompany);

export default router;
