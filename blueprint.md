# RSVP Now - System Architecture Blueprint

This document outlines the technical architecture of the RSVP Now application.

## 1. High-Level Architectural Diagram (Conceptual)

```
+-------------------------+      +-------------------------+      +-----------------------+
|     User (Browser)      |<---->|   Next.js Frontend      |<---->|  Next.js Backend      |
|  (Guest / Admin UI)     |      | (React, ShadCN, Tailwind) |      |  (Server Actions)     |
+-------------------------+      +-------------------------+      +-----------------------+
                                             ^    ^                          |
                                             |    |                          |
                                             |    +--------------------------+
                                             |                               |
                                             v                               v
+------------------------------------------------------------------------------------------+
|                                     Firebase Platform                                    |
|                                                                                          |
|  +---------------------+  +-------------------------+  +-------------------------------+ |
|  | Firebase Auth       |  |   Firestore (Database)  |  | Firebase Storage              | |
|  | (User Profiles)     |  | (Events, Invitations,   |  | (Event Images)                | |
|  |                     |  |  Email Logs, Feedback)  |  |                               | |
|  +---------------------+  +-------------------------+  +-------------------------------+ |
+------------------------------------------------------------------------------------------+
         ^                                      ^                         ^
         |                                      |                         |
         +--------------------------------------|-------------------------+
                                                |
                                                v
                                     +-----------------------+
                                     |   Genkit (AI Flows)   |
                                     | (Email Personalization|
                                     |  Stats, Analysis)     |
                                     +-----------------------+
                                                ^
                                                | (Used by Future Worker)
                                                v
+------------------------------------------------------------------------------------------+
|                      Conceptual Email Processing (Future Implementation)                 |
|                                                                                          |
|  +-------------------------+      +-----------------------+      +---------------------+ |
|  | Conceptual Email Queue  |<---->|  Background Worker    |<---->|  Brevo (Email API)  | |
|  | (e.g., Cloud Tasks /    |      | (e.g., Cloud Function)|      |                     | |
|  |  Pub/Sub)               |      | - Fetches data        |      |                     | |
|  |                         |      | - Calls Genkit        |      |                     | |
|  |                         |      | - Calls Brevo         |      |                     | |
|  |                         |      | - Updates Email Logs  |      |                     | |
|  +-------------------------+      +-----------------------+      +---------------------+ |
+------------------------------------------------------------------------------------------+
```

## 2. Component Breakdown

### 2.1. Next.js Frontend (Client: Browser)
*   **Framework**: Next.js with React (App Router)
*   **UI Components**: ShadCN UI
*   **Styling**: Tailwind CSS
*   **Key UI Sections**:
    *   **Public Pages**: Homepage, RSVP Form (unique link & public), Feedback Form.
    *   **Admin Pages**: Login/Auth, Dashboard, Create Event Wizard, Analytics, Guest Management, Waitlist Management.
*   **State Management**: React Context (e.g., `AuthContext`), `useState`, `useReducer`, `useActionState`.
*   **Data Fetching/Mutation**: Primarily through Next.js Server Actions.

### 2.2. Next.js Backend (Server Actions)
*   Hosted within the Next.js application.
*   Handles business logic, data validation (Zod), and interactions with Firebase services and Genkit.
*   **Key Actions**:
    *   `auth/actions.ts`: User sign-up (OTP flow), sign-in, sign-out.
    *   `admin/create-event/actions.ts`: Event creation, (simulated) queuing of initial invitations.
    *   `rsvp/[token]/actions.ts` & `rsvp/public/[token]/actions.ts`: Processing guest RSVPs.
    *   `admin/actions.ts`: Admin dashboard data fetching, triggering AI tabulation, CSV export, (simulated) queuing of reminder/feedback emails.
    *   `admin/analytics/actions.ts`: Fetching analytics data, triggering AI event analysis, preparing feedback summaries.
    *   `admin/guests/actions.ts`: Fetching and exporting all past guest data.
    *   `admin/waitlist/actions.ts`: Fetching waitlist data, processing accept/decline actions including (simulated) queuing of notification emails.
    *   `feedback/actions.ts`: Saving guest feedback, (simulated) queuing of individual feedback request emails.

