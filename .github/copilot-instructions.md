# GitHub Copilot Instructions for FrizNaKlik Project

## 1. Project Overview

**FrizNaKlik** is a web application built with Next.js for online booking of hairdresser appointments. It allows users to browse services, book appointments, view their dashboard, and chat with administrators. Administrators have a dedicated panel to manage services, appointments, and user chats.

## 2. Technology Stack

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **UI Library:** React
* **Styling:** Tailwind CSS + DaisyUI (primarily dark theme)
* **Authentication:** Clerk
* **Database ORM:** Prisma
* **Database:** PostgreSQL
* **State Management:** Zustand (for booking, chat)
* **Icons:** Lucide Icons (`lucide-react`)
* **Date/Time:** `date-fns`

## 3. Key Libraries & Conventions

* **Next.js App Router:** Utilize Server Components and Client Components (`'use client'`) appropriately. Follow conventions for `page.tsx`, `layout.tsx`, API routes (`src/app/api/.../route.ts`), and middleware (`src/middleware.ts`).
* **React:** Use functional components and hooks.
* **TypeScript:** Adhere to strict typing. Define interfaces/types where necessary.
* **Tailwind CSS & DaisyUI:** Style components using Tailwind utility classes and DaisyUI component classes. Ensure consistency with the chosen DaisyUI theme (currently seems to be `dark`). Improve UI elements using DaisyUI where appropriate.
* **Clerk:** Use `auth()` from `@clerk/nextjs/server` for authentication checks in Server Components/API routes and `useAuth()` from `@clerk/nextjs` in Client Components. Handle loading states (`isLoaded`).
* **Prisma:** Use Prisma Client (`@/lib/prisma`) for all database interactions. Follow Prisma schema definitions.
* **Admin Role Check:**
    * On the **server-side** (Layouts, Pages, API Routes), use the functions imported from `src/lib/authUtils.ts` to check if a user has administrative privileges.
    * Avoid relying solely on client-side checks or JWT claims (`sessionClaims`) for critical authorization logic. If admin status is needed in a Client Component, fetch it or pass it down as a prop from a Server Component parent (like `RootLayout` passing `isUserAdminFromServer` to `Header`).
* **Error Handling:** Utilize `formatErrorMessage` from `src/lib/errorUtils.ts` where applicable. Implement proper error handling (try/catch) in API calls and data fetching. Display user-friendly error messages.
* **State Management:** Use Zustand stores (`bookingStore`, `chatStore`) for relevant client-side state.
* **Icons:** Use icons from `lucide-react`.

## 4. Language & Translation

* **Primary UI Language:** Serbian (Latin script - `sr-Latn`).
* **Task:** Translate all user-facing strings (labels, buttons, messages, placeholders, etc.) into Serbian.
* **Date Formatting:** Use `date-fns` library along with the `srLatn` locale for formatting dates and times displayed to the user in Serbian. Example: `format(date, 'EEEE, d. MMMM yyyy.', { locale: srLatn })`.
* **Currency:** Use "RSD" as the currency symbol/code where prices are displayed.

## 5. Specific Instructions & Preferences

* **UI Improvements:** When modifying components, look for opportunities to enhance the UI/UX using DaisyUI components (modals, alerts, buttons, forms, cards, tables, etc.).
* **No Code Comments:** Avoid adding comments (`// ...` or `/* ... */`) directly within the final code blocks provided in responses, unless specifically requested for clarification during development iterations. Focus on clean, readable code.
* **Loading States:** Implement clear loading indicators (e.g., DaisyUI spinners, skeleton loaders) for asynchronous operations (data fetching, form submissions). Refer to the skeleton loader in `Header.tsx` as an example.
* **Feedback:** Provide clear user feedback for actions (e.g., success/error messages after form submission, preferably using DaisyUI alerts instead of browser `alert()`).
* **API Routes:** Ensure API routes handle requests securely, validate inputs, perform necessary authentication/authorization checks (using Clerk `auth()` and potentially `isAdmin`), interact with Prisma, and return appropriate JSON responses or error statuses.
* **Responsiveness:** Ensure layouts and components are responsive and work well on different screen sizes (mobile, tablet, desktop).

## 6. Project Structure Highlights

* `src/app/`: Contains application routes (App Router).
    * `src/app/api/`: API routes.
    * `src/app/admin/`: Routes specific to the admin panel.
* `src/components/`: Reusable React components (Client and Server).
    * `src/components/admin/`: Components specific to the admin panel.
* `src/lib/`: Utility functions, library initializations (e.g., `prisma.ts`, `authUtils.ts`, `errorUtils.ts`).
* `src/store/`: Zustand state management stores.
* `prisma/`: Prisma schema (`schema.prisma`) and migrations.

## Misc
-  When generating literal, instead of " use &quot;. 
-  use PNPM for package management.
-  Use Zod for TypeScript-first schema declaration and validation library


By following these instructions, you can provide more accurate, consistent, and helpful code suggestions and modifications for the FrizNaKlik project.
