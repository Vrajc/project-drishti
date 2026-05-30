import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: './backend/.env' });

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/postgres';

export default defineConfig({
  schema: './backend/prisma/schema.prisma',
  migrations: {
    path: './backend/prisma/migrations',
    seed: 'tsx backend/prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});