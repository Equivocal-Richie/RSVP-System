
"use server";

import { z } from "zod";
import { getEventById, createPublicRsvpInvitation } from "@/lib/db"; // Using eventId as token for now
import type { InvitationData, EventData } from "@/types"; // Re-use existing RsvpFormState

// Copied from src/app/rsvp/[token]/actions.ts - can be refactored to a shared type
export type PublicRsvpFormState = {
  message: string;
  success: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    status?: string[];
    _form?: string[]; 
  };
  updatedInvitation?: InvitationData; // Or a similar structure for public RSVP confirmation
};

const PublicRsvpFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  status: z.enum(["confirmed", "declining"], { message: "Please select your attendance status." }),
  eventId: z.string(), // eventId will be submitted from the form
});


export async function submitPublicRsvp(
  prevState: PublicRsvpFormState,
  formData: FormData
): Promise<PublicRsvpFormState> {
  const validatedFields = PublicRsvpFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    status: formData.get("status"),
    eventId: formData.get("eventId"),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your input.",
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { eventId, name, email, status } = validatedFields.data;

  if (status === "declining") {
    // For public RSVP, declining doesn't really mean anything unless they were already on a list.
    // We can just acknowledge.
    return {
      success: true,
      message: "Thank you. Your preference not to attend has been noted.",
    };
  }

  try {
    const event = await getEventById(eventId);
    if (!event || !event.isPublic) {
      return { success: false, message: "Event not found or not open for public RSVP." };
    }

    // Seat limit check
    if (event.seatLimit > 0 && event.confirmedGuestsCount >= event.seatLimit) {
      // TODO: Implement waitlisting logic for public RSVPs if desired.
      return { 
        success: false, 
        message: "Sorry, the event is currently full. Please contact the organizer or check back later." 
      };
    }
    
    // Create a new "invitation-like" record for this public RSVP
    const newInvitation = await createPublicRsvpInvitation(eventId, name, email);

    if (newInvitation) {
      return { 
        success: true, 
        message: "Thank you for confirming your attendance! Your spot has been reserved.",
        updatedInvitation: newInvitation // This represents the newly created public RSVP record
      };
    } else {
      return { success: false, message: "Failed to record your public RSVP. Please try again." };
    }

  } catch (error) {
    console.error("Public RSVP submission error:", error);
    return {
      success: false,
      message: "An unexpected error occurred while processing your RSVP. Please try again later.",
    };
  }
}

    