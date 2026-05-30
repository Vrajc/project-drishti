import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma.js';

async function main() {
  const password = await bcrypt.hash('Test@123', 10);

  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@drishti.local' },
    update: {},
    create: {
      name: 'Seed Organizer',
      email: 'organizer@drishti.local',
      password,
      role: 'ORGANIZER',
    },
  });

  const participant = await prisma.user.upsert({
    where: { email: 'participant@drishti.local' },
    update: {},
    create: {
      name: 'Seed Participant',
      email: 'participant@drishti.local',
      password,
      role: 'PARTICIPANT',
    },
  });

  const existingEvent = await prisma.event.findFirst({
    where: { name: 'Prisma Postgres Demo Event' },
  });

  if (!existingEvent) {
    await prisma.event.create({
      data: {
        name: 'Prisma Postgres Demo Event',
        type: 'Demo',
        date: '2026-05-30',
        time: '18:00',
        crowdSize: 250,
        location: 'Prisma Arena',
        description: 'Seed data for verifying the Prisma Postgres migration.',
        organizerId: organizer.id,
        organizerEmail: organizer.email,
        organizerName: organizer.name,
      },
    });
  }

  console.log('✅ Prisma seed completed');
  console.log(`Seeded users: ${organizer.email}, ${participant.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });