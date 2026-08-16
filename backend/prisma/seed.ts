import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Company (name is intentionally blank — set it via Company Profile in the app)
  const defaultCompany = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' }, // fixed UUID for seed company
    update: {
      // Do NOT overwrite name/logo/address here — user sets these via Company Profile UI
      status: 'ACTIVE',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: '', // Set your company name from Company Profile settings
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
    },
  });
  console.log(`Company record ready (id: ${defaultCompany.id})`);

  // 2. Define Phase 2 Granular Permissions
  const permissionsList = [
    // Wildcard — SUPER_ADMIN only: grants access to everything
    { name: '*', description: 'Wildcard — full system access (SUPER_ADMIN only)' },
    { name: 'USER_VIEW', description: 'View system users' },
    { name: 'USER_CREATE', description: 'Create system users' },
    { name: 'USER_UPDATE', description: 'Update system users profile' },
    { name: 'USER_DISABLE', description: 'Enable/disable system users' },
    { name: 'ROLE_VIEW', description: 'View roles' },
    { name: 'ROLE_CREATE', description: 'Create roles' },
    { name: 'ROLE_UPDATE', description: 'Assign or edit roles' },
    { name: 'COMPANY_VIEW', description: 'View company settings' },
    { name: 'COMPANY_UPDATE', description: 'Update company settings' },
    { name: 'ACCOUNT_VIEW', description: 'View accounts and balances' },
    { name: 'ACCOUNT_CREATE', description: 'Create bank/cash accounts' },
    { name: 'ACCOUNT_UPDATE', description: 'Update bank/cash accounts' },
    { name: 'EXPENSE_VIEW', description: 'View office/staff expenses' },
    { name: 'EXPENSE_CREATE', description: 'Submit office/staff expenses' },
    { name: 'EXPENSE_APPROVE', description: 'Approve office/staff expenses' },
    { name: 'PAYMENT_VIEW', description: 'View payment registry' },
    { name: 'PAYMENT_CREATE', description: 'Create outgoing payment' },
    { name: 'PAYMENT_APPROVE', description: 'Approve outgoing payment' },
    { name: 'SALARY_VIEW', description: 'View employee salaries' },
    { name: 'SALARY_CREATE', description: 'Generate monthly salaries' },
    { name: 'SALARY_APPROVE', description: 'Approve monthly salaries' },
    { name: 'LOAN_VIEW', description: 'View business loans' },
    { name: 'LOAN_CREATE', description: 'Record business loans' },
    { name: 'LOAN_APPROVE', description: 'Approve business loans/repayments' },
    { name: 'ADVANCE_VIEW', description: 'View staff advances' },
    { name: 'ADVANCE_CREATE', description: 'Submit staff advance requests' },
    { name: 'ADVANCE_APPROVE', description: 'Approve/settle staff advances' },
    { name: 'REPORT_VIEW', description: 'View analytics and reports' },
    { name: 'LEAVE_VIEW', description: 'View leave requests and balance' },
    { name: 'LEAVE_APPLY', description: 'Apply for leaves' },
    { name: 'LEAVE_APPROVE', description: 'Approve pending leave requests' },
    { name: 'LEAVE_REJECT', description: 'Reject pending leave requests' },
    { name: 'LEAVE_CANCEL', description: 'Cancel leave requests' },
    { name: 'LEAVE_MANAGE', description: 'Manage leave types and allocations' },
    { name: 'LEAVE_BALANCE_MANAGE', description: 'Manage employee leave balances' },
    { name: 'LEAVE_REPORT_VIEW', description: 'View leave reports and analytics' },
    { name: 'LEAVE_POLICY_MANAGE', description: 'Manage company leave policies' },
  ];

  const dbPermissions: Record<string, string> = {};
  for (const perm of permissionsList) {
    const createdPerm = await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description },
      create: perm,
    });
    dbPermissions[perm.name] = createdPerm.id;
  }
  console.log(`Permissions seeded: ${Object.keys(dbPermissions).length} permissions`);

  // 3. Seed only the SUPER_ADMIN system role.
  // All other roles (ADMIN, ACCOUNTS, STAFF, custom) must be created via the app UI.
  const rolesList = [
    {
      name: 'SUPER_ADMIN',
      description: 'Super Admin - full system access',
      // '*' wildcard grants full access — checked in middleware & sidebar
      permissions: ['*'],
    },
  ];

  const seededRoles: Record<string, string> = {};
  // Clear out old roles permissions links first to avoid orphaned links
  await prisma.rolePermission.deleteMany({});

  for (const r of rolesList) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: {
        name: r.name,
        description: r.description,
      },
    });
    seededRoles[role.name] = role.id;
    console.log(`Seeding role ${role.name} permissions...`);

    // Connect permissions to roles
    for (const permName of r.permissions) {
      const permId = dbPermissions[permName];
      if (permId) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }

  // 4. Seed Root SuperAdmin User only
  // All other users (Admin, Accounts, Staff) must be created via the app UI by the SuperAdmin.
  const passwordHash = await bcrypt.hash('Password@123', 12);

  // SuperAdmin employee record
  const superAdminEmp = await prisma.employee.upsert({
    where: { companyId_employeeCode: { companyId: defaultCompany.id, employeeCode: 'EMP-001' } },
    update: { name: 'Super Admin' },
    create: {
      companyId: defaultCompany.id,
      employeeCode: 'EMP-001',
      name: 'Super Admin',
      email: 'superadmin@acme.com',
      mobile: '9999999999',
      joiningDate: new Date(),
      address: '',
      status: 'ACTIVE',
    },
  });

  // SuperAdmin user account
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@acme.com' },
    update: { name: 'Super Admin', passwordHash, status: 'ACTIVE', employeeId: superAdminEmp.id },
    create: {
      email: 'superadmin@acme.com',
      name: 'Super Admin',
      passwordHash,
      companyId: defaultCompany.id,
      status: 'ACTIVE',
      employeeId: superAdminEmp.id,
    },
  });

  // Assign SUPER_ADMIN role
  await prisma.userRole.deleteMany({ where: { userId: superAdminUser.id } });
  await prisma.userRole.create({
    data: { userId: superAdminUser.id, roleId: seededRoles['SUPER_ADMIN'] },
  });
  console.log(`SuperAdmin user seeded: superadmin@acme.com (Password: Password@123)`);

  // 5. Seed Default Leave Types
  const defaultLeaveTypes = [
    { code: 'CL', name: 'Casual Leave', description: 'Paid leave for personal matters', isPaid: true, annualQuota: 12, allowHalfDay: true },
    { code: 'SL', name: 'Sick Leave', description: 'Paid leave for medical reasons', isPaid: true, annualQuota: 12, allowHalfDay: true },
    { code: 'EL', name: 'Earned / Privilege Leave', description: 'Earned leave carried forward yearly', isPaid: true, annualQuota: 15, allowCarryForward: true, carryForwardLimit: 30 },
    { code: 'PL', name: 'Paid Leave', description: 'Standard paid leave allowance', isPaid: true, annualQuota: 10, allowHalfDay: true },
    { code: 'LWP', name: 'Unpaid Leave (LWP)', description: 'Leave Without Pay / Salary deduction', isPaid: false, annualQuota: 0, allowHalfDay: true },
    { code: 'OL', name: 'Optional / Festival Leave', description: 'Optional holiday leaves', isPaid: true, annualQuota: 3, allowHalfDay: false },
    { code: 'HD', name: 'Half Day Leave', description: 'Half day leave allowance', isPaid: true, annualQuota: 6, allowHalfDay: true },
  ];

  const seededLeaveTypes: Record<string, string> = {};
  for (const lt of defaultLeaveTypes) {
    const leaveType = await prisma.leaveType.upsert({
      where: { companyId_code: { companyId: defaultCompany.id, code: lt.code } },
      update: { name: lt.name, description: lt.description, isPaid: lt.isPaid, annualQuota: lt.annualQuota },
      create: {
        companyId: defaultCompany.id,
        code: lt.code,
        name: lt.name,
        description: lt.description,
        isPaid: lt.isPaid,
        annualQuota: lt.annualQuota,
        allowHalfDay: lt.allowHalfDay,
        allowCarryForward: lt.allowCarryForward || false,
        carryForwardLimit: lt.carryForwardLimit || null,
        isActive: true,
      },
    });
    seededLeaveTypes[lt.code] = leaveType.id;
  }
  console.log(`Default Leave Types seeded: ${Object.keys(seededLeaveTypes).length} types`);

  // 6. Seed Default Leave Policy
  const currentYear = new Date().getFullYear();
  const existingPolicy = await prisma.leavePolicy.findFirst({
    where: { companyId: defaultCompany.id, year: currentYear }
  });
  if (!existingPolicy) {
    await prisma.leavePolicy.create({
      data: {
        companyId: defaultCompany.id,
        name: 'Standard Corporate Policy',
        year: currentYear,
        workingDaysOnly: true,
        excludeWeekends: true,
        excludeHolidays: true,
        advanceNoticeDays: 1,
        allowNegativeBalance: false,
        autoApprove: false,
        isActive: true,
      }
    });
    console.log('Default Leave Policy seeded');
  }

  // 7. Seed Leave Balances for all active employees
  const employees = await prisma.employee.findMany({
    where: { companyId: defaultCompany.id, status: 'ACTIVE' }
  });

  const leaveTypesList = await prisma.leaveType.findMany({
    where: { companyId: defaultCompany.id, isActive: true }
  });

  for (const emp of employees) {
    for (const lt of leaveTypesList) {
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year: currentYear,
          }
        },
        update: {},
        create: {
          companyId: defaultCompany.id,
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allocated: lt.annualQuota,
          used: 0,
          pending: 0,
          remaining: lt.annualQuota,
          carriedForward: 0,
        }
      });
    }
  }
  console.log(`Leave balances initialized for ${employees.length} employees`);

  console.log('Database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