### 2.3. Firebase Services
*   **Firestore (NoSQL Database)**:
    *   `events`: Core event data, including denormalized `_confirmedGuestsCount`.
    *   `invitations`: Detailed records for each invited guest, including `uniqueToken`, RSVP `status`, `isPublicOrigin`.
    *   `emailLogs`: Audit trail for email sending attempts (initially `'queued'`, to be updated by future worker).
    *   `userProfiles`: Stores organizer/admin user data.
    *   `eventFeedback`: Stores feedback submitted by guests.
    *   *Indexes*: Composite indexes are crucial for efficient querying (see `db.ts` comments and server logs for specific needs).
*   **Firebase Authentication**:
    *   Manages organizer sign-up (with email OTP verification) and sign-in (email/password, Google).
*   **Firebase Storage**:
    *   Stores event images uploaded by organizers.

### 2.4. Genkit (AI Integration)
*   Framework for defining and running AI-powered flows.
*   Uses Google AI models (e.g., Gemini) by default.
*   **Key AI Flows**:
    *   `generate-invitation-text-flow.ts`: Generates personalized email content for initial invitations, public RSVP confirmations, waitlist updates.
    *   `tabulate-rsvps.ts`: Analyzes guest lists to summarize RSVP stats and identify guests needing reminders.
    *   `analyze-event-performance-flow.ts`: Provides insights and suggestions based on event data and (optionally) guest feedback summaries.
    *   `generate-feedback-email-flow.ts`: Crafts email content for requesting post-event feedback.

### 2.5. Email Service (Brevo Integration)
*   **Provider**: Brevo (formerly Sendinblue).
*   **Current Interaction**: `emailService.ts` contains functions to send emails via Brevo API (`sendInvitationEmail`, `sendOtpEmail`, `sendGenericEmail`).
*   **Future State**: These functions would be called by the background worker, not directly by most server actions (except OTPs).
*   **Rate Limits**: Brevo's free tier (300 emails/day) is a significant constraint for bulk operations. Paid plans and careful rate-limiting by the worker are necessary for scale.

### 2.6. Conceptual Email Queue & Worker (Future State for Scalability)
*   **Purpose**: To handle bulk email sending reliably and efficiently, preventing timeouts and respecting provider rate limits.
*   **Queue**: A message queue service (e.g., Google Cloud Tasks, Google Cloud Pub/Sub). Server actions would publish `EmailQueuePayload` messages here.
*   **Worker**: A scalable, serverless function (e.g., Google Cloud Function) triggered by new queue messages.
    *   **Responsibilities**:
        1.  Dequeue `EmailQueuePayload`.
        2.  Fetch relevant data from Firestore (Event, Invitation).
        3.  Invoke Genkit AI flow for email content.
        4.  Call `emailService.ts` function to send via Brevo.
        5.  Implement retry logic for transient errors.
        6.  Implement rate-limiting mechanisms.
        7.  Log to a dead-letter queue (DLQ) for persistent failures.
        8.  Update `emailLogs` in Firestore with final status (`sent`, `failed`, `bounced`).

## 3. Key Data Flows

### 3.1. Event Creation & Initial Invitation (Simulated Queueing)
1.  **Admin UI**: Submits "Create Event" form.
2.  **Server Action (`createEventAndProcessInvitations`)**:
    *   Validates data.
    *   Creates `event` document in Firestore.
    *   Creates `invitation` documents for each guest in Firestore.
    *   For each invitation:
        *   Creates an `EmailQueuePayload` (`emailType: 'initialInvitation'`).
        *   **Simulates Queueing**: Logs payload to console, creates `emailLog` with `status: 'queued'`.
3.  **(Future Worker)**:
    *   Picks up `EmailQueuePayload` from actual queue.
    *   Generates email content via Genkit.
    *   Sends email via Brevo.
    *   Updates `emailLog` to `'sent'` or `'failed'`.

### 3.2. Guest RSVP (Unique Link)
1.  **Guest**: Clicks unique RSVP link (`/rsvp/[token]`).
2.  **Next.js Page**: Fetches `invitation` and `event` data using token.
3.  **RSVP Form UI**: Guest submits RSVP.
4.  **Server Action (`submitRsvp`)**:
    *   Validates data.
    *   Fetches `invitation` by token.
    *   Atomically (transaction) updates `invitation.status` and `event._confirmedGuestsCount` in Firestore.
    *   Handles seat limits (may set status to `'waitlisted'`).
