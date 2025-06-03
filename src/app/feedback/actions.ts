
"use server";

import { z } from "zod";
import { 
  getInvitationByToken, 
  getEventById, 
  createEventFeedback,
  createEmailLog, // Re-added createEmailLog
  getInvitationById as getInvitationByIdFromDb // Renamed to avoid conflict
} from "@/lib/db";
import type { EventFeedbackData, GenerateFeedbackEmailInput, EmailQueuePayload } from "@/types";
// AI and direct email sending are deferred to worker
// import { generateEventFeedbackEmail } from "@/ai/flows/generate-feedback-email-flow";
// import { sendGenericEmail } from "@/lib/emailService";

const FeedbackFormSchema = z.object({
  invitationToken: z.string().min(1, "Invitation token is missing."),
  rating: z.coerce.number().min(1, "Rating is required.").max(5, "Rating cannot exceed 5."),
  likedMost: z.string().min(10, "Please tell us what you liked (min 10 characters).").max(1000),
  suggestionsForImprovement: z.string().max(1000).optional(),
});

export type FeedbackFormState = {
  message: string;
  success: boolean;
  errors?: z.ZodIssue[];
  feedbackId?: string;
};

export async function saveEventFeedback(
  prevState: FeedbackFormState,
  formData: FormData
): Promise<FeedbackFormState> {
  const validatedFields = FeedbackFormSchema.safeParse({
    invitationToken: formData.get("invitationToken"),
    rating: formData.get("rating"),
    likedMost: formData.get("likedMost"),
    suggestionsForImprovement: formData.get("suggestionsForImprovement"),
  });

  if (!validatedFields.success) {
    return {
      message: "Validation failed. Please check your input.",
      success: false,
      errors: validatedFields.error.issues,
    };
  }

  const { invitationToken, rating, likedMost, suggestionsForImprovement } = validatedFields.data;

  try {
    const invitation = await getInvitationByToken(invitationToken);
    if (!invitation) {
      return { success: false, message: "Invalid invitation link. Feedback cannot be submitted." };
    }
    if (invitation.status !== 'confirmed') {
        console.warn(`Feedback submitted for invitation ${invitation.id} with status ${invitation.status}.`);
    }

    const feedbackToSave: Omit<EventFeedbackData, 'id' | 'submittedAt'> = {
      eventId: invitation.eventId,
      invitationId: invitation.id,
      guestNameAtTimeOfFeedback: invitation.guestName, 
      rating,
      likedMost,
      suggestionsForImprovement: suggestionsForImprovement || "",
    };

    const savedFeedback = await createEventFeedback(feedbackToSave);

    if (savedFeedback && savedFeedback.id) {
      return {
        success: true,
        message: "Thank you! Your feedback has been successfully submitted.",
        feedbackId: savedFeedback.id,
      };
    } else {
      return { success: false, message: "Failed to save your feedback. Please try again." };
    }
  } catch (error) {
    console.error("Error saving event feedback:", error);
    return {
      success: false,
      message: "An unexpected error occurred while submitting your feedback. Please try again later.",
    };
  }
}

// This action now just queues the request. The actual email sending will be done by a worker.
export async function sendFeedbackRequestEmailAction(invitationId: string): Promise<{success: boolean, message: string}> {
    if (!invitationId) {
        return { success: false, message: "Invitation ID is required." };
    }

    try {
        const invitation = await getInvitationByIdFromDb(invitationId);
        if (!invitation || invitation.status !== 'confirmed') {
            return { success: false, message: `Cannot queue feedback request: Invitation ${invitationId} not found or guest did not confirm.` };
        }

        const event = await getEventById(invitation.eventId);
        if (!event) {
            return { success: false, message: `Cannot queue feedback request: Event ${invitation.eventId} not found.` };
        }

        const emailPayload: EmailQueuePayload = {
            emailType: 'eventFeedback',
            invitationId: invitation.id,
            recipient: {
                name: invitation.guestName,
                email: invitation.guestEmail,
            },
            eventId: event.id, // For context in worker
        };

        // SIMULATE ADDING TO QUEUE
        console.log(`SIMULATING QUEUE: Add payload for feedback request ${invitation.id}:`, JSON.stringify(emailPayload));
        
        await createEmailLog({
            invitationId: invitation.id,
            eventId: event.id,
            emailType: 'eventFeedback',
            emailAddress: invitation.guestEmail,
            status: 'queued', // Mark as queued
            sentAt: null, // Not sent yet
        });

        return { success: true, message: `Feedback request for ${invitation.guestEmail} has been queued.`};

    } catch (error: any) {
        console.error(`Error in sendFeedbackRequestEmailAction for invitation ${invitationId}:`, error);
        return { success: false, message: `An unexpected error occurred while queuing feedback request: ${error.message}` };
    }
}

    