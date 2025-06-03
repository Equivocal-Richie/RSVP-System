
'use server';
import { config } from 'dotenv';
config(); 

import * as Brevo from '@sendinblue/client';
import type { EventData, InvitationData, EmailQueuePayload } from '@/types'; // Added EmailQueuePayload

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "equivocalrichie@gmail.com";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "RSVP Now";
const OTP_EXPIRY_MINUTES = 10; 

const apiInstance = new Brevo.TransactionalEmailsApi();
let brevoApiKeyConfigured = false;

if (!process.env.BREVO_API_KEY) {
  console.warn(
    'BREVO_API_KEY is not set. Email sending will be disabled. Please set this in your .env file.'
  );
} else {
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY!;
    brevoApiKeyConfigured = true;
    console.log("Brevo API Key has been configured.");
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    'NEXT_PUBLIC_APP_URL is not set. RSVP links in emails may be incorrect. Please set this in your .env file.'
  )
}

// --- Conceptual Worker Logic Placeholder ---
// In a real production environment, you would have a separate worker service
// (e.g., a Google Cloud Function triggered by a Pub/Sub message or Cloud Task).
// This worker would be responsible for the following:
//
// 1. Dequeueing messages: Pulling `EmailQueuePayload` objects from the queue.
// 2. Fetching data: Based on `invitationId` or `eventId` in the payload, fetch
//    the full `InvitationData` and `EventData` from Firestore.
// 3. Generating AI content: Call the appropriate Genkit AI flow (e.g.,
//    `generatePersonalizedInvitation` or `generateEventFeedbackEmail`) using the
//    fetched data and `emailType` from the payload.
// 4. Sending email: Call the relevant function from this `emailService.ts`
//    (e.g., `sendInvitationEmail`, `sendGenericEmail`) with the AI-generated content
//    and recipient details.
// 5. Logging: Update the `emailLogs` collection in Firestore with the final status
//    ('sent', 'failed'), `brevoMessageId`, or error message.
// 6. Error Handling & Retries: Implement retry mechanisms for transient errors
//    (e.g., Brevo API temporary issues) and a dead-letter queue for persistent failures.
// 7. Rate Limiting: Respect Brevo's (or any email provider's) rate limits. This
//    might involve pausing processing or using specific settings in the queueing service.
//
// Example (conceptual) worker function structure:
/*
async function processEmailQueueMessage(payload: EmailQueuePayload): Promise<void> {
  try {
    // 1. Fetch data (example for 'initialInvitation')
    if (payload.emailType === 'initialInvitation' && payload.invitationId) {
      const invitation = await getInvitationById(payload.invitationId);
      if (!invitation) throw new Error(`Invitation ${payload.invitationId} not found.`);
      const event = await getEventById(invitation.eventId);
      if (!event) throw new Error(`Event ${invitation.eventId} not found.`);

      // 2. Generate AI content
      const aiContent = await generatePersonalizedInvitation({
        eventName: event.name,
        eventDescription: event.description,
        eventMood: event.mood,
        guestName: invitation.guestName,
        emailType: 'initialInvitation'
      });

      // 3. Send email
      const emailResult = await sendInvitationEmail(invitation, event, aiContent);

      // 4. Log result
      await createEmailLog({
        // ... log details ...
        status: emailResult.success ? 'sent' : 'failed',
        // ...
      });
    } else if (payload.emailType === 'eventFeedback' && payload.invitationId) {
      // ... handle feedback email similarly ...
    } // ... handle other email types ...

  } catch (error) {
    console.error("Worker error processing email payload:", payload, error);
    // Log error to DB, potentially move to dead-letter queue
    await createEmailLog({
        // ... log details ...
        status: 'failed',
        errorMessage: error.message,
        // ...
    });
  }
}
*/
// --- End of Conceptual Worker Logic Placeholder ---


interface EmailContent {
  greeting: string;
  body: string;
  closing: string;
}

