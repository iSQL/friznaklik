# Haircut Appointment Service

A web application built with Next.js for managing haircut appointments, including user booking, admin management, and AI chat capabilities.

## Features

* **User Authentication:** Secure signup and login using Clerk.

* **Service Management:** Admin panel for creating, viewing, editing, and deleting haircut services.

* **Appointment Booking:** User interface for selecting services, choosing dates via a calendar, viewing available time slots, and requesting appointments.

* **User Dashboard:** View user's pending and approved appointments, with cancellation capability.

* **Admin Appointment Management:** Admin panel for viewing pending appointments and approving/rejecting them.

* **AI Chat Assistant:** Conversational interface for user inquiries and potentially booking.

* **Email Notifications (Upcoming):** Inform users about appointment status changes.

## Technologies Used

* **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, react-datepicker.

* **Backend:** Next.js (Route Handlers), Prisma, PostgreSQL.

* **Authentication:** Clerk.

* **Date/Time Handling:** date-fns.

* **Webhook Verification:** svix (for Clerk webhooks).

## Setup Instructions

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/iSQL/friznaklik.git
    cd friznaklik

    ```

2.  **Install Dependencies:**

    ```bash
    pnpm install # Or npm install or yarn install

    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the project root and add the following variables. Obtain your keys from the Clerk Dashboard and configure your database connection string.

    ```
    DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="YOUR_CLERK_FRONTEND_API_KEY"
    CLERK_SECRET_KEY="YOUR_CLERK_BACKEND_API_KEY"
    NEXT_PUBLIC_CLERK_DOMAIN="your_clerk_domain" # e.g., localhost or your Clerk domain
    NEXT_PUBLIC_SITE_URL="http://localhost:3000" # Or your local development URL
    # CLERK_WEBHOOK_SECRET="your_clerk_webhook_secret" # Needed for webhook implementation

    ```

4.  **Set up the Database (PostgreSQL) with Prisma:**
    Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists. Then run Prisma migrations to create the necessary tables:

    ```bash
    npx prisma migrate dev --name initial_setup

    ```

    If you change your Prisma schema later, run `npx prisma migrate dev` again.

    Generate the Prisma client:

    ```bash
    npx prisma generate

    ```

5.  **Run the Development Server:**

    ```bash
    pnpm dev # Or npm run dev or yarn dev

    ```

    The application should now be running at `http://localhost:3000`.

6.  **Configure Admin User:**
    To access the admin panel (`/admin`), you need a user with the 'admin' role in your database.

    * Sign up or log in via the application (`/sign-up` or `/sign-in`).

    * Open Prisma Studio: `npx prisma studio`

    * Find your user record in the `User` table (using your Clerk ID).

    * Manually change the `role` field to `'admin'`.

7.  **Configure Clerk Webhooks (Recommended):**
    For automatic user creation in your database upon signup, configure a webhook in your Clerk Dashboard pointing to `[your-site-url]/api/webhooks/clerk` and subscribe to `user.created` events. Add the webhook secret to your `.env` file.

## License

This project is licensed under the MIT License with Attribution. See the [LICENSE](LICENSE) file for details.

---

Built as part of a learning project.