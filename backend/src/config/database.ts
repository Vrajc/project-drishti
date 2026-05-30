import prisma from '../lib/prisma.js';

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma Postgres connected successfully');
  } catch (error) {
    console.error('❌ Prisma Postgres connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma Postgres disconnected successfully');
  } catch (error) {
    console.error('❌ Prisma Postgres disconnection error:', error);
    throw error;
  }
};

