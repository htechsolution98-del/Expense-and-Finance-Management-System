import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const v = await prisma.voucher.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(v, null, 2));
}
main().finally(() => prisma.$disconnect());
