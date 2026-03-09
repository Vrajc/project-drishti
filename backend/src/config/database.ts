import prisma from '../lib/prisma.js';

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected successfully via Prisma');
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ PostgreSQL disconnected successfully');
  } catch (error) {
    console.error('❌ PostgreSQL disconnection error:', error);
    throw error;
  }
};

