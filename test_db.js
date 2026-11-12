const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const v = await prisma.voucher.findMany({
    include: { transaction: true },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(v, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
