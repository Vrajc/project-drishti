import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ path: './backend/.env' });

export default defineConfig({
  schema: './backend/prisma/schema.prisma',
  migrations: {
    path: './backend/prisma/migrations',
    seed: 'tsx backend/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});