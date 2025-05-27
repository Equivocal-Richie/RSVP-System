
"use server";

import { z } from "zod";
import { getEventById, getInvitationByToken, updateInvitationRsvp } from "@/lib/db"; // Changed getInvitationById
import type { InvitationData, RsvpStatus } from "@/types";

const RsvpFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  status: z.enum(["confirmed", "declining"], { message: "Please select your attendance status." }),
  token: z.string(), // Changed from invitationId to token
});

export type RsvpFormState = {
  message: string;
  success: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    status?: string[];
    _form?: string[]; // For general form errors
  };
  updatedInvitation?: InvitationData;
};

export async function submitRsvp(
  prevState: RsvpFormState,
  formData: FormData
): Promise<RsvpFormState> {
  const validatedFields = RsvpFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    status: formData.get("status"),
    token: formData.get("token"), // Changed from invitationId
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your input.",
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { token, name, email, status } = validatedFields.data;

  try {
    const invitation = await getInvitationByToken(token); // Use token to fetch invitation
    if (!invitation) {
      return { success: false, message: "Invalid invitation link." };
    }

    // Optional: Check if email matches the invited guest's email if strict matching is needed
    // if (email.toLowerCase() !== invitation.guestEmail.toLowerCase()) {
    //   return { success: false, message: "The email provided does not match the invited guest's email." };
    // }

    const event = await getEventById(invitation.eventId);
    if (!event) {
      return { success: false, message: "Event not found for this invitation." };
    }
    
    // Seat limit check
    if (status === "confirmed" && invitation.status !== "confirmed" && event.seatLimit > 0) { // Only check if seatLimit is positive
      if (event.confirmedGuestsCount >= event.seatLimit) {
        // TODO: Could implement waitlisting logic here in the future
        // For now, return an error.
        return { 
          success: false, 
          message: "Sorry, the event is currently full. Please contact the organizer if you believe this is an error or to inquire about a waitlist." 
        };
      }
    }
    
    const result = await updateInvitationRsvp(token, status, name, email); // Pass token to update

    if (result.success) {
      return { 
        success: true, 
        message: status === "confirmed" ? "Thank you for confirming your attendance!" : "Your RSVP (declined) has been recorded. Thank you!",
        updatedInvitation: result.invitation
      };
    } else {
      return { success: false, message: result.message || "Failed to update RSVP. Please try again." };
    }
  } catch (error) {
    console.error("RSVP submission error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    };
  }
}
