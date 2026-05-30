import prisma from '../src/lib/prisma.js';

async function main() {
  await prisma.user.findFirst({ select: { id: true } });
  console.log('✅ Connected.');
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