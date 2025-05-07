// src/lib/authUtils.ts

import prisma from '@/lib/prisma'; // Import your Prisma client utility

/**
 * Checks if the authenticated user has an 'admin' role in the database.
 * @param userId - The Clerk user ID of the user to check.
 * @returns True if the user is an admin, false otherwise.
 */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  // Ensure userId is provided and is a non-empty string
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.log('[isAdminUser] Invalid or missing userId provided.');
    return false; 
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }, // Only fetch the role field for efficiency
    });

    if (!dbUser) {
      console.log(`[isAdminUser] No database user found for Clerk ID: ${userId}`);
      return false;
    }

    console.log(`[isAdminUser] Role for Clerk ID ${userId}: ${dbUser.role}`);
    return dbUser.role === 'admin';
  } catch (error) {
    console.error(`[isAdminUser] Error fetching user role for Clerk ID ${userId}:`, error);
    return false; // Default to false in case of any error
  }
}
