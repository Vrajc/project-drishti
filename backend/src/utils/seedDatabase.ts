import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import type { UserRole } from '@prisma/client';

// Accounts created on boot so each role can actually be signed into. Adding the
// POLICE role in the camera-registry phase would otherwise leave a role nobody
// could log in as.
const SEED_USERS: Array<{ name: string; email: string; password: string; role: UserRole }> = [
  { name: 'Test User', email: 'test@gmail.com', password: 'Test@123', role: 'ORGANIZER' },
  { name: 'Registry Operator', email: 'police@gmail.com', password: 'Test@123', role: 'POLICE' },
];

export const seedTestUser = async (): Promise<void> => {
  for (const seed of SEED_USERS) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email: seed.email } });

      if (existingUser) {
        console.log(`✅ Seed user already exists: ${seed.email} (${existingUser.role})`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(seed.password, 10);

      await prisma.user.create({
        data: {
          name: seed.name,
          email: seed.email,
          password: hashedPassword,
          role: seed.role,
        },
      });

      console.log(`✅ Seed user created: ${seed.email} / ${seed.password} (${seed.role})`);
    } catch (error: any) {
      console.error(`❌ Error seeding ${seed.email}:`, error.message);
    }
  }
};
