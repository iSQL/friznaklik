import 'server-only'; // Osigurava da se ovaj modul koristi samo na serveru

import { NextRequest, NextResponse } from 'next/server';
import { auth as getClerkAuth } from '@clerk/nextjs/server';
import prisma from './prisma';
import { UserRole } from '@/lib/types/prisma-enums'; 

export interface AuthenticatedUser {
  id: string; 
  clerkId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role: UserRole; 
  ownedVendorId?: string | null; 
} 

export type NextRouteContext<P extends Record<string, string | string[]> = Record<string, string | string[]>> = {
  params: Promise<P>;
};

export type NextApiHandler<
  P extends Record<string, string | string[]> = Record<string, string | string[]>,
  Res = unknown
> = (
  req: NextRequest,
  context: NextRouteContext<P>
) => Promise<NextResponse<Res> | Response>;


export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const { userId: clerkId } = await getClerkAuth(); 
  if (!clerkId) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        ownedVendor: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role as UserRole, 
      ownedVendorId: user.ownedVendor?.id || null,
    };
  } catch (error) {
    console.error('Greška pri dobavljanju korisnika iz Prisma DB:', error);
    return null;
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === UserRole.SUPER_ADMIN;
}

export async function isVendorOwner(vendorIdToCheck?: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.VENDOR_OWNER) { 
    return false;
  }
  if (vendorIdToCheck) {
    return user.ownedVendorId === vendorIdToCheck;
  }
  return true;
}

export async function getVendorIdForCurrentOwner(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.role === UserRole.VENDOR_OWNER && user.ownedVendorId) {
    return user.ownedVendorId;
  }
  return null;
}

export async function ensureAuthenticated(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Korisnik nije autentifikovan."); 
  }
  return user;
}

export function withRoleProtection<
  P extends Record<string, string | string[]> = Record<string, string | string[]>,
  Res = unknown
>(
  handler: NextApiHandler<P, Res>,
  allowedRoles: UserRole[],
  vendorIdParamName?: string
): NextApiHandler<P, Res | { message: string }> {
  return async (req, context) => {
    const user = await getCurrentUser(); 

    if (!user) {
      return NextResponse.json({ message: 'Autentifikacija je neophodna.' }, { status: 401 });
    }

    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ message: 'Zabranjeno: Nedovoljne dozvole.' }, { status: 403 });
    }

    if (user.role === UserRole.VENDOR_OWNER) { 
      if (!user.ownedVendorId) {
        console.error(`VENDOR_OWNER ${user.clerkId || user.id} nema povezan vendorId.`);
        return NextResponse.json({ message: 'Zabranjeno: Povezanost sa salonom nedostaje.' }, { status: 403 });
      }
      if (vendorIdParamName) {
        const resolvedParams = await context.params;
        if (resolvedParams && (resolvedParams as Record<string, string>)[vendorIdParamName]) {
          const pathVendorId = (resolvedParams as Record<string, string>)[vendorIdParamName];
          if (user.ownedVendorId !== pathVendorId) {
            return NextResponse.json({ message: 'Zabranjeno: Ne posedujete ovaj resurs salona.' }, { status: 403 });
          }
        }
      }
    }
    
    return handler(req, context);
  };
}
