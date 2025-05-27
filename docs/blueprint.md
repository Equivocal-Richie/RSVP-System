# **App Name**: RSVP Now

## Core Features:

- Event Details Display: Display event details clearly, including date, time, location, and description.
- RSVP Form: Provide a simple form for guests to RSVP with options for attending or declining.
- Unique Invitation Link: Generate a unique, unguessable URL for each guest to access the RSVP form.
- Confirmation Message: Provide confirmation messages after successful RSVP submission.
- Simple server data store: Simple data store on the server side (indexed by URL) recording a) has the URL been visited yet, and b) what was the response.
- Admin Dashboard: Backend admin dashboard to view stats and manage guests.
- Email Queueing Function: Create a Queueing Cloud Function to read guest documents and enqueue tasks in Cloud Tasks, passing the guest's ID and email address.
- Email Sending Function: Create an Email Sending Cloud Function triggered by the Cloud Task queue to generate personalized invitation emails with unique links and send them using SendGrid.
- Bulk Email Distribution: Efficiently send out personalized email invitations to all 500,000+ guests. Emails should include a unique link for each guest to RSVP or reserve a seat. Emails should be sent in batches or queues to prevent provider rate-limiting.
- Reservation System: Guests should be able to RSVP via a web interface using their personalized link. The system should handle high traffic during peak RSVP periods. Implement seat limits — once full, reservations should be closed or waitlisted.
- Guest Management: Maintain a database of invited guests, their RSVP status, and email logs. Support updating guest information (e.g., name correction, email change). Guests should not be able to RSVP multiple times.
- Admin Dashboard Extended: View real-time RSVP stats (confirmed, pending, declined). Export guest data (CSV format). Option to re-send invitations to unresponsive guests. Use AI as a tool to tabulate the stats so as to automatically send the invites to them

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to evoke trust and sophistication for a formal event setting.
- Background color: Light gray (#EEEEEE), a very light and desaturated variant of the primary.
- Accent color: Teal (#009688), for interactive elements to guide the user to important functions
- Clean, modern font for readability on all devices.
- Simple, single-page layout for easy navigation and quick RSVP submission.
- Subtle transitions and loading animations to enhance user experience.