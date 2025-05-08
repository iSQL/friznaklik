# Haircut Appointment Service (FrizNaKlik)

A web application built with Next.js for managing haircut appointments, including user booking, admin management, and AI chat capabilities.

## Features

* **User Authentication:** Secure signup and login using Clerk.
* **Service Management:** Admin panel for creating, viewing, editing, and deleting haircut services.
* **Appointment Booking:** User interface for selecting services, choosing dates via a calendar, viewing available time slots, and requesting appointments.
* **User Dashboard:** View user's pending and approved appointments, with cancellation capability.
* **Admin Appointment Management:** Admin panel for viewing pending appointments and approving/rejecting them.
* **AI Chat Assistant:** Conversational interface for user inquiries and potentially booking.
* **Docker Support:** Run the application and database using Docker Compose.

## Technologies Used

* **Frontend:** Next.js (App Router), React, Tailwind CSS, Zustand, react-datepicker.
* **Backend:** Next.js (Route Handlers), Prisma, PostgreSQL.
* **Authentication:** Clerk.
* **Date/Time Handling:** date-fns.
* **Webhook Verification:** svix (for Clerk webhooks).
* **Containerization:** Docker, Docker Compose.

## Setup Instructions (Without Docker)

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/iSQL/friznaklik.git](https://github.com/iSQL/friznaklik.git)
    cd friznaklik
    ```

2.  **Install Dependencies:**
    ```bash
    pnpm install # Or npm install or yarn install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the project root and add the necessary variables (see `.env.example` or the Docker setup section below for required variables). You'll need keys from Clerk, Google AI, and your database connection string.

4.  **Set up the Database (PostgreSQL):**
    Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.

5.  **Run Prisma Migrations:**
    Apply the database schema:
    ```bash
    pnpm exec prisma migrate dev --name initial_setup # For initial setup or development changes
    # OR for applying existing migrations in production-like environments:
    # pnpm exec prisma migrate deploy
    ```
    Generate the Prisma client:
    ```bash
    pnpm exec prisma generate
    ```

6.  **Run the Development Server:**
    ```bash
    pnpm dev # Or npm run dev or yarn dev
    ```
    The application should now be running (usually at `http://localhost:3000`).

7.  **Configure Admin User (Manual):**
    * Sign up or log in via the application (`/sign-up` or `/sign-in`).
    * Connect to your database.
    * Find your user record in the `User` table.
    * Manually change the `role` field to `'admin'`. See "Making a User Admin (SQL)" section below.

## Setup Instructions (With Docker)

This is the recommended way to run the application locally, as it manages both the app and the database.

1.  **Prerequisites:**
    * Install [Docker](https://docs.docker.com/get-docker/)
    * Install [Docker Compose](https://docs.docker.com/compose/install/) (often included with Docker Desktop).

2.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/iSQL/friznaklik.git](https://github.com/iSQL/friznaklik.git)
    cd friznaklik
    ```

3.  **Create Environment File (`.env`):**
    Create a file named `.env` in the project root. Copy the following content into it and **replace the placeholder values with your actual credentials and keys.**

    ```.env
    # .env file

    # Database Credentials
    POSTGRES_USER=admin
    POSTGRES_PASSWORD=xxx # <-- Replace with a strong, secure password
    POSTGRES_DB=haircut_db
    # POSTGRES_PORT=5432 # Optional: uncomment and change if you need to map to a different host port

    # Clerk Credentials
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=xxx# <-- Replace with your actual Clerk Publishable Key
    CLERK_SECRET_KEY=xxx# <-- Replace with your actual Clerk Secret Key
    NEXT_PUBLIC_CLERK_DOMAIN=xxx.accounts.dev # <-- Replace with your actual Clerk Domain

    # App Configuration
    PUBLIC_SITE_URL=http://localhost:3000 # Keep for local Docker dev, change for production
    # APP_PORT=3000 # Optional: uncomment and change if you need to map to a different host port

    # Google AI
    GOOGLE_API_KEY=xxx # <-- Replace with your actual Google AI API Key

    # Clerk Webhook
    CLERK_WEBHOOK_SECRET=xxx # <-- Replace with your actual Clerk Webhook Secret

    ```
    **IMPORTANT:** Add `.env` to your `.gitignore` file to avoid committing secrets to version control.

4.  **Build and Start Containers:**
    Open a terminal in the project root directory and run:
    ```bash
    docker-compose up --build -d
    ```
    * `--build`: Builds the application image using the `Dockerfile`.
    * `-d`: Runs the containers in detached mode (in the background).

5.  **Run Database Migrations:**
    After the containers have started (wait a few seconds for the database to initialize), run the Prisma migrations:
    ```bash
    docker-compose exec app /app/node_modules/.bin/prisma migrate deploy
    ```
    This command executes `prisma migrate deploy` inside the running `app` container. You only need to run this the first time or when you have new migrations to apply.

6.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:3000` (or the `APP_PORT` you configured).

7.  **Configure Admin User:**
    Follow the same steps as in the non-Docker setup (Step 7), but connect to the database running inside the Docker container (usually accessible on `localhost:5432` if you kept the default port mapping). See "Making a User Admin (SQL)" section below.

8.  **Stopping the Application:**
    ```bash
    docker-compose down
    ```

## Making a User Admin (SQL)

To grant admin privileges to a user:

1.  **Connect** to your PostgreSQL database (running either locally or in Docker).
2.  **Identify** the user by their Clerk ID (`clerkId`) or `email`.
3.  **Run** the appropriate SQL command, replacing the placeholder:

    * **Using Clerk ID:**
        ```sql
        UPDATE "User" SET "role" = 'admin' WHERE "clerkId" = 'REPLACE_WITH_USER_CLERK_ID';
        ```
    * **Using Email:**
        ```sql
        UPDATE "User" SET "role" = 'admin' WHERE "email" = 'REPLACE_WITH_USER_EMAIL';
        ```

## Clerk Webhooks (Recommended)

For automatic user creation in your database upon signup via Clerk:

1.  Go to your Clerk Dashboard -> Webhooks.
2.  Create a new endpoint pointing to:
    * Local Docker: `http://<your-local-ip-or-tunnel-url>:3000/api/webhooks/clerk` (Clerk needs to reach your machine, consider using a tunneling service like ngrok for local testing).
    * Production: `https://<your-production-url>/api/webhooks/clerk`
3.  Subscribe to the `user.created` event (and potentially `user.deleted`, `user.updated`).
4.  Copy the Webhook Signing Secret from Clerk.
5.  Add the secret to your `.env` file as `CLERK_WEBHOOK_SECRET`. Ensure this variable is passed to the running container in `docker-compose.yml`.

## License

This project is licensed under the MIT License with Attribution. See the [LICENSE](LICENSE) file for details.

---

Built as part of a learning project.
