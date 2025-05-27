"use server";

import { z } from "zod";
import { getEventById, getInvitationById, updateInvitationRsvp } from "@/lib/db";
import type { InvitationData } from "@/types";

const RsvpFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  status: z.enum(["attending", "declining"], { message: "Please select your attendance status." }),
  invitationId: z.string(),
});

export type RsvpFormState = {
  message: string;
  success: boolean;
  errors?: {
    name?: string[];
    email?: string[];
    status?: string[];
    _form?: string[];
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
    invitationId: formData.get("invitationId"),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your input.",
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { invitationId, name, email, status } = validatedFields.data;

  try {
    const invitation = await getInvitationById(invitationId);
    if (!invitation) {
      return { success: false, message: "Invalid invitation link." };
    }

    // Check if already RSVP'd with a definitive status
    // Allow changing from attending to declining or vice-versa, or updating details if status is same
    // if (invitation.status !== 'pending' && invitation.status === status && invitation.guestName === name && invitation.guestEmail === email) {
    //   return { success: false, message: "You have already RSVP'd with these details." };
    // }

    const event = await getEventById(invitation.eventId);
    if (!event) {
      return { success: false, message: "Event not found for this invitation." };
    }

    if (status === "attending" && invitation.status !== "attending" && event.confirmedGuestsCount >= event.seatLimit) {
      return { success: false, message: "Sorry, the event is currently full. Please contact the organizer if you believe this is an error." };
    }
    
    const result = await updateInvitationRsvp(invitationId, status, name, email);

    if (result.success) {
      return { 
        success: true, 
        message: status === "attending" ? "Thank you for confirming your attendance!" : "Your RSVP (declined) has been recorded. Thank you!",
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
