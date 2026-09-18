import { PrismaClient } from '@prisma/client';

// Avoids creating a new PrismaClient on every hot-reload in dev.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
