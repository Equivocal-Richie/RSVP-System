
'use server';
import { config } from 'dotenv';
config(); // Ensure .env variables are loaded

import * as Brevo from '@sendinblue/client';
import type { EventData, InvitationData } from '@/types';

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "equivocalrichie@gmail.com"; 
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "RSVP Now"; 
const OTP_EXPIRY_MINUTES = 10; // Consistent with auth/actions.ts

const apiInstance = new Brevo.TransactionalEmailsApi();

if (!process.env.BREVO_API_KEY) {
  console.warn(
    'BREVO_API_KEY is not set. Email sending will be disabled. Please set this in your .env file.'
  );
} else {
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY!;
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    'NEXT_PUBLIC_APP_URL is not set. RSVP links in emails may be incorrect. Please set this in your .env file.'
  )
}


interface EmailContent {
  greeting: string;
  body: string;
  closing: string;
}

export async function sendInvitationEmail(
  invitation: InvitationData,
  event: EventData,
  emailContent: EmailContent
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.BREVO_API_KEY) {
    console.warn("Brevo API Key not configured. Skipping invitation email send.");
    return { success: false, error: "Brevo API Key not configured." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'; // Fallback for safety
  const rsvpLink = `${appUrl}/rsvp/${invitation.uniqueToken}`;

  const sendSmtpEmail = new Brevo.SendSmtpEmail();
  sendSmtpEmail.to = [{ email: invitation.guestEmail, name: invitation.guestName }];
  sendSmtpEmail.sender = { email: SENDER_EMAIL, name: SENDER_NAME };
  sendSmtpEmail.subject = `You're Invited to ${event.name}!`;
  
  sendSmtpEmail.htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
          .header { font-size: 24px; color: hsl(var(--primary)); } /* Use HSL variable */
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            margin: 20px 0; 
            background-color: hsl(var(--primary)); /* Use HSL variable */
            color: #FFFFFF !important; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold;
          }
          .button-text {
             color: #FFFFFF !important; /* Ensure white text for the link itself */
             text-decoration: none;
          }
          .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
        </style>
      </head>
      <body>
        <div class="container">
          <p class="header">You're Invited!</p>
          <p>${emailContent.greeting || `Hi ${invitation.guestName},`}</p>
          <p>${emailContent.body || `We're excited to invite you to ${event.name}.`}</p>
          <p><strong>Event:</strong> ${event.name}</p>
          <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><strong>Time:</strong> ${event.time}</p>
          <p><strong>Location:</strong> ${event.location}</p>
          <p><a href="${rsvpLink}" class="button"><span class="button-text">Click here to RSVP</span></a></p>
          <p>If the button above doesn't work, please copy and paste the following link into your browser:</p>
          <p><a href="${rsvpLink}">${rsvpLink}</a></p>
          <p>${emailContent.closing || 'We hope to see you there!'}</p>
          <div class="footer">
            <p>This invitation was sent via RSVP Now.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Brevo API called successfully for invitation email. Returned data: ', JSON.stringify(data));
    return { success: true, messageId: data.body.messageId };
  } catch (error: any) {
    console.error('Error sending invitation email via Brevo: ', error.response ? error.response.body : error.message);
    return { 
      success: false, 
      error: error.response ? error.response.body?.message || JSON.stringify(error.response.body) : error.message 
    };
  }
}


export async function sendOtpEmail(
  recipientEmail: string,
  recipientName: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.BREVO_API_KEY) {
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
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`OTP email sent successfully to ${recipientEmail}.`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error sending OTP email to ${recipientEmail} via Brevo: `, error.response ? error.response.body : error.message);
    return { 
      success: false, 
      error: error.response ? error.response.body?.message || JSON.stringify(error.response.body) : error.message 
    };
  }
}


    
