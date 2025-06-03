
"use server";

import { z } from "zod";
import { createEvent, createInvitations, createEmailLog, getEventById, updateEventPublicStatus } from '@/lib/db';
import type { EventData, GuestInput, EventMood, InvitationData, EmailStatus, EmailQueuePayload } from '@/types';
// AI generation for email content is now deferred to the (future) worker.
// import { generatePersonalizedInvitation, type GenerateInvitationTextInput, type GenerateInvitationTextOutput as AIGenerateOutput } from '@/ai/flows/generate-invitation-text-flow';
// Direct email sending is removed from this action.
// import { sendInvitationEmail } from '@/lib/emailService';
import { uploadEventImage } from '@/lib/storage';


const CreateEventServerSchema = z.object({
  creatorId: z.string().min(1, "Creator ID is required."),
  name: z.string().min(1, "Event name is required."),
  description: z.string().min(1, "Event description is required."),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format." }), 
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)."),
  location: z.string().min(1, "Location is required."),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed'], { message: "Invalid event mood." }),
  seatLimit: z.preprocess(val => parseInt(String(val), 10), z.number()), 
  organizerEmail: z.string().email("Invalid organizer email.").optional().or(z.literal("")),
});

const GuestsSchema = z.array(z.object({
  name: z.string().min(1, "Guest name is required."),
  email: z.string().email("Invalid guest email."),
})).min(1, "At least one guest is required.");


export async function createEventAndProcessInvitations(
  formData: FormData
): Promise<{ success: boolean; message: string; eventId?: string; invitationIds?: string[]; queuedEmailCount?: number }> {
  
  const eventDetailsRaw = {
    creatorId: formData.get("creatorId"),
    name: formData.get("name"),
    description: formData.get("description"),
    date: formData.get("date"),
    time: formData.get("time"),
    location: formData.get("location"),
    mood: formData.get("mood"),
    seatLimit: formData.get("seatLimit"),
    organizerEmail: formData.get("organizerEmail") || "", 
  };

  const validatedEventDetails = CreateEventServerSchema.safeParse(eventDetailsRaw);
  if (!validatedEventDetails.success) {
    console.error("Server-side event details validation failed:", validatedEventDetails.error.flatten());
    return { success: false, message: "Invalid event data: " + JSON.stringify(validatedEventDetails.error.flatten().fieldErrors) };
  }
  const eventDataFromForm = validatedEventDetails.data;

  const guestsRaw = formData.get("guests");
  let guests: GuestInput[] = [];
  if (typeof guestsRaw === 'string') {
    try {
      guests = JSON.parse(guestsRaw);
    } catch (e) {
      return { success: false, message: "Invalid guest data format." };
    }
  }
  const validatedGuests = GuestsSchema.safeParse(guests);
  if(!validatedGuests.success) {
    console.error("Server-side guest list validation failed:", validatedGuests.error.flatten());
    return { success: false, message: "Invalid guest data: " + JSON.stringify(validatedGuests.error.flatten().fieldErrors)};
  }
  const guestList = validatedGuests.data;


  const eventImageFile = formData.get("eventImage") as File | null;
  let eventImagePath: string | undefined = undefined;
  let queuedEmailCount = 0;

  try {
    if (eventImageFile && eventImageFile.size > 0) {
      const uploadedImageUrl = await uploadEventImage(eventImageFile, `event-${Date.now()}`); 
      if (uploadedImageUrl) {
        eventImagePath = uploadedImageUrl;
      } else {
        console.warn("Event image upload failed, proceeding without event image.");
      }
    }

    const eventToCreate: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'> = {
      creatorId: eventDataFromForm.creatorId,
      name: eventDataFromForm.name,
      description: eventDataFromForm.description,
      date: eventDataFromForm.date, 
      time: eventDataFromForm.time,
      location: eventDataFromForm.location,
      mood: eventDataFromForm.mood as EventMood,
      seatLimit: eventDataFromForm.seatLimit,
      eventImagePath: eventImagePath, 
      organizerEmail: eventDataFromForm.organizerEmail || undefined,
      isPublic: false, 
      publicRsvpLink: undefined, 
    };
    
    const newEvent = await createEvent(eventToCreate);
    if (!newEvent || !newEvent.id) {
      console.error("Database call to createEvent returned null or no ID.");
      return { success: false, message: "Failed to create event in database." };
    }

    const createdInvitations = await createInvitations(newEvent.id, guestList);
    if (!createdInvitations || createdInvitations.length === 0) {
      return { success: false, message: "Event created, but failed to create invitations." };
    }
    
    console.log(`Event ${newEvent.id} created by ${newEvent.creatorId}. ${createdInvitations.length} invitations created. Simulating queuing emails...`);

    for (const invitation of createdInvitations) {
      const emailPayload: EmailQueuePayload = {
        emailType: 'initialInvitation',
        invitationId: invitation.id,
        recipient: {
          name: invitation.guestName,
          email: invitation.guestEmail,
        },
        eventId: newEvent.id, // Optional: For context in worker
      };

      // SIMULATE ADDING TO QUEUE
      console.log(`SIMULATING QUEUE: Add payload for invitation ${invitation.id}:`, JSON.stringify(emailPayload));
      
      await createEmailLog({
        invitationId: invitation.id,
        eventId: newEvent.id,
        emailType: 'initialInvitation',
        emailAddress: invitation.guestEmail,
        status: 'queued', // Mark as queued
        sentAt: null, // Not sent yet
      });
      queuedEmailCount++;
    }

    return { 
      success: true, 
      message: `Event created. ${queuedEmailCount} invitation emails have been queued for sending.`,
      eventId: newEvent.id,
      invitationIds: createdInvitations.map(inv => inv.id),
      queuedEmailCount,
    };

  } catch (error) {
    console.error("Error in createEventAndProcessInvitations:", error);
    let errorMessageText = "An unexpected error occurred while processing the event and invitations.";
    if (error instanceof Error) {
        errorMessageText = error.message;
    }
    return { success: false, message: errorMessageText };
  }
}


