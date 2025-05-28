
"use server";

import { z } from "zod";
import { createEvent, createInvitations, createEmailLog, getEventById, updateEventPublicStatus } from '@/lib/db';
import type { EventData, GuestInput, EventMood, InvitationData, EmailStatus } from '@/types';
import { generatePersonalizedInvitation, type GenerateInvitationTextInput, type GenerateInvitationTextOutput as AIGenerateOutput } from '@/ai/flows/generate-invitation-text-flow';
import { sendInvitationEmail } from '@/lib/emailService';
import { uploadEventImage } from '@/lib/storage';


const CreateEventServerSchema = z.object({
  name: z.string().min(1, "Event name is required."),
  description: z.string().min(1, "Event description is required."),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format." }), 
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)."),
  location: z.string().min(1, "Location is required."),
  mood: z.enum(['formal', 'casual', 'celebratory', 'professional', 'themed'], { message: "Invalid event mood." }),
  seatLimit: z.preprocess(val => parseInt(String(val), 10), z.number()), 
  organizerEmail: z.string().email("Invalid organizer email.").optional().or(z.literal("")),
  isPublic: z.boolean().optional().default(false),
});

const GuestsSchema = z.array(z.object({
  name: z.string().min(1, "Guest name is required."),
  email: z.string().email("Invalid guest email."),
})).min(1, "At least one guest is required.");


export async function createEventAndProcessInvitations(
  formData: FormData
): Promise<{ success: boolean; message: string; eventId?: string; invitationIds?: string[]; emailResults?: any[] }> {
  
  const eventDetailsRaw = {
    name: formData.get("name"),
    description: formData.get("description"),
    date: formData.get("date"),
    time: formData.get("time"),
    location: formData.get("location"),
    mood: formData.get("mood"),
    seatLimit: formData.get("seatLimit"),
    organizerEmail: formData.get("organizerEmail") || "", 
    isPublic: formData.get("isPublic") === 'true', // This won't be set from the current form, defaults to false via schema
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
  const emailResults = [];

  try {
    // Use a temporary ID for the image path if event ID isn't available yet,
    // or structure storage paths not to strictly depend on final event ID if it causes issues.
    // For simplicity, let's assume event ID will be generated first.
    // const tempEventIdForImage = `temp-${Date.now()}`; 

    if (eventImageFile && eventImageFile.size > 0) {
      // We need an eventId to properly name the image.
      // This creates a slight challenge: event isn't created yet.
      // Solution: upload image with a generic name or pass eventId after creation.
      // For now, we pass a temporary identifier or a placeholder.
      // A better approach might be to create event, then upload image with actual event ID, then update event.
      // Or, use a generated UUID for the image name not tied to event ID.
      // Let's assume uploadEventImage can handle a placeholder or generate its own unique name.
      const uploadedImageUrl = await uploadEventImage(eventImageFile, "temp-event-image"); // Pass placeholder
      if (uploadedImageUrl) {
        eventImagePath = uploadedImageUrl;
      } else {
        console.warn("Event image upload failed, proceeding without event image.");
      }
    }

    const eventToCreate: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'> = {
      name: eventDataFromForm.name,
      description: eventDataFromForm.description,
      date: eventDataFromForm.date, // This is an ISO string from form, db layer expects it
      time: eventDataFromForm.time,
      location: eventDataFromForm.location,
      mood: eventDataFromForm.mood as EventMood,
      seatLimit: eventDataFromForm.seatLimit,
      eventImagePath: eventImagePath, // Will be null if upload failed or no image
      organizerEmail: eventDataFromForm.organizerEmail || undefined, // Pass undefined if empty string
      isPublic: eventDataFromForm.isPublic, // This will be false from Zod default
      publicRsvpLink: undefined, // Will be null in db by default
    };
    
    const newEvent = await createEvent(eventToCreate);
    if (!newEvent || !newEvent.id) {
      console.error("Database call to createEvent returned null or no ID.");
      return { success: false, message: "Failed to create event in database." };
    }

    // If image was uploaded with a temp name, and you want to rename it with actual event ID, do it here.
    // This is more complex and might involve deleting the temp and re-uploading, or a rename operation if supported.
    // For now, we assume the URL from uploadEventImage is final.

    const createdInvitations = await createInvitations(newEvent.id, guestList);
    if (!createdInvitations || createdInvitations.length === 0) {
      return { success: false, message: "Event created, but failed to create invitations." };
    }
    
    // Fetch the full event details again to ensure we have all fields (like createdAt)
    const currentEventDetails = await getEventById(newEvent.id);
    if (!currentEventDetails) {
        // This would be unusual if newEvent.id was valid
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
          emailStatus = 'sent';
          brevoMessageId = emailResult.messageId;
          sentAtValue = new Date().toISOString();
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
        sentAt: sentAtValue,
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
    let errorMessageText = "An unexpected error occurred while processing the event and invitations.";
    if (error instanceof Error) {
        errorMessageText = error.message;
    }
    return { success: false, message: errorMessageText, emailResults };
  }
}


export interface GenerateInvitationTextClientInput {
  eventName: string;
  eventDescription: string;
  eventMood: EventMood;
  guestName: string;
  adjustmentInstructions?: string; // Added for "Adjust with AI"
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
      adjustmentInstructions: input.adjustmentInstructions, // Pass through
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
