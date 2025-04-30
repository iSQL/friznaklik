import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/', '/services', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth.protect(); // Corrected: Use auth directly, not auth()
  }
}); 

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
