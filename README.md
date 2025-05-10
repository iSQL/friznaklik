# Haircut Appointment Service (FrizNaKlik)

A web application built with Next.js for managing haircut appointments, including user booking, admin management, and AI chat capabilities.

## Features

* **User Authentication:** Secure signup and login using Clerk.
* **Service Management:** Admin panel for creating, viewing, editing, and deleting haircut services.
* **Appointment Booking:** User interface for selecting services, choosing dates via a calendar, viewing available time slots, and requesting appointments.
* **User Dashboard:** View user's pending and approved appointments, with cancellation capability.
* **Admin Appointment Management:** Admin panel for viewing pending appointments, updating duration, and approving/rejecting them.
* **AI Chat Assistant:** Conversational interface for user inquiries and potentially booking.
* **Docker Support:** Run the application and database using Docker Compose.
* **CI/CD:** Azure Pipelines for building Docker images and deploying to a Virtual Machine.

## Technologies Used

* **Frontend:** Next.js (App Router), React, Tailwind CSS, DaisyUI v5, Zustand, react-datepicker, Lucide Icons.
* **Backend:** Next.js (Route Handlers), Prisma, PostgreSQL.
* **Authentication:** Clerk.
* **Date/Time Handling:** date-fns.
* **Webhook Verification:** svix (for Clerk webhooks).
* **Containerization:** Docker, Docker Compose.
* **CI/CD:** Azure Pipelines.

## Setup Instructions (Without Docker)

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/iSQL/friznaklik.git](https://github.com/iSQL/friznaklik.git)
    cd friznaklik
    ```

2.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the project root. Refer to the "Environment Variables" section under "Setup Instructions (With Docker)" for the required variables.

4.  **Set up the Database (PostgreSQL):**
    Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.

5.  **Run Prisma Migrations:**
    Apply the database schema:
    ```bash
    pnpm exec prisma migrate dev --name initial_setup
    ```
    Generate the Prisma client:
    ```bash
    pnpm exec prisma generate
    ```

6.  **Run the Development Server:**
    ```bash
    pnpm dev
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

    ```dotenv
    # .env file

    # Database Credentials
    POSTGRES_USER=admin
    POSTGRES_PASSWORD=your_strong_db_password # <-- Replace
    POSTGRES_DB=haircut_db
    # POSTGRES_PORT=5432 # Optional: uncomment and change if you need to map to a different host port for the DB
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public"

    # Clerk Credentials (Frontend and Backend)
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx # <-- Replace
    CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx # <-- Replace
    NEXT_PUBLIC_CLERK_DOMAIN=your-instance-name.clerk.accounts.dev # <-- Replace (e.g., pleasant-newt-12.clerk.accounts.dev)
    CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx # <-- Replace

    # App Configuration
    NEXT_PUBLIC_SITE_URL=http://localhost:3000 # Keep for local Docker dev, change for production deployments
    # APP_PORT=3000 # Optional: uncomment and change if you need to map the app to a different host port

    # Google AI
    GOOGLE_API_KEY=your_google_ai_api_key # <-- Replace

    # Node Environment (optional, defaults to development for local builds if not set)
    # NODE_ENV=development
    ```
    **IMPORTANT:** Add `.env` to your `.gitignore` file to avoid committing secrets to version control.

4.  **Build and Start Containers:**
    Open a terminal in the project root directory and run:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
    ```
    * `--build`: Builds the application image using the `Dockerfile`.
    * `-d`: Runs the containers in detached mode (in the background).

5.  **Run Database Migrations:**
    After the containers have started (wait a few seconds for the database to initialize), run the Prisma migrations:
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T app npx prisma migrate deploy
    ```
    This command executes `prisma migrate deploy` inside the running `app` container.

6.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:3000` (or the `APP_PORT` you configured).

7.  **Configure Admin User:**
    Follow the same steps as in the non-Docker setup (Step 7), but connect to the database running inside the Docker container (usually accessible on `localhost:5432` if you kept the default port mapping). See "Making a User Admin (SQL)" section below.

8.  **Stopping the Application:**
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down
    ```

## Making a User Admin (SQL)

To grant admin privileges to a user:

1.  **Connect** to your PostgreSQL database.
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
5.  Add the secret to your `.env` file as `CLERK_WEBHOOK_SECRET`.

## Deployment (Azure Pipelines)

This project includes two Azure Pipelines for CI/CD:

1.  **`azure-pipelines.yml`**: Builds the Next.js application, creates a Docker image, and pushes it to Docker Hub.
    * **Setup**:
        * Create a Docker Hub Service Connection in Azure DevOps named `SCDocker` (or update the variable in the pipeline).
        * Ensure your Azure DevOps agent pool (e.g., `Default`) has Docker installed.
        * Define pipeline variables for `dockerHubUsername`, `imageName`.
        * Pass necessary build arguments (like `NEXT_PUBLIC_SITE_URL`) to the Docker build task. These can be set as pipeline variables.

2.  **`azure-pipelines-deploy-vm.yml`**: Deploys the application to an Ubuntu VM using Docker Compose.
    * **Setup**:
        * Ensure your target VM has an Azure DevOps agent installed and configured in an agent pool (e.g., `Default`).
        * The agent user on the VM must have permissions to run Docker and Docker Compose commands and write to the project path (e.g., `/var/www/friznaklik`).
        * Create a **Variable Group** in Azure DevOps (e.g., `FrizNaKlik-Prod-Secrets`) and link it to this pipeline. Store all your secrets and runtime environment variables here (e.g., `POSTGRES_USER`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, etc.). The pipeline script maps these to an `.env` file on the agent.
        * The pipeline copies `docker-compose.yml`, `docker-compose.prod.yml`, and the generated `.env` file to the VM.
        * It then runs `docker compose pull`, `docker compose down`, and `docker compose up -d` using the `docker-compose.prod.yml` configuration.
        * Finally, it executes `npx prisma migrate deploy` inside the running app container.

**Note on Azure Pipelines Variables:**
* Secrets (like API keys, database passwords) should **always** be stored as secret variables in Azure DevOps (e.g., in a Variable Group) and not directly in the YAML files.
* The `azure-pipelines-deploy-vm.yml` script expects specific variable names to be available from the linked Variable Group. Ensure these match your setup.

## License

This project is licensed under the MIT License with Attribution. See the [LICENSE](LICENSE) file for details.

---

Built as part of a learning project.
