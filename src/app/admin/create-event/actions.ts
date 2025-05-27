
"use server";

import { z } from "zod";
import { createEvent, createInvitations, createEmailLog, getEventById } from '@/lib/db';
import type { EventData, GuestInput, EventMood, InvitationData, EmailStatus } from '@/types';
import { generatePersonalizedInvitation, type GenerateInvitationTextInput, type GenerateInvitationTextOutput as AIGenerateOutput } from '@/ai/flows/generate-invitation-text-flow';
import { sendInvitationEmail } from '@/lib/emailService';


const CreateEventServerSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  date: z.string(), 
  time: z.string(),
  location: z.string().min(1),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed']),
  seatLimit: z.number(), 
  organizerEmail: z.string().email().optional(),
  isPublic: z.boolean().optional().default(false),
  eventImagePath: z.string().optional(), // Optional, not fully implemented for storage yet
});

const CreateEventAndInvitationsSchema = z.object({
  eventData: CreateEventServerSchema,
  guests: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })).min(1, "At least one guest is required."),
});

export type CreateEventAndInvitationsInput = z.infer<typeof CreateEventAndInvitationsSchema>;

export async function createEventAndProcessInvitations(
  input: CreateEventAndInvitationsInput
): Promise<{ success: boolean; message: string; eventId?: string; invitationIds?: string[]; emailResults?: any[] }> {
  const validatedInput = CreateEventAndInvitationsSchema.safeParse(input);
  if (!validatedInput.success) {
    console.error("Server-side validation failed:", validatedInput.error.flatten());
    return { success: false, message: "Invalid input: " + JSON.stringify(validatedInput.error.flatten().fieldErrors) };
  }

  const { eventData, guests } = validatedInput.data;
  const emailResults = [];

  try {
    const newEvent = await createEvent(eventData);
    if (!newEvent || !newEvent.id) {
      return { success: false, message: "Failed to create event in database." };
    }

    const createdInvitations = await createInvitations(newEvent.id, guests);
    if (!createdInvitations || createdInvitations.length === 0) {
      // Potentially roll back event creation or mark it as draft
      return { success: false, message: "Event created, but failed to create invitations." };
    }
    
    // Fetch the full event details again to ensure all fields are current for email generation
    const currentEventDetails = await getEventById(newEvent.id);
    if (!currentEventDetails) {
        return { success: false, message: "Failed to fetch created event details for sending emails." };
    }


    console.log(`Event ${newEvent.id} created. ${createdInvitations.length} invitations created. Processing emails...`);

    for (const invitation of createdInvitations) {
      let emailStatus: EmailStatus = 'queued';
      let brevoMessageId: string | undefined;
      let errorMessage: string | undefined;
      let sentAtValue: any = null;

      try {
        const aiInputForEmail: GenerateInvitationTextInput = {
          eventName: currentEventDetails.name,
          eventDescription: currentEventDetails.description,
          eventMood: currentEventDetails.mood,
          guestName: invitation.guestName,
        };
        const aiEmailContent = await generatePersonalizedInvitation(aiInputForEmail);

        const emailResult = await sendInvitationEmail(invitation, currentEventDetails, aiEmailContent);
        
        if (emailResult.success) {
          emailStatus = 'sent'; // Or 'delivered' if Brevo confirms, but 'sent' is safer immediate status
          brevoMessageId = emailResult.messageId;
          sentAtValue = new Date().toISOString(); // Or FieldValue.serverTimestamp() if createEmailLog handles it
          console.log(`Email sent to ${invitation.guestEmail} for event ${newEvent.id}. Message ID: ${brevoMessageId}`);
        } else {
          emailStatus = 'failed';
          errorMessage = emailResult.error || "Unknown error sending email.";
          console.error(`Failed to send email to ${invitation.guestEmail} for event ${newEvent.id}: ${errorMessage}`);
        }
      } catch (aiOrEmailError: any) {
        emailStatus = 'failed';
        errorMessage = `Error during AI content generation or email dispatch: ${aiOrEmailError.message}`;
        console.error(`Critical error processing invitation ${invitation.id}: ${errorMessage}`);
      }

      emailResults.push({ invitationId: invitation.id, email: invitation.guestEmail, status: emailStatus, messageId: brevoMessageId, error: errorMessage});
      
      await createEmailLog({
        invitationId: invitation.id,
        eventId: newEvent.id,
        emailAddress: invitation.guestEmail,
        status: emailStatus,
        brevoMessageId: brevoMessageId,
        errorMessage: errorMessage,
        sentAt: sentAtValue, // Pass null if queued/failed before actual send attempt, or timestamp if sent
      });
    }

    return { 
      success: true, 
      message: `Event and invitations created. Email processing complete. Check logs for details. Processed ${emailResults.length} emails.`,
      eventId: newEvent.id,
      invitationIds: createdInvitations.map(inv => inv.id),
      emailResults,
    };

  } catch (error) {
    console.error("Error in createEventAndProcessInvitations:", error);
    let errorMessage = "An unexpected error occurred while processing the event and invitations.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage, emailResults };
  }
}


export interface GenerateInvitationTextClientInput {
  eventName: string;
  eventDescription: string;
  eventMood: EventMood;
  guestName: string;
}
export interface GenerateInvitationTextClientOutput {
  success: boolean;
  emailText?: string; 
  greeting?: string;
  body?: string;
  closing?: string;
  message?: string;
}

export async function generateInvitationText(input: GenerateInvitationTextClientInput): Promise<GenerateInvitationTextClientOutput> {
  try {
    const aiInput: GenerateInvitationTextInput = {
      eventName: input.eventName,
      eventDescription: input.eventDescription,
      eventMood: input.eventMood,
      guestName: input.guestName,
    };

    const result: AIGenerateOutput = await generatePersonalizedInvitation(aiInput); 
    
    return { 
      success: true, 
      emailText: result.fullEmailText,
      greeting: result.greeting,
      body: result.body,
      closing: result.closing,
    };

  } catch (error) {
    console.error("Error generating invitation text with AI:", error);
    let message = "Failed to generate AI invitation text.";
    if (error instanceof Error) {
        message = error.message;
    }
    return { success: false, message };
  }
}

