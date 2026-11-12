import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncAdmin() {
  const role = await prisma.role.findFirst({ where: { name: 'ADMIN' } });
  if (!role) {
    console.log('ADMIN role not found');
    return;
  }
  
  const perms = ['PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_APPROVE'];
  
  for (const perm of perms) {
    let p = await prisma.permission.findUnique({ where: { name: perm } });
    if (!p) {
      p = await prisma.permission.create({ data: { name: perm } });
      console.log('Created permission:', perm);
    }
    
    const exists = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: p.id }
    });
    
    if (!exists) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id }
      });
      console.log('Added', perm, 'to ADMIN');
    }
  }
  console.log('Done!');
}

syncAdmin().catch(console.error).finally(() => prisma.$disconnect());
