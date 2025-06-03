# RSVP Now - Effortless Event Management

## Project Overview

RSVP Now is a web application designed to simplify event creation, invitation management, and guest RSVP tracking. It provides event organizers with tools to set up events, manage guest lists, and analyze event performance. Guests receive unique, personalized links to RSVP, and the system supports public event listings for broader reach. The application leverages AI for tasks like email content generation and data analysis.

## System Architecture

The system is built using a modern web stack:

1.  **Frontend**: Next.js (React) for a dynamic and responsive user interface, utilizing Server Components and Server Actions for optimized performance and data handling. ShadCN UI and Tailwind CSS are used for styling.
2.  **Backend**:
    *   **Firebase**: Serves as the primary backend-as-a-service.
        *   **Firestore**: NoSQL database for storing all application data (events, invitations, user profiles, email logs, feedback).
        *   **Firebase Authentication**: Manages user (event organizer) authentication.
        *   **Firebase Storage**: Stores event-related images.
    *   **Next.js Server Actions**: Handle most backend logic, database interactions, and calls to AI services.
3.  **AI Integration**:
    *   **Genkit (Google AI)**: An AI framework used to build and manage AI flows for:
        *   Personalized email content generation (invitations, feedback requests, waitlist notifications).
        *   RSVP statistics tabulation.
        *   Event performance analysis (incorporating guest feedback).
4.  **Email System**:
    *   **Brevo (formerly Sendinblue)**: Used as the transactional email provider.
    *   **Conceptual Email Queueing**: For actions involving multiple emails (e.g., initial event invitations, bulk feedback requests), the system currently **simulates queueing**. Server actions create `emailLog` entries in Firestore with a `'queued'` status and log the intent to send an email.
    *   **Future State (Required for Scale)**: A true background worker system (e.g., Google Cloud Functions triggered by Cloud Tasks or Pub/Sub) is necessary to process these "queued" emails. This worker would handle AI content generation, Brevo API calls (with rate-limiting and retries), and update email logs. OTP emails are sent directly due to their immediate, low-volume nature.

## Data Models

Key Firestore collections:

*   **`events`**: Stores event details (name, date, location, description, mood, seat limits, public status, organizer contact) and a denormalized `_confirmedGuestsCount`.
*   **`invitations`**: Contains guest-specific information for each event, including their `uniqueToken` for RSVP, `guestName`, `guestEmail`, `status` (pending, confirmed, declining, waitlisted), `isPublicOrigin` (if RSVP'd via public link), `rsvpAt`, and `visited` status.
*   **`emailLogs`**: Tracks the status of emails (`queued`, processing, sent, failed), linking to `invitationId` and/or `eventId`, and storing the `emailType`.
*   **`userProfiles`**: Stores information about event organizers (Firebase Auth UID, email, display name).
*   **`eventFeedback`**: Collects guest feedback (rating, comments) linked to an event and invitation.

## Key Features

*   **Event Creation & Management**: Multi-step wizard for creating events with details like date, time, location, description, mood, seat limits, and an optional event image.
*   **Guest Invitation**:
    *   Manual guest list entry or CSV import.
    *   Generation of unique, unguessable RSVP links for each invited guest.
    *   Public event listing with a general RSVP link.
*   **RSVP Tracking**: Guests can RSVP as 'confirmed' or 'declined'. System handles seat limits and can place guests on a 'waitlisted' status if the event is full.
*   **Admin Dashboard**:
    *   Real-time RSVP statistics (confirmed, pending, declined, waitlisted).
    *   Guest list view with current statuses.
    *   CSV export of guest data.
    *   Option to (conceptually) queue reminders for unresponsive guests.
    *   Option to (conceptually) queue feedback request emails for confirmed attendees.
*   **Waitlist Management**: Admins can view waitlisted guests for an event and manually accept or decline them, triggering (queued) notification emails.
*   **Post-Event Feedback**: Guests can submit feedback via a unique link post-event.
*   **AI-Powered Insights**:
    *   Automated tabulation of RSVP stats and identification of guests needing reminders.
    *   Analysis of event performance, incorporating guest feedback summaries.
    *   Generation of personalized email content for various communication types.
*   **User Authentication**: Secure sign-up and sign-in for event organizers.

## Technology Choices & Trade-offs

*   **Next.js (App Router, Server Components, Server Actions)**:
    *   *Pros*: Modern React framework, optimized rendering, integrated backend capabilities, good developer experience.
    *   *Cons*: Learning curve, build times can increase with project size.
*   **Firebase (Firestore, Auth, Storage)**:
    *   *Pros*: Fully managed, scalable, real-time capabilities (Firestore), easy authentication (Auth), simple file storage (Storage), generous free tier for development.
    *   *Cons*: Firestore queries are less flexible than SQL, vendor lock-in, specific indexing requirements for complex queries.
*   **Genkit (Google AI)**:
    *   *Pros*: Simplifies integration of AI models (especially Google's Gemini), structured flows, schema validation for inputs/outputs.
    *   *Cons*: Primarily focused on Google AI models (though extensible), still a relatively new framework.
*   **ShadCN UI & Tailwind CSS**:
    *   *Pros*: Beautiful, accessible, copy-pasteable components, utility-first styling for rapid UI development.
    *   *Cons*: Can lead to verbose markup if not componentized well, styling is highly dependent on class composition.
*   **Brevo (Email Sending)**:
    *   *Pros*: Reliable email delivery, API for transactional emails.
    *   *Cons*: Free tier has significant daily sending limits (300/day), requiring careful management or paid plans for high volume.

## Scalability

*   **Current State**:
    *   **Frontend/Backend Logic**: Next.js applications can be deployed to scalable infrastructure (e.g., Firebase App Hosting, Vercel).
    *   **Database**: Firestore is designed for massive scale, handling large numbers of events, guests, and users, provided data is modeled and indexed correctly.
    *   **User-Facing Actions**: Event creation, RSVP submissions, and admin dashboard interactions are generally fast because email sending is now simulated as a "queueing" operation, offloading the potentially slow process.
*   **Critical Future Enhancements for True Scalability (especially for 500,000+ guests/event)**:
    1.  **Implement a Real Background Email Queueing System**:
        *   **Why**: Directly sending thousands of emails in a single server action will lead to timeouts, failures, and provider rate-limiting.
        *   **How**: Use a dedicated message queue (e.g., Google Cloud Tasks, Google Cloud Pub/Sub) to hold email tasks. Server actions would publish messages to this queue.
        *   **Worker Functions**: Implement scalable, serverless functions (e.g., Google Cloud Functions) triggered by the queue. These workers would:
            *   Process one email task at a time.
            *   Fetch necessary data (event, invitation details).
            *   Call Genkit for AI email content generation.
            *   Call the Brevo API (or other email provider) to send the email.
            *   Implement robust rate-limiting to respect provider limits (e.g., using worker concurrency settings, or tools like a token bucket).
            *   Handle retries for transient errors (e.g., API timeouts) with exponential backoff.
            *   Move persistently failing email tasks to a dead-letter queue (DLQ) for investigation.
            *   Update `emailLogs` in Firestore with the final status (sent, failed, bounced, etc.).
    2.  **AI Content Generation at Scale**:
        *   Generating unique AI content for 500,000+ emails might be slow and/or costly.
        *   Consider offering tiered personalization (e.g., simple template substitution for very large batches, full AI for smaller ones or specific segments).
        *   Optimize AI prompts and potentially use faster/cheaper models for bulk tasks.
    3.  **Database Write Throughput (Extreme Cases)**:
        *   For extremely high-velocity RSVP scenarios (e.g., all 500,000 guests RSVPing within a very short window), updating a single `_confirmedGuestsCount` document in Firestore might hit per-document write limits (approx 1 write/sec sustained).
        *   Strategies like sharded counters or batched updates can mitigate this if it becomes an issue, though Firestore's transactional increments are quite efficient for many use cases.

## Security Considerations

*   **Invitation Links**: Unique RSVP links are generated using `crypto.randomUUID()`, making them unguessable.
*   **Authentication**: Firebase Authentication handles secure user sign-up and sign-in for event organizers.
*   **Data Validation**: Zod is used for schema validation on both client-side forms and server actions to prevent invalid data.
*   **Firestore Security Rules**: (Not explicitly configured in this interaction, but crucial for production) Security rules must be set up to ensure users can only access/modify their own data (e.g., an organizer can only manage their own events and associated invitations).
*   **Environment Variables**: Sensitive keys (Firebase service account, Brevo API key) are managed via environment variables and should not be hardcoded.

## Error Handling & Resilience

*   **Current State**:
    *   Server actions return success/error messages to the client, displayed via toasts.
    *   Firestore transactions are used for critical atomic operations (e.g., updating RSVP status and event guest count).
    *   Email sending simulation logs to `emailLogs` with status `'queued'`.
*   **Future (with Real Queueing System)**:
    *   The background worker system would be responsible for most email-related error handling: retries for transient API errors, dead-letter queues for persistent failures.
    *   Comprehensive logging and monitoring of the queue and worker functions would be essential.

## Testability

The system is designed with modularity in mind:

*   **Server Actions**: Can be tested independently.
*   **Database Functions (`db.ts`)**: Encapsulate Firestore interactions and can be unit-tested (potentially with a Firestore emulator).
*   **AI Flows (Genkit)**: Can be tested and run locally.
*   **UI Components**: React components can be tested using tools like Jest and React Testing Library.
*   **Future Worker Functions**: Would be independently testable units.

## Getting Started

1.  **Prerequisites**: Node.js (latest LTS), npm/yarn.
2.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd rsvp-now
    ```
3.  **Install Dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```
4.  **Set Up Environment Variables**:
    *   Create a `.env.local` file in the root directory.
    *   Populate it with your Firebase project configuration (for both client-side and admin SDK) and your Brevo API key. Refer to `.env.example` (if provided) or the Firebase/Brevo documentation for required keys.
        *   `NEXT_PUBLIC_FIREBASE_API_KEY="..."`
        *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."`
        *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."`
        *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."`
        *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."`
        *   `NEXT_PUBLIC_FIREBASE_APP_ID="..."`
        *   `FIREBASE_PROJECT_ID="..."` (for Admin SDK)
        *   `FIREBASE_CLIENT_EMAIL="..."` (for Admin SDK service account)
        *   `FIREBASE_PRIVATE_KEY="..."` (for Admin SDK service account - ensure newlines are handled correctly, e.g., by base64 encoding/decoding or direct copy-paste with literal `\n`)
        *   `BREVO_API_KEY="..."`
        *   `BREVO_SENDER_EMAIL="your-verified-sender@example.com"`
        *   `BREVO_SENDER_NAME="Your App Name"`
        *   `NEXT_PUBLIC_APP_URL="http://localhost:9002"` (or your deployment URL)
5.  **Set Up Firebase**:
    *   Ensure you have a Firebase project created.
    *   Enable Firestore, Firebase Authentication (Email/Password, Google providers), and Firebase Storage.
    *   Download your Firebase Admin SDK service account key JSON and either set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to its path or use the individual `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` variables.
    *   Configure Firestore security rules for production.
    *   Create necessary composite indexes in Firestore as indicated by server logs or comments in `db.ts`.
6.  **Run the Development Server**:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application should be available at `http://localhost:9002` (or your configured port).
7.  **Run Genkit (for AI flows, in a separate terminal)**:
    ```bash
    npm run genkit:dev
    # or
    yarn genkit:dev
    ```

## Developer Details

*   **Author**: Firebase Studio AI Assistant & [Your Name/Handle Here]
*   **Contact**: [Your Email/Link Here]

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.
(You would typically add a `LICENSE` file with the MIT license text to the repository root).
```