import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString =
	process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

if (!process.env.DATABASE_URL) {
	console.warn('DATABASE_URL is not set. Using fallback URL for startup; database operations may fail.');
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

export default prisma;
