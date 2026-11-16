import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'mahil@gmail.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }

  const check123456 = await bcrypt.compare('123456', user.passwordHash);
  const checkPassword = await bcrypt.compare('password', user.passwordHash);

  console.log('Email:', user.email);
  console.log('Password 123456 match:', check123456);
  console.log('Password "password" match:', checkPassword);
}

main().finally(() => prisma.$disconnect());
