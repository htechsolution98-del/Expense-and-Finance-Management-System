import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Find all batches marked PAID but still have non-PAID items
  const batches = await prisma.payroll.findMany({
    where: { status: 'PAID' },
    include: {
      payrollItems: { select: { status: true } }
    }
  });

  for (const batch of batches) {
    const hasNonPaid = batch.payrollItems.some(i => i.status !== 'PAID');
    if (hasNonPaid) {
      await prisma.payroll.update({
        where: { id: batch.id },
        data: { status: 'APPROVED' }
      });
      console.log(`Fixed batch ${batch.payrollNo} → APPROVED (had non-PAID items)`);
    }
  }
  console.log('Done!');
}
main().finally(() => prisma.$disconnect());
