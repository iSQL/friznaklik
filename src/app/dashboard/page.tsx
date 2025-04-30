import { currentUser } from "@clerk/nextjs/server"; // Corrected import path

export default async function DashboardPage() {
  const user = await currentUser(); // Get the signed-in user details on the server

  if (!user) {
    // This case should ideally be handled by middleware, but good practice to check
    return <div>You need to be signed in to view this page.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Welcome to Your Dashboard, {user.firstName}!</h1>
      <p>This is your personalized dashboard. Upcoming appointments will appear here.</p>
      {/* Future: Display user's appointments here */}
    </div>
  );
}
