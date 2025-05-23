import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { clerkClient as getClerkClientFunction, User as ClerkUser } from '@clerk/nextjs/server';
import { UserRole } from '@/lib/types/prisma-enums'; 
import { formatErrorMessage } from '@/lib/errorUtils'; 

const SYNC_API_KEY = process.env.SYNC_USERS_API_KEY;

async function syncClerkUsersLogic() {

    let allClerkUsers: ClerkUser[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    console.log('Starting Clerk user synchronization via API (unauthenticated but key-protected)...');

    const clerk = await getClerkClientFunction();

    while (hasMore) {
        try {
            const userListResponse = await clerk.users.getUserList({
                limit,
                offset,
                orderBy: '+created_at',
            });
            const users = userListResponse.data ?? [];
            if (users.length > 0) {
                allClerkUsers = allClerkUsers.concat(users);
                offset += users.length;
            } else {
                hasMore = false;
            }
            if (users.length < limit) {
                hasMore = false;
            }
            if (hasMore) await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error('Error fetching users from Clerk:', error);
            throw new Error(`Failed to fetch users from Clerk: ${formatErrorMessage(error, "fetching users from Clerk")}`);
        }
    }
    console.log(`Total fetched from Clerk: ${allClerkUsers.length} users.`);

    for (const clerkUser of allClerkUsers) {
        const primaryEmailAddress = clerkUser.emailAddresses.find(
            (email) => email.id === clerkUser.primaryEmailAddressId
        )?.emailAddress;

        if (!primaryEmailAddress) {
            skippedCount++;
            continue;
        }
        const userRoleInDb: UserRole = UserRole.USER;
        try {
            const result = await prisma.user.upsert({
                where: { clerkId: clerkUser.id },
                update: {
                    email: primaryEmailAddress,
                    firstName: clerkUser.firstName || null,
                    lastName: clerkUser.lastName || null,
                    profileImageUrl: clerkUser.imageUrl || null,
                },
                create: {
                    clerkId: clerkUser.id,
                    email: primaryEmailAddress,
                    firstName: clerkUser.firstName || null,
                    lastName: clerkUser.lastName || null,
                    profileImageUrl: clerkUser.imageUrl || null,
                    role: userRoleInDb,
                },
            });
            if (Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) {
                createdCount++;
            } else {
                updatedCount++;
            }
        } catch (dbError) {
            console.error(`Error upserting user ${primaryEmailAddress} (Clerk ID: ${clerkUser.id}) into DB:`, dbError);
            skippedCount++;
        }
    }
    const summary = {
        totalClerkUsers: allClerkUsers.length,
        createdInDb: createdCount,
        updatedInDb: updatedCount,
        skipped: skippedCount,
    };
    console.log('Synchronization summary:', summary);
    return summary;
}

export async function POST(req: NextRequest) {
    if (!SYNC_API_KEY) {
        console.error("SYNC_USERS_API_KEY is not configured on the server.");
        return NextResponse.json({ message: 'API endpoint not configured.' }, { status: 500 });
    }

    const providedApiKey = req.headers.get('X-Sync-Api-Key') || req.nextUrl.searchParams.get('apiKey');

    if (providedApiKey !== SYNC_API_KEY) {
        return NextResponse.json({ message: 'Unauthorized: Invalid or missing API key.' }, { status: 401 });
    }

    try {
        const summary = await syncClerkUsersLogic();
        return NextResponse.json({ message: 'Clerk user synchronization process completed.', summary }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = formatErrorMessage(error, "synchronizing Clerk users via API");
        console.error("API Error during sync:", errorMessage);
        return NextResponse.json({ message: 'Error during user synchronization.', error: errorMessage }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    if (!SYNC_API_KEY) {
        console.error("SYNC_USERS_API_KEY is not configured on the server.");
        return NextResponse.json({ message: 'API endpoint not configured.' }, { status: 500 });
    }

    const providedApiKey = req.headers.get('X-Sync-Api-Key') || req.nextUrl.searchParams.get('apiKey');

    if (providedApiKey !== SYNC_API_KEY) {
        return NextResponse.json({ message: 'Unauthorized: Invalid or missing API key.' }, { status: 401 });
    }

    try {
        const summary = await syncClerkUsersLogic();
        return NextResponse.json({ message: 'Clerk user synchronization process completed via GET.', summary }, { status: 200 });
    } catch (error: unknown) {
        const errorMessage = formatErrorMessage(error, "synchronizing Clerk users via API (GET)");
        console.error("API Error during sync (GET):", errorMessage);
        return NextResponse.json({ message: 'Error during user synchronization.', error: errorMessage }, { status: 500 });
    }
}