import { Router } from 'express';
import { getCompanyProfile, updateCompanyProfile } from '../../controllers/company.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

router.get('/', getCompanyProfile);
router.put('/', upload.single('logo'), updateCompanyProfile);

export default router;
