import { Router } from 'express';
import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeavePolicy,
  createLeavePolicy,
  updateLeavePolicy,
  deleteLeavePolicy,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getLeaveBalances,
  adjustLeaveBalance,
  syncLeaveBalances,
  calculateLeaveDuration,
  applyLeave,
  getLeaveRequests,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getLeaveReports,
} from '../../controllers/leave.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { tenantScopeMiddleware } from '../../middleware/tenantScope.middleware';
import { authorize } from '../../middleware/permission.middleware';
import { upload } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.use(tenantScopeMiddleware);

// Leave Types (Super Admin only can create/modify)
router.get('/types', authorize(['LEAVE_VIEW', 'LEAVE_MANAGE', 'LEAVE_APPLY']), getLeaveTypes);
router.post('/types', authorize('*'), createLeaveType);
router.put('/types/:id', authorize('*'), updateLeaveType);
router.delete('/types/:id', authorize('*'), deleteLeaveType);

// Leave Policy
router.get('/policy', authorize(['LEAVE_VIEW', 'LEAVE_POLICY_MANAGE']), getLeavePolicy);
router.post('/policy', authorize('*'), createLeavePolicy);
router.put('/policy/:id', authorize('*'), updateLeavePolicy);
router.delete('/policy/:id', authorize('*'), deleteLeavePolicy);

// Company Holidays (Super Admin only can create/modify)
router.get('/holidays', authorize(['LEAVE_VIEW', 'LEAVE_APPLY']), getHolidays);
router.post('/holidays', authorize('*'), createHoliday);
router.put('/holidays/:id', authorize('*'), updateHoliday);
router.delete('/holidays/:id', authorize('*'), deleteHoliday);

// Leave Balances
router.get('/balance', authorize(['LEAVE_VIEW', 'LEAVE_APPLY']), getLeaveBalances);
router.post('/balance/adjust', authorize(['LEAVE_BALANCE_MANAGE', 'LEAVE_MANAGE']), adjustLeaveBalance);
router.post('/balance/sync', authorize(['LEAVE_BALANCE_MANAGE', 'LEAVE_MANAGE', '*']), syncLeaveBalances);

// Leave Day Calculator Helper
router.get('/calculate-days', authorize(['LEAVE_VIEW', 'LEAVE_APPLY']), calculateLeaveDuration);

// Leave Requests Application & Approval Workflow
router.post('/apply', upload.single('attachment'), authorize(['LEAVE_APPLY']), applyLeave);
router.get('/requests', authorize(['LEAVE_VIEW', 'LEAVE_APPLY']), getLeaveRequests);
router.post('/requests/:id/approve', authorize(['LEAVE_APPROVE', 'LEAVE_MANAGE']), approveLeave);
router.post('/requests/:id/reject', authorize(['LEAVE_REJECT', 'LEAVE_MANAGE']), rejectLeave);
router.post('/requests/:id/cancel', authorize(['LEAVE_CANCEL', 'LEAVE_APPLY']), cancelLeave);

// Leave Reports & Analytics
router.get('/reports', authorize(['LEAVE_REPORT_VIEW', 'LEAVE_MANAGE']), getLeaveReports);

export default router;
