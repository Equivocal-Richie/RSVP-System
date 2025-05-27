
"use server";

import { z } from "zod";
import { createEvent, createInvitations } from '@/lib/db';
import type { EventData, GuestInput, EventMood } from '@/types';
import { generateInvitationTextFlow, type GenerateInvitationTextInput, type GenerateInvitationTextOutput as AIGenerateOutput } from '@/ai/flows/generate-invitation-text-flow';

// Schema for event data coming from the client form
// This needs to align with CreateEventFormData from CreateEventWizard.tsx but is for server-side transformation
const CreateEventServerSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  date: z.string(), // Expecting ISO string date from client, will convert if Date object
  time: z.string(),
  location: z.string().min(1),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed']),
  seatLimit: z.number(), // -1 for unlimited
  organizerEmail: z.string().email().optional(),
  isPublic: z.boolean().optional().default(false),
  // eventImagePath: z.string().optional(), // To be handled if image upload is implemented
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
): Promise<{ success: boolean; message: string; eventId?: string; invitationIds?: string[] }> {
  const validatedInput = CreateEventAndInvitationsSchema.safeParse(input);
  if (!validatedInput.success) {
    // Log the detailed error for server-side debugging
    console.error("Server-side validation failed:", validatedInput.error.flatten());
    return { success: false, message: "Invalid input: " + JSON.stringify(validatedInput.error.flatten().fieldErrors) };
  }

  const { eventData, guests } = validatedInput.data;

  try {
    // 1. Create the Event
    // The eventData here is already shaped by CreateEventServerSchema
    const newEvent = await createEvent(eventData);
    if (!newEvent) {
      return { success: false, message: "Failed to create event in database." };
    }

    // 2. Create Invitations
    const createdInvitations = await createInvitations(newEvent.id, guests);
    if (!createdInvitations || createdInvitations.length === 0) {
      // Potentially roll back event creation or mark it as draft
      return { success: false, message: "Event created, but failed to create invitations." };
    }

    // 3. (Future) Trigger Email Sending Queue for each invitation
    // For each invitation in createdInvitations:
    //   - Generate email content (possibly using AI) - could be done here or in the queue worker
    //   - Add to an email queue (e.g., Cloud Tasks -> SendGrid Function)
    //   - Log email attempt in EmailLogs
    console.log(`Event ${newEvent.id} created. ${createdInvitations.length} invitations created. Triggering email processing for these invitations (currently a log message).`);
    // Example: for (const invitation of createdInvitations) { queueEmail(invitation.id, newEvent); }


    return { 
      success: true, 
      message: "Event and invitations created successfully. Email processing will begin shortly.",
      eventId: newEvent.id,
      invitationIds: createdInvitations.map(inv => inv.id)
    };

  } catch (error) {
    console.error("Error in createEventAndProcessInvitations:", error);
    let errorMessage = "An unexpected error occurred while processing the event and invitations.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { success: false, message: errorMessage };
  }
}


// AI Text Generation
// This matches the Genkit flow input/output.
// The name GenerateInvitationTextInput might conflict if not careful with imports.
// Using AIGenerateOutput to differentiate from the local interface.
export interface GenerateInvitationTextClientInput {
  eventName: string;
  eventDescription: string;
  eventMood: EventMood;
  guestName: string;
}
export interface GenerateInvitationTextClientOutput {
  success: boolean;
  emailText?: string; // This will be the fullEmailText from AI
  greeting?: string;
  body?: string;
  closing?: string;
  message?: string;
}

export async function generateInvitationText(input: GenerateInvitationTextClientInput): Promise<GenerateInvitationTextClientOutput> {
  try {
    // Prepare input for the Genkit flow
    const aiInput: GenerateInvitationTextInput = {
      eventName: input.eventName,
      eventDescription: input.eventDescription,
      eventMood: input.eventMood,
      guestName: input.guestName,
    };

    const result: AIGenerateOutput = await generateInvitationTextFlow(aiInput);
    
    // The flow now returns an object with greeting, body, closing, fullEmailText
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