export async function sendInvitationEmail(
  invitation: InvitationData,
  event: EventData,
  emailContent: EmailContent,
  subjectOverride?: string 
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!brevoApiKeyConfigured) {
    console.warn("Brevo API Key not configured. Skipping invitation email send.");
    return { success: false, error: "Brevo API Key not configured." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; 
  const rsvpLink = `${appUrl}/rsvp/${invitation.uniqueToken}`;

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email: invitation.guestEmail, name: invitation.guestName }];
  sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
  sendSmtpEmail.subject = subjectOverride || `You're Invited to ${event.name}!`;

  sendSmtpEmail.htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .header { font-size: 24px; color: hsl(var(--primary)); } 
          .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            background-color: hsl(var(--primary)); 
            color: #FFFFFF !important;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .button-text { 
             color: #FFFFFF !important;
             text-decoration: none;
          }
          .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <p class="header">${emailContent.greeting.includes("Invited") || emailContent.greeting.includes("invitation") ? "You're Invited!" : (emailContent.greeting.includes("Great News") || emailContent.greeting.includes("Confirmed") ? "RSVP Confirmed!" : "Update on Your RSVP")}</p>
          <p>${emailContent.greeting || `Hi ${invitation.guestName},`}</p>
          <p>${emailContent.body || `We're excited to share details about ${event.name}.`}</p>

          <p><strong>Event:</strong> ${event.name}</p>
          <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Time:</strong> ${event.time}</p>
          <p><strong>Location:</strong> ${event.location}</p>

          ${invitation.status !== 'waitlisted' && invitation.status !== 'declined' ? 
            `<p><a href="${rsvpLink}" class="button"><span class="button-text">Click here to RSVP / View Invitation</span></a></p>
             <p>If the button above doesn't work, please copy and paste the following link into your browser:</p>
             <p><a href="${rsvpLink}">${rsvpLink}</a></p>`
            : ''
          }

          <p>${emailContent.closing || 'We hope to see you there!'}</p>
          <div class="footer">
            <p>This email was sent via RSVP Now regarding the event: ${event.name}.</p>
            ${event.organizerEmail ? `<p>For questions, contact: ${event.organizerEmail}</p>` : ''}
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = (data.body as any)?.messageId || (Array.isArray((data.body as any)?.messageId) ? (data.body as any).messageId[0] : undefined); 
    console.log(`Invitation/Notification email sent successfully to ${invitation.guestEmail} for event ${event.id}. Brevo response: ${JSON.stringify(data.body)}`);
    return { success: true, messageId: messageId };
  } catch (error: any) {
    const errorMessage = error.response?.body?.message || JSON.stringify(error.response?.body) || error.message || "Unknown Brevo API error";
    console.error(`Error sending invitation/notification email to ${invitation.guestEmail} via Brevo: `, errorMessage, 'Full error object:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: errorMessage
    };
  }
}


export async function sendOtpEmail(
  recipientEmail: string,
  recipientName: string,
  otp: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!brevoApiKeyConfigured) {
    console.warn("Brevo API Key not configured. Skipping OTP email send.");
    return { success: false, error: "Brevo API Key not configured." };
  }

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
  sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
  sendSmtpEmail.subject = 'Your RSVP Now Verification Code';
  sendSmtpEmail.htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .otp-code { font-size: 24px; font-weight: bold; color: hsl(var(--primary)); margin: 20px 0; text-align: center; }
          .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <p>Hi ${recipientName},</p>
          <p>Your verification code for RSVP Now is:</p>
          <p class="otp-code">${otp}</p>
          <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes. Please do not share this code with anyone.</p>
          <p>If you did not request this code, you can safely ignore this email.</p>
          <div class="footer">
            <p>Thank you for using RSVP Now.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = (data.body as any)?.messageId || (Array.isArray((data.body as any)?.messageId) ? (data.body as any).messageId[0] : undefined);
    console.log(`OTP email sent successfully to ${recipientEmail}. Brevo response: ${JSON.stringify(data.body)}`);
    return { success: true, messageId: messageId };
  } catch (error: any) {
    const errorMessage = error.response?.body?.message || JSON.stringify(error.response?.body) || error.message || "Unknown Brevo API error";
    console.error(`Error sending OTP email to ${recipientEmail} via Brevo: `, errorMessage, 'Full error object:', JSON.stringify(error, null, 2));
    return {
      success: false,
      error: errorMessage
    };
  }
}

export async function sendGenericEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  htmlContent: string // This should be the fully formed HTML body of the email
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!brevoApiKeyConfigured) {
    console.warn("Brevo API Key not configured. Skipping generic email send.");
    return { success: false, error: "Brevo API Key not configured." };
  }

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName }];
  sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent; 

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    const messageId = (data.body as any)?.messageId || (Array.isArray((data.body as any)?.messageId) ? (data.body as any).messageId[0] : undefined);
    console.log(`Generic email sent successfully to ${recipientEmail}. Subject: "${subject}". Brevo response: ${JSON.stringify(data.body)}`);
    return { success: true, messageId: messageId };
  } catch (error: any) {
    const errorMessage = error.response?.body?.message || JSON.stringify(error.response?.body) || error.message || "Unknown Brevo API error";
    console.error(`Error sending generic email to ${recipientEmail} via Brevo: `, errorMessage, 'Full error object:', JSON.stringify(error, null, 2));
    return { success: false, error: errorMessage };
  }
}

    