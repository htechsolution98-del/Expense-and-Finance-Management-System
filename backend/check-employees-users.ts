import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      userRoles: { select: { role: { select: { name: true } } } }
    }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('\n=== EMPLOYEES ===');
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, name: true, email: true }
  });
  console.log(JSON.stringify(employees, null, 2));

  console.log('\n=== SALARY STRUCTURES ===');
  const structures = await prisma.salaryStructure.findMany({
    include: { employee: { select: { id: true, employeeCode: true, name: true } } }
  });
  console.log(JSON.stringify(structures.map(s => ({
    id: s.id,
    empId: s.employeeId,
    empCode: s.employee.employeeCode,
    empName: s.employee.name
  })), null, 2));
}

main().finally(() => prisma.$disconnect());
