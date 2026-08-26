import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { ForbiddenError } from '../../utils/errors';
import {
  listCompanies,
  createCompany,
  updateCompanyStatus,
  getSystemStats,
  updateCompanyDetails,
  deleteCompany,
  resetCompanyAdminPassword,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listPayments,
} from '../../controllers/system.controller';

const router = Router();

/**
 * Middleware that strictly permits only the Global Master Admin:
 * The SUPER_ADMIN user belonging to the system administration company UUID '00000000-0000-0000-0000-000000000000'.
 */
const globalMasterAdminOnly = (req: Request, _res: Response, next: NextFunction): void => {
  if (
    req.user &&
    req.user.role === 'SUPER_ADMIN' &&
    req.user.companyId === '00000000-0000-0000-0000-000000000000'
  ) {
    next();
  } else {
    next(new ForbiddenError('Access restricted to System Master Administrator only'));
  }
};

// Apply security barriers globally to all system console endpoints
router.use(authenticate);
router.use(globalMasterAdminOnly);

// System administration endpoints
router.get('/companies', listCompanies);
router.post('/companies', createCompany);
router.patch('/companies/:id/status', updateCompanyStatus);
router.put('/companies/:id', updateCompanyDetails);
router.delete('/companies/:id', deleteCompany);
router.post('/companies/:companyId/reset-password', resetCompanyAdminPassword);
router.get('/stats', getSystemStats);

// Subscription plans management
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Payment history
router.get('/payments', listPayments);

export default router;
