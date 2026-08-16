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

// Leave Types (All authenticated users can view, Super Admin can manage)
router.get('/types', getLeaveTypes);
router.post('/types', authorize('*'), createLeaveType);
router.put('/types/:id', authorize('*'), updateLeaveType);
router.delete('/types/:id', authorize('*'), deleteLeaveType);

// Leave Policy (All authenticated users can view policy rules)
router.get('/policy', getLeavePolicy);
router.post('/policy', authorize('*'), createLeavePolicy);
router.put('/policy/:id', authorize('*'), updateLeavePolicy);
router.delete('/policy/:id', authorize('*'), deleteLeavePolicy);

// Company Holidays (All authenticated users can view holidays)
router.get('/holidays', getHolidays);
router.post('/holidays', authorize('*'), createHoliday);
router.put('/holidays/:id', authorize('*'), updateHoliday);
router.delete('/holidays/:id', authorize('*'), deleteHoliday);

// Leave Balances (All authenticated users can view their balance)
router.get('/balance', getLeaveBalances);
router.post('/balance/adjust', authorize(['LEAVE_BALANCE_MANAGE', 'LEAVE_MANAGE', '*']), adjustLeaveBalance);
router.post('/balance/sync', authorize(['LEAVE_BALANCE_MANAGE', 'LEAVE_MANAGE', '*']), syncLeaveBalances);

// Leave Day Calculator Helper
router.get('/calculate-days', calculateLeaveDuration);

// Leave Requests Application & Approval Workflow
router.post('/apply', upload.single('attachment'), applyLeave);
router.get('/requests', getLeaveRequests);
router.post('/requests/:id/approve', approveLeave);
router.post('/requests/:id/reject', rejectLeave);
router.post('/requests/:id/cancel', cancelLeave);

// Leave Reports & Analytics
router.get('/reports', authorize(['LEAVE_REPORT_VIEW', 'LEAVE_MANAGE']), getLeaveReports);

export default router;
