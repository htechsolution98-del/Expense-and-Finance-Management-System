import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetClean() {
  console.log('======================================================');
  console.log('  DATABASE FULL CLEAN — Deleting ALL data from tables');
  console.log('======================================================\n');

  // Delete in dependency order (children before parents)
  await prisma.leaveApproval.deleteMany({});
  console.log('✓ leaveApprovals cleared');
  await prisma.leaveRequest.deleteMany({});
  console.log('✓ leaveRequests cleared');
  await prisma.leaveBalance.deleteMany({});
  console.log('✓ leaveBalances cleared');
  await prisma.leavePolicy.deleteMany({});
  console.log('✓ leavePolicies cleared');
  await prisma.holiday.deleteMany({});
  console.log('✓ holidays cleared');
  await prisma.leaveType.deleteMany({});
  console.log('✓ leaveTypes cleared');
  await prisma.advanceSettlement.deleteMany({});
  console.log('✓ advanceSettlements cleared');
  await prisma.advance.deleteMany({});
  console.log('✓ advances cleared');
  await prisma.payrollItem.deleteMany({});
  console.log('✓ payrollItems cleared');
  await prisma.payroll.deleteMany({});
  console.log('✓ payrolls cleared');
  await prisma.salaryStructure.deleteMany({});
  console.log('✓ salaryStructures cleared');
  await prisma.approvalStep.deleteMany({});
  console.log('✓ approvalSteps cleared');
  await prisma.approvalRequest.deleteMany({});
  console.log('✓ approvalRequests cleared');
  await prisma.approvalRule.deleteMany({});
  console.log('✓ approvalRules cleared');
  await prisma.expense.deleteMany({});
  console.log('✓ expenses cleared');
  await prisma.expenseCategory.deleteMany({});
  console.log('✓ expenseCategories cleared');
  await prisma.paymentCategory.deleteMany({});
  console.log('✓ paymentCategories cleared');
  await prisma.voucher.deleteMany({});
  console.log('✓ vouchers cleared');
  await prisma.transaction.deleteMany({});
  console.log('✓ transactions cleared');
  await prisma.account.deleteMany({});
  console.log('✓ accounts cleared');
  await prisma.loan.deleteMany({});
  console.log('✓ loans cleared');
  await prisma.client.deleteMany({});
  console.log('✓ clients cleared');
  await prisma.vendor.deleteMany({});
  console.log('✓ vendors cleared');
  await prisma.employeeBankAccount.deleteMany({});
  console.log('✓ employeeBankAccounts cleared');
  await prisma.designation.deleteMany({});
  console.log('✓ designations cleared');
  await prisma.department.deleteMany({});
  console.log('✓ departments cleared');
  await prisma.auditLog.deleteMany({});
  console.log('✓ auditLogs cleared');
  await prisma.refreshToken.deleteMany({});
  console.log('✓ refreshTokens cleared');
  await prisma.userPermission.deleteMany({});
  console.log('✓ userPermissions cleared');
  await prisma.userRole.deleteMany({});
  console.log('✓ userRoles cleared');
  await prisma.rolePermission.deleteMany({});
  console.log('✓ rolePermissions cleared');
  await prisma.user.deleteMany({});
  console.log('✓ users cleared');
  await prisma.employee.deleteMany({});
  console.log('✓ employees cleared');
  await prisma.permission.deleteMany({});
  console.log('✓ permissions cleared');
  await prisma.role.deleteMany({});
  console.log('✓ roles cleared');
  await prisma.company.deleteMany({});
  console.log('✓ companies cleared');

  console.log('\n======================================================');
  console.log('  ✅ Database fully wiped — all tables are empty.');
  console.log('  Run "npm run prisma:seed" to initialize system data.');
  console.log('======================================================\n');
}

resetClean()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
