
"use server";

import { z } from "zod";
import { createPublicRsvpInvitation, getEventByPublicLinkToken, createEmailLog } from "@/lib/db";
import type { RsvpFormState, InvitationData } from "@/types";
import { generatePersonalizedInvitation, type GenerateInvitationTextInput, type GenerateInvitationTextOutput } from '@/ai/flows/generate-invitation-text-flow';
import { sendInvitationEmail } from '@/lib/emailService'; // Re-using this, it can handle subject overrides

const PublicRsvpFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  eventId: z.string().min(1, { message: "Event ID is missing." }), // Public RSVP uses eventId as token
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
    const event = await getEventByPublicLinkToken(eventId);
    if (!event) {
      return { success: false, message: "Event not found or no longer available for public RSVP." };
    }

    // Call the database function to attempt creating the RSVP/invitation
    const result = await createPublicRsvpInvitation(eventId, name, email);

    if (result.success && result.invitation) {
      const newInvitation = result.invitation;
      const emailType = newInvitation.status === 'confirmed' ? 'publicRsvpConfirmed' : 'publicRsvpWaitlisted';
      const subject = newInvitation.status === 'confirmed' 
        ? `Your RSVP is Confirmed for ${event.name}!`
        : `You're on the Waitlist for ${event.name}`;

      try {
        const aiInputForEmail: GenerateInvitationTextInput = {
          eventName: event.name,
          eventDescription: event.description,
          eventMood: event.mood,
          guestName: newInvitation.guestName,
          emailType: emailType,
        };
        const aiEmailContent = await generatePersonalizedInvitation(aiInputForEmail);
        
        // Re-using sendInvitationEmail for simplicity, providing a subject override
        const emailResult = await sendInvitationEmail(
            newInvitation, // Pass the new invitation data
            event, 
            aiEmailContent, 
            subject // Subject override
        );

        await createEmailLog({
          invitationId: newInvitation.id,
          eventId: event.id,
          emailAddress: newInvitation.guestEmail,
          status: emailResult.success ? 'sent' : 'failed',
          brevoMessageId: emailResult.messageId,
          errorMessage: emailResult.error,
          sentAt: emailResult.success ? new Date().toISOString() : null,
        });
        
        if (!emailResult.success) {
            console.warn(`Public RSVP for ${email} to event ${eventId} was successful, but email notification failed: ${emailResult.error}`);
            // Decide if this should make the overall operation seem like a failure to the user or just a partial success
        }

      } catch (emailOrAiError: any) {
        console.error(`Error sending ${emailType} email for public RSVP ${newInvitation.id}: ${emailOrAiError.message}`);
        // Log error but don't necessarily fail the RSVP itself if it was stored
      }
      
      return {
        success: true,
        message: newInvitation.status === 'confirmed'
          ? "Thank you for RSVPing! Your spot is confirmed."
          : "Thank you! The event is currently full, but you've been added to the waitlist. We'll notify you if a spot opens up.",
        updatedInvitation: newInvitation, // Return the created/updated invitation data
      };
    } else {
      // Handle specific error messages from createPublicRsvpInvitation if available
      return { success: false, message: result.message || "Failed to process your RSVP. Please try again." };
    }
  } catch (error: any) {
    console.error("Public RSVP submission error:", error);
    let errorMessage = "An unexpected error occurred. Please try again later.";
    if (error.message.includes("full")) { // Crude check for full event error
        errorMessage = "Sorry, the event is currently full and we couldn't add you to the waitlist at this time.";
    }
    return {
      success: false,
      message: errorMessage,
      errors: { _form: [errorMessage] }
    };
  }
}
