import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withRoleProtection,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole } from '@/lib/types/prisma-enums';


/**
 * Handles GET requests to fetch/search users.
 * Only accessible by SUPER_ADMIN.
 * Supports search by email, firstName, lastName.
 * Filters by role (e.g., only 'USER' role if specified).
 * Supports pagination.
 */
async function GET_handler(request: NextRequest) {

  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search')?.trim();
    const roleFilter = searchParams.get('role') as UserRole | null; // npr. 'USER'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {};

    if (searchTerm) {
      whereClause.OR = [
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (roleFilter) {
      if (whereClause.OR) {
        whereClause.AND = [
          { OR: whereClause.OR }, 
          { role: roleFilter }    
        ];
        delete whereClause.OR; 
      } else {
        whereClause.role = roleFilter;
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { 
        id: true,         
        clerkId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profileImageUrl: true,
      },
      orderBy: {
        email: 'asc', // Ili po prezimenu, imenu...
      },
      skip: skip,
      take: limit,
    });

    const totalUsers = await prisma.user.count({ where: whereClause });

    return NextResponse.json({
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      totalUsers,
    });

  } catch (error) {
    console.error('Greška pri dobavljanju/pretrazi korisnika:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja korisnika.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN]);
