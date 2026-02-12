import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const testAccounts = [
  {
    email: 'student1@test.com',
    password: '123456',
    name: '测试学生1',
    role: 'STUDENT',
  },
  {
    email: 'student2@test.com',
    password: '123456',
    name: '测试学生2',
    role: 'STUDENT',
  },
  {
    email: 'teacher@test.com',
    password: '123456',
    name: '测试教师',
    role: 'TEACHER',
  },
];

async function main() {
  console.log('🌱 开始插入测试账号...');

  for (const account of testAccounts) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        email: account.email,
        password: hashedPassword,
        name: account.name,
        role: account.role,
      },
    });
    console.log(`  ✅ ${account.role === 'TEACHER' ? '教师' : '学生'}账号: ${user.email} (密码: ${account.password})`);
  }

  console.log('🌱 测试账号插入完成！');
}

main()
  .catch((e) => {
    console.error('❌ 插入测试账号失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
