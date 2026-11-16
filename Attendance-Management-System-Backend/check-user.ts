import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findFirst({
    where: { email: 'mahil@gmail.com' },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(u?.userRoles.map(ur => ur.role.name), null, 2));
  console.log(JSON.stringify(u?.userRoles.map(ur => ur.role.rolePermissions.map(rp => rp.permission.name)), null, 2));
}
main().finally(() => prisma.$disconnect());
