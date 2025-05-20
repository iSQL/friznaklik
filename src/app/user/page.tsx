
import { getCurrentUser, AuthenticatedUser } from "@/lib/authUtils"; 
import { redirect } from "next/navigation";
import { Metadata } from "next";
import prisma from "@/lib/prisma"; 
import ManagePhoneNumberForm from "@/components/user/ManagePhoneNumberForm";

export const metadata: Metadata = {
  title: "Moj Profil - FrizNaKlik",
  description: "Dodajte broj telefona za notifikacije o rezervacijama.",
};

async function getUserPhoneNumber(prismaUserId: string): Promise<string | null> {
  try {
    const userWithPhone = await prisma.user.findUnique({
      where: { id: prismaUserId },
      select: { phoneNumber: true },
    });
    return userWithPhone?.phoneNumber || null;
  } catch (error) {
    console.error("Greška pri dohvatanju broja telefona korisnika:", error);
    return null;
  }
}

export default async function UserProfilePage() {
  const authenticatedUser: AuthenticatedUser | null = await getCurrentUser();

  if (!authenticatedUser) {
    redirect("/sign-in?redirect_url=/user");
  }

  const currentPhoneNumber = await getUserPhoneNumber(authenticatedUser.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center space-y-10"> 
        
        <ManagePhoneNumberForm
          initialPhoneNumber={currentPhoneNumber}
          userId={authenticatedUser.id} 
        />
      </div>
    </div>
  );
}
