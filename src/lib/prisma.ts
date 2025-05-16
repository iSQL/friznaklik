import 'server-only';
// src/lib/prisma.ts

// Import the PrismaClient from the standard generated path
// This assumes your schema.prisma is configured to output to the default location
import { PrismaClient } from '@prisma/client'; // <-- Standard import path

// Declare a global variable for the PrismaClient instance in development
// This is a standard practice to prevent multiple instances in development hot-reloading
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create the PrismaClient instance
const prisma = global.prisma || new PrismaClient();

// In development, assign the instance to the global variable
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Export the single instance of the PrismaClient
export default prisma;
