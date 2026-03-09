import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

export const seedTestUser = async (): Promise<void> => {
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: 'test@gmail.com' } });

    if (existingUser) {
      console.log('✅ Test user already exists in database');
      return;
    }

    const hashedPassword = await bcrypt.hash('Test@123', 10);

    await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@gmail.com',
        password: hashedPassword,
        role: 'ORGANIZER',
      },
    });

    console.log('✅ Test user seeded successfully: test@gmail.com / Test@123');
  } catch (error: any) {
    console.error('❌ Error seeding test user:', error.message);
  }
};
