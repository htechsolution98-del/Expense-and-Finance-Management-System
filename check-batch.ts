import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const batches = await prisma.payroll.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      payrollItems: { select: { status: true, netSalary: true } }
    }
  });
  batches.forEach(b => {
    console.log(`\nBatch: ${b.payrollNo} | Status: ${b.status} | Month: ${b.month}/${b.year}`);
    b.payrollItems.forEach(i => console.log(`  Item: ${i.status} ₹${i.netSalary}`));
  });
}
main().finally(() => prisma.$disconnect());