// AI content generation is now part of the (future) worker, not directly called by client actions
// So, this specific client-facing AI text generation might be less relevant or refactored.
// For now, let's keep it as is if it's used for UI previews before queueing.
import { generatePersonalizedInvitation, type GenerateInvitationTextInput, type GenerateInvitationTextOutput as AIGenerateOutput } from '@/ai/flows/generate-invitation-text-flow';

export interface GenerateInvitationTextClientInput {
  eventName: string;
  eventDescription: string;
  eventMood: EventMood;
  guestName: string;
  adjustmentInstructions?: string;
  // emailType might be useful if previewing different types of emails
  emailType?: 'initialInvitation' | 'publicRsvpConfirmed' | 'publicRsvpWaitlisted' | 'waitlistAccepted' | 'waitlistDeclined';
}
export interface GenerateInvitationTextClientOutput {
  success: boolean;
  emailText?: string; 
  greeting?: string;
  body?: string;
  closing?: string;
  message?: string;
}

export async function generatePersonalizedInvitationText(input: GenerateInvitationTextClientInput): Promise<GenerateInvitationTextClientOutput> {
  try {
    const aiInput: GenerateInvitationTextInput = {
      eventName: input.eventName,
      eventDescription: input.eventDescription,
      eventMood: input.eventMood, 
      guestName: input.guestName,
      adjustmentInstructions: input.adjustmentInstructions,
      emailType: input.emailType || 'initialInvitation', // Default to initial invitation
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

export async function makeEventPublicServerAction(eventId: string): Promise<{ success: boolean; message: string; publicLink?: string }> {
  if (!eventId) {
    return { success: false, message: "Event ID is required." };
  }
  try {
    const publicRsvpToken = eventId; 
    const success = await updateEventPublicStatus(eventId, publicRsvpToken);
    if (success) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
      const publicLink = `${appUrl}/rsvp/public/${publicRsvpToken}`;
      return { success: true, message: "Event successfully made public.", publicLink };
    } else {
      return { success: false, message: "Failed to make event public in the database." };
    }
  } catch (error) {
    console.error(`Error making event ${eventId} public:`, error);
    return { success: false, message: "An unexpected error occurred while making the event public." };
  }
}

    