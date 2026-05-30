import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const connectionString =
	process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

if (!process.env.DATABASE_URL) {
	console.warn('DATABASE_URL is not set. Using fallback URL for startup; database operations may fail.');
}

const prisma = new PrismaClient({
	datasources: {
		db: { url: connectionString },
	},
});

export default prisma;
