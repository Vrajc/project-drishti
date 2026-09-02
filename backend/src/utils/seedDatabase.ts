import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import type { UserRole } from '@prisma/client';

// Accounts created on boot so each role can actually be signed into. Adding the
// POLICE role in the camera-registry phase would otherwise leave a role nobody
// could log in as.
//
// These are demo credentials, and the password below is in a public repository.
// A POLICE account reaches the surveillance estate, the watchlist and dispatch,
// so on a public deployment this seed does not run unless someone asks for it:
// set SEED_DEMO_USERS=true, and set SEED_USER_PASSWORD to something that is not
// published. Outside production it runs as before, so local setup is unchanged.
const SEED_USERS: Array<{ name: string; email: string; role: UserRole }> = [
  { name: 'Test User', email: 'test@gmail.com', role: 'ORGANIZER' },
  { name: 'Registry Operator', email: 'police@gmail.com', role: 'POLICE' },
];

const DEV_PASSWORD = 'Test@123';

export const seedTestUser = async (): Promise<void> => {
  const isProduction = process.env.NODE_ENV === 'production';
  const requested = process.env.SEED_DEMO_USERS === 'true';

  if (isProduction && !requested) {
    console.log('👤 Demo user seed skipped (set SEED_DEMO_USERS=true to create them)');
    return;
  }

  const configured = process.env.SEED_USER_PASSWORD?.trim();
  if (isProduction && !configured) {
    console.error(
      '❌ SEED_DEMO_USERS=true needs SEED_USER_PASSWORD. Refusing to create ' +
        'accounts on a public deployment with the password from the repository.'
    );
    return;
  }

  const password = configured || DEV_PASSWORD;
  const hashedPassword = await bcrypt.hash(password, 10);

  for (const seed of SEED_USERS) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email: seed.email } });

      if (existingUser) {
        // Only ever creates what is missing. An account that already exists
        // keeps the password it has - this is not a password reset, and a boot
        // that silently rewrote a live credential would be worse than one that
        // left it alone.
        console.log(`✅ Seed user already exists: ${seed.email} (${existingUser.role})`);
        continue;
      }

      await prisma.user.create({
        data: {
          name: seed.name,
          email: seed.email,
          password: hashedPassword,
          role: seed.role,
        },
      });

      // The password is printed only where it is already the published default.
      console.log(
        isProduction
          ? `✅ Seed user created: ${seed.email} (${seed.role})`
          : `✅ Seed user created: ${seed.email} / ${password} (${seed.role})`
      );
    } catch (error: any) {
      console.error(`❌ Error seeding ${seed.email}:`, error.message);
    }
  }
};