5.  **UI**: Displays confirmation.

### 3.3. Public Guest RSVP
1.  **Guest**: Accesses public event page and clicks "Reserve Seat" (`/rsvp/public/[eventId]`).
2.  **RSVP Form UI**: Guest enters details and submits.
3.  **Server Action (`submitPublicRsvp`)**:
    *   Validates data.
    *   Checks for existing *active* public RSVP from this email for this event. If found, informs user.
    *   If not, atomically (transaction):
        *   Creates a new `invitation` document (`isPublicOrigin: true`, new `uniqueToken`).
        *   Determines `status` ('confirmed' or 'waitlisted') based on event capacity.
        *   If 'confirmed', increments `event._confirmedGuestsCount`.
    *   Creates `EmailQueuePayload` for confirmation/waitlist email.
    *   **Simulates Queueing**: Logs payload, creates `emailLog` with `status: 'queued'`.
4.  **UI**: Displays confirmation/waitlist message.
5.  **(Future Worker)**: Processes queued email.

### 3.4. Admin Dashboard - View Stats
1.  **Admin UI**: Navigates to Dashboard.
2.  **Client Component (`DashboardClient`)**: Fetches data via `fetchAdminDashboardData`.
3.  **Server Action (`fetchAdminDashboardData`)**:
    *   Gets most recent `eventId` for user.
    *   Fetches `event` details and `invitations`.
    *   Calls `getEventStats` (which queries Firestore for various RSVP status counts).
4.  **UI**: Displays stats and guest list.

### 3.5. AI Event Analysis
1.  **Admin UI (Analytics Page)**: Clicks "Analyze" for an event.
2.  **Client Component (`AnalyticsClient`)**:
    *   Calls `fetchAndPrepareFeedbackSummary` server action.
3.  **Server Action (`fetchAndPrepareFeedbackSummary`)**:
    *   Fetches feedback for the event from Firestore.
    *   Generates a simple text summary of the feedback.
4.  **Client Component**:
    *   Calls `triggerEventAiAnalysis` server action with event data and feedback summary.
5.  **Server Action (`triggerEventAiAnalysis`)**:
    *   Calls `analyzeEventPerformance` Genkit flow.
6.  **Genkit Flow (`analyzeEventPerformanceFlow`)**:
    *   Uses LLM to analyze data and generate insights/suggestions.
7.  **UI**: Displays AI analysis results.

## 4. Database Schema Snippets (Key Collections & Fields)

*   **`events`**
    *   `id: string` (doc ID)
    *   `creatorId: string`
    *   `name: string`
    *   `date: timestamp`
    *   `seatLimit: number`
    *   `_confirmedGuestsCount: number` (denormalized counter)
    *   `isPublic: boolean`
    *   `publicRsvpLink: string` (if public, usually eventId)
    *   `createdAt: timestamp`, `updatedAt: timestamp`

*   **`invitations`**
    *   `id: string` (doc ID)
    *   `uniqueToken: string` (indexed)
    *   `eventId: string` (indexed)
    *   `guestEmail: string` (lowercase, indexed for public RSVP check)
    *   `status: string` ('pending', 'confirmed', 'declining', 'waitlisted') (indexed)
    *   `isPublicOrigin: boolean` (indexed for public RSVP check)
    *   `rsvpAt: timestamp`
    *   `visited: boolean`
    *   `createdAt: timestamp`, `updatedAt: timestamp`

*   **`emailLogs`**
    *   `id: string` (doc ID)
    *   `invitationId: string` (indexed)
    *   `eventId: string`
    *   `emailType: string`
    *   `status: string` ('queued', 'sent', 'failed', etc.)
    *   `sentAt: timestamp` (or null)
    *   `brevoMessageId: string` (optional)
    *   `createdAt: timestamp`

*   **`eventFeedback`**
    *   `id: string` (doc ID)
    *   `eventId: string` (indexed)
    *   `invitationId: string`
    *   `rating: number`
    *   `likedMost: string`
    *   `submittedAt: timestamp` (indexed)
```