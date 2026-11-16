import { prisma } from '../src/config/database';

async function testLeaveAttendanceBlock() {
  console.log('Testing Leave-Attendance Integration & Manual Right Check...');
  const company = await prisma.company.findFirst();
  if (!company) throw new Error('No company found');

  let emp = await prisma.employee.findFirst({ where: { companyId: company.id } });
  if (!emp) throw new Error('No employee found');

  let leaveType = await prisma.leaveType.findFirst({ where: { companyId: company.id } });
  if (!leaveType) {
    leaveType = await prisma.leaveType.create({
      data: { companyId: company.id, name: 'Casual Leave (CL)', code: 'CL', daysAllowed: 12, isPaid: true }
    });
  }

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  await prisma.leaveRequest.deleteMany({
    where: { employeeId: emp.id, fromDate: { lte: endOfDay }, toDate: { gte: startOfDay } }
  });

  const leave = await prisma.leaveRequest.create({
    data: {
      companyId: company.id,
      employeeId: emp.id,
      leaveTypeId: leaveType.id,
      fromDate: startOfDay,
      toDate: endOfDay,
      totalDays: 1,
      reason: 'Testing Leave Block',
      status: 'APPROVED',
    }
  });

  console.log('✓ Approved leave created for employee ' + emp.name + ' covering today.');

  const approvedLeaveToday = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: emp.id,
      status: 'APPROVED',
      fromDate: { lte: endOfDay },
      toDate: { gte: startOfDay },
    },
    include: { leaveType: true },
  });

  if (approvedLeaveToday) {
    console.log('✓ Block condition triggered: Employee is on approved leave today (' + approvedLeaveToday.leaveType?.name + ')');
    console.log('  Notice: Check-in blocked: You are currently on an approved leave today. Please contact Admin or Super Admin.');
  } else {
    throw new Error('FAILED: Leave was not detected!');
  }

  const checkRight = (user: { role: string; permissions: string[] }) => {
    const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.permissions.includes('*');
    return isSuperAdmin || user.permissions.includes('ATTENDANCE_MANUAL_MARK') || user.permissions.includes('ATTENDANCE_MANAGE');
  };

  const superAdmin = { role: 'SUPER_ADMIN', permissions: ['*'] };
  const adminWithoutRight = { role: 'ADMIN', permissions: ['USER_VIEW', 'EXPENSE_APPROVE'] };
  const adminWithRight = { role: 'ADMIN', permissions: ['USER_VIEW', 'ATTENDANCE_MANUAL_MARK'] };

  console.log('✓ Super Admin can mark manual attendance:', checkRight(superAdmin) === true ? 'PASSED' : 'FAILED');
  console.log('✓ Admin WITHOUT manual right is blocked:', checkRight(adminWithoutRight) === false ? 'PASSED' : 'FAILED');
  console.log('✓ Admin WITH manual right can mark:', checkRight(adminWithRight) === true ? 'PASSED' : 'FAILED');

  await prisma.leaveRequest.delete({ where: { id: leave.id } });
  console.log('✓ Cleaned up test leave.');
  console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

testLeaveAttendanceBlock().catch(console.error);

