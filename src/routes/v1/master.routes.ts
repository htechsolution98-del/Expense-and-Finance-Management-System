import { Router } from 'express';
import {
  getClients,
  createClient,
  getVendors,
  createVendor,
  getEmployees,
  createEmployee,
  getLoans,
  createLoan,
  updateLoanStatus,
} from '../../controllers/master.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Clients
router.get('/clients', authorize('USER_VIEW'), getClients);
router.post('/clients', authorize('USER_CREATE'), createClient);

// Vendors
router.get('/vendors', authorize('USER_VIEW'), getVendors);
router.post('/vendors', authorize('USER_CREATE'), createVendor);

// Employees
router.get('/employees', getEmployees);
router.post('/employees', authorize('USER_CREATE'), createEmployee);

// Loans
router.get('/loans', authorize('LOAN_VIEW'), getLoans);
router.post('/loans', authorize('LOAN_CREATE'), createLoan);
router.patch('/loans/:id/status', authorize('LOAN_APPROVE'), updateLoanStatus);

export default router;
