
"use server";

import { z } from "zod";
import { getEventById, createPublicRsvpInvitation } from "@/lib/db";
import type { InvitationData } from "@/types"; // Ensure RsvpFormState is compatible or define a public specific one
import type { RsvpFormState } from "../../[token]/actions"; // Using the same state type for now

const PublicRsvpFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  eventId: z.string().min(1, { message: "Event ID is missing." }),
  // Status is not explicitly submitted by user for public RSVP, it's implicitly 'confirmed'
});

export async function submitPublicRsvp(
  prevState: RsvpFormState,
  formData: FormData
): Promise<RsvpFormState> {
  const validatedFields = PublicRsvpFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    eventId: formData.get("eventId"),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your input.",
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { eventId, name, email } = validatedFields.data;

  try {
    // Event existence and seat limit checks will be handled by createPublicRsvpInvitation
    const result = await createPublicRsvpInvitation(eventId, name, email);

    if (result.success && result.invitation) {
      return { 
        success: true, 
        message: result.message, // "RSVP successful! You're confirmed."
        updatedInvitation: result.invitation // Pass the new invitation data
      };
    } else {
      return { 
        success: false, 
        message: result.message || "Failed to submit public RSVP. Please try again." 
      };
    }
  } catch (error) {
    console.error("Public RSVP submission error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during public RSVP. Please try again later.",
    };
  }
}
