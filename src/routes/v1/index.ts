import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { subscriptionGuard } from '../../middleware/subscription.middleware';

import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import masterRoutes from './master.routes';
import accountRoutes from './account.routes';
import transactionRoutes from './transaction.routes';
import paymentRoutes from './payment.routes';
import transferRoutes from './transfer.routes';
import expenseRoutes from './expense.routes';
import salaryRoutes from './salary.routes';
import advanceRoutes from './advance.routes';
import employeeRoutes from './employee.routes';
import reportRoutes from './report.routes';
import paymentCategoryRoutes from './payment-category.routes';
import approvalRuleRoutes from './approval-rule.routes';
import companyRoutes from './company.routes';
import leaveRoutes from './leave.routes';
import attendanceRoutes from './attendance.routes';
import announcementRoutes from './announcement.routes';
import systemRoutes from './system.routes';

const router = Router();

// Public / system endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/company', companyRoutes);
router.use('/system', systemRoutes);

// Guarded client workspace sub-router
const clientWorkspaceRouter = Router();
clientWorkspaceRouter.use(authenticate);
clientWorkspaceRouter.use(tenantScopeMiddleware);
clientWorkspaceRouter.use(subscriptionGuard);

clientWorkspaceRouter.use('/users', userRoutes);
clientWorkspaceRouter.use('/masters', masterRoutes);
clientWorkspaceRouter.use('/accounts', accountRoutes);
clientWorkspaceRouter.use('/ledger', transactionRoutes);
clientWorkspaceRouter.use('/payments', paymentRoutes);
clientWorkspaceRouter.use('/transfers', transferRoutes);
clientWorkspaceRouter.use('/expenses', expenseRoutes);
clientWorkspaceRouter.use('/salaries', salaryRoutes);
clientWorkspaceRouter.use('/advances', advanceRoutes);
clientWorkspaceRouter.use('/employees', employeeRoutes);
clientWorkspaceRouter.use('/reports', reportRoutes);
clientWorkspaceRouter.use('/payment-categories', paymentCategoryRoutes);
clientWorkspaceRouter.use('/approval-rules', approvalRuleRoutes);
clientWorkspaceRouter.use('/leaves', leaveRoutes);
clientWorkspaceRouter.use('/attendance', attendanceRoutes);
clientWorkspaceRouter.use('/announcements', announcementRoutes);

router.use(clientWorkspaceRouter);

export default router;
