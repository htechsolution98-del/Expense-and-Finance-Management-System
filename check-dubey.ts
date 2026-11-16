import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Check what role ACCOUNT_I has and what permissions
  const u = await prisma.user.findFirst({
    where: { name: { contains: 'Dubey' } },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } }
            }
          }
        }
      }
    }
  });
  console.log('User:', u?.name, 'Role in token field:', (u as any)?.role);
  u?.userRoles.forEach(ur => {
    console.log('Role:', ur.role.name);
    console.log('Permissions:', ur.role.rolePermissions.map(rp => rp.permission.name));
  });
}
main().finally(() => prisma.$disconnect());
