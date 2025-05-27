
"use server";

import { z } from "zod";
import { createEvent, createInvitations } from '@/lib/db';
import type { EventData, GuestInput, EventMood } from '@/types';
import { generateInvitationTextFlow } from '@/ai/flows/generate-invitation-text-flow'; // Assuming flow exists

// Schema for event data coming from the client form
const CreateEventServerSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  date: z.string(), // ISO string date
  time: z.string(),
  location: z.string().min(1),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed']),
  seatLimit: z.number(), // -1 for unlimited
  organizerEmail: z.string().email().optional(),
  // eventImagePath: z.string().optional(), // To be handled if image upload is implemented
});

const CreateEventAndInvitationsSchema = z.object({
  eventData: CreateEventServerSchema,
  guests: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })).min(1),
});

export type CreateEventAndInvitationsInput = z.infer<typeof CreateEventAndInvitationsSchema>;

export async function createEventAndProcessInvitations(
  input: CreateEventAndInvitationsInput
): Promise<{ success: boolean; message: string; eventId?: string; invitationIds?: string[] }> {
  const validatedInput = CreateEventAndInvitationsSchema.safeParse(input);
  if (!validatedInput.success) {
    return { success: false, message: "Invalid input: " + validatedInput.error.flatten().fieldErrors };
  }

  const { eventData, guests } = validatedInput.data;

  try {
    // 1. Create the Event
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
    //   - Generate email content (possibly using AI)
    //   - Add to an email queue (e.g., Cloud Tasks -> SendGrid Function)
    //   - Log email attempt in EmailLogs

    console.log(`Event ${newEvent.id} created. ${createdInvitations.length} invitations created and ready for email processing.`);

    return { 
      success: true, 
      message: "Event and invitations created successfully. Email processing will begin shortly.",
      eventId: newEvent.id,
      invitationIds: createdInvitations.map(inv => inv.id) // Return Firestore document IDs
    };

  } catch (error) {
    console.error("Error in createEventAndProcessInvitations:", error);
    return { success: false, message: "An unexpected error occurred while processing the event and invitations." };
  }
}


// AI Text Generation (stub, to be connected to Genkit flow)
interface GenerateInvitationTextInput {
  eventName: string;
  eventDescription: string;
  eventMood: EventMood;
  guestName: string;
}
interface GenerateInvitationTextOutput {
  success: boolean;
  emailText?: string;
  message?: string;
}

export async function generateInvitationText(input: GenerateInvitationTextInput): Promise<GenerateInvitationTextOutput> {
  try {
    // const result = await generateInvitationTextFlow(input);
    // return { success: true, emailText: result.text };
    
    // Placeholder implementation
    const { eventName, eventMood, guestName } = input;
    let greeting = `Dear ${guestName},`;
    if (eventMood === 'formal') {
        greeting = `Esteemed ${guestName},`;
    } else if (eventMood === 'casual') {
        greeting = `Hey ${guestName}!`;
    } else if (eventMood === 'celebratory') {
        greeting = `Get ready to celebrate, ${guestName}!`;
    }


    const emailText = `${greeting}\n\nI'm thrilled to invite you to ${eventName}! It's going to be a ${eventMood} occasion, and we'd love for you to be there.\n\nMore details about the event will be provided in the formal invitation sections.`;
    return { success: true, emailText };

  } catch (error) {
    console.error("Error generating invitation text with AI:", error);
    return { success: false, message: "Failed to generate AI invitation text." };
  }
}
