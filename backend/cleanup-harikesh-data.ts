import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up duplicate Harikesh employee records...');

  const activeUser = await prisma.user.findFirst({
    where: { email: 'harikesh@gmail.com' }
  });

  if (!activeUser || !activeUser.employeeId) {
    console.log('Active Harikesh user not found!');
    return;
  }

  const activeEmpId = activeUser.employeeId;
  const activeEmp = await prisma.employee.findUnique({ where: { id: activeEmpId } });
  console.log(`Active User ID: ${activeUser.id}, Active Emp ID: ${activeEmpId} (${activeEmp?.employeeCode})`);

  // Update active employee name
  await prisma.employee.update({
    where: { id: activeEmpId },
    data: { name: 'Maurya Harikesh', email: 'harikesh@gmail.com' }
  });

  // Find all other employee records named Harikesh
  const duplicateEmployees = await prisma.employee.findMany({
    where: {
      id: { not: activeEmpId },
      OR: [
        { name: { contains: 'Harikesh' } },
        { email: { contains: 'harikesh' } }
      ]
    }
  });

  const dupIds = duplicateEmployees.map(e => e.id);
  console.log('Duplicate employee IDs to merge:', dupIds);

  if (dupIds.length > 0) {
    // Re-link salary structures
    await prisma.salaryStructure.updateMany({
      where: { employeeId: { in: dupIds } },
      data: { employeeId: activeEmpId }
    });

    // Re-link payroll items
    await prisma.payrollItem.updateMany({
      where: { employeeId: { in: dupIds } },
      data: { employeeId: activeEmpId }
    });

    // Re-link expenses
    await prisma.expense.updateMany({
      where: { employeeId: { in: dupIds } },
      data: { employeeId: activeEmpId }
    });

    // Re-link advances
    await prisma.advance.updateMany({
      where: { employeeId: { in: dupIds } },
      data: { employeeId: activeEmpId }
    });

    // Delete duplicate employees
    await prisma.employee.deleteMany({
      where: { id: { in: dupIds } }
    });

    console.log(`Merged ${dupIds.length} duplicate employee records into active code ${activeEmp?.employeeCode}`);
  }

  // Ensure active employee has a SalaryStructure
  const existingStructure = await prisma.salaryStructure.findFirst({
    where: { employeeId: activeEmpId }
  });

  if (!existingStructure) {
    await prisma.salaryStructure.create({
      data: {
        companyId: activeUser.companyId,
        employeeId: activeEmpId,
        basic: 12000,
        hra: 0,
        conveyance: 0,
        medical: 0,
        special: 0,
        pf: 0,
        professionalTax: 0,
        tds: 0,
        effectiveDate: new Date(),
        status: 'ACTIVE',
        createdBy: activeUser.id
      }
    });
    console.log('Created default salary structure for active employee.');
  }

  console.log('Cleanup complete!');
}

main().finally(() => prisma.$disconnect());
