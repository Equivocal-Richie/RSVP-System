
"use server";

import { z } from "zod";
import { 
  getInvitationByToken, 
  getEventById, 
  createEventFeedback,
  createEmailLog
} from "@/lib/db";
import type { EventFeedbackData, GenerateFeedbackEmailInput } from "@/types";
import { generateEventFeedbackEmail } from "@/ai/flows/generate-feedback-email-flow";
import { sendGenericEmail } from "@/lib/emailService";

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
        // Optionally, only allow confirmed guests to submit feedback, or handle other statuses differently.
        // For now, we allow anyone with a valid invitation link who attended (or whose status implies they could have).
        console.warn(`Feedback submitted for invitation ${invitation.id} with status ${invitation.status}.`);
    }

    const feedbackToSave: Omit<EventFeedbackData, 'id' | 'submittedAt'> = {
      eventId: invitation.eventId,
      invitationId: invitation.id,
      guestNameAtTimeOfFeedback: invitation.guestName, // Or use the name from the form if you allow editing it
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

export async function sendFeedbackRequestEmailAction(invitationId: string): Promise<{success: boolean, message: string}> {
    if (!invitationId) {
        return { success: false, message: "Invitation ID is required." };
    }

    // In a real scenario, this action would likely be triggered by a cron job or a button in admin UI post-event.
    // For bulk sending, this logic would be in a Cloud Function processing a queue.

    try {
        const invitation = await db.getInvitationById(invitationId); // Assuming db has getInvitationById
        if (!invitation || invitation.status !== 'confirmed') {
            return { success: false, message: `Cannot send feedback request: Invitation ${invitationId} not found or guest did not confirm.` };
        }

        const event = await getEventById(invitation.eventId);
        if (!event) {
            return { success: false, message: `Cannot send feedback request: Event ${invitation.eventId} not found.` };
        }

        const aiInput: GenerateFeedbackEmailInput = {
            eventName: event.name,
            guestName: invitation.guestName,
        };
        const emailContent = await generateEventFeedbackEmail(aiInput);
        
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
        const feedbackLink = `${appUrl}/feedback/${invitation.uniqueToken}`;

        const htmlBody = `
            <p>${emailContent.greeting}</p>
            <p>${emailContent.body}</p>
            <p>Please use the link below to share your thoughts:</p>
            <p><a href="${feedbackLink}" style="display: inline-block; padding: 10px 20px; margin: 10px 0; background-color: hsl(var(--primary)); color: white; text-decoration: none; border-radius: 5px;">Share Feedback</a></p>
            <p>If the button doesn't work, copy and paste this link: ${feedbackLink}</p>
            <p>${emailContent.closing}</p>
        `;
        
        const emailResult = await sendGenericEmail(
            invitation.guestEmail, 
            invitation.guestName, 
            emailContent.subject, 
            `<html><body><div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">${htmlBody}</div></body></html>`
        );

        await createEmailLog({
            invitationId: invitation.id,
            eventId: event.id,
            emailAddress: invitation.guestEmail,
            status: emailResult.success ? 'sent' : 'failed',
            brevoMessageId: emailResult.messageId,
            errorMessage: emailResult.error,
            sentAt: emailResult.success ? new Date().toISOString() : null, // Log actual send time
        });

        if (emailResult.success) {
            return { success: true, message: `Feedback request email sent to ${invitation.guestEmail}.`};
        } else {
            return { success: false, message: `Failed to send feedback request to ${invitation.guestEmail}: ${emailResult.error}`};
        }

    } catch (error: any) {
        console.error(`Error in sendFeedbackRequestEmailAction for invitation ${invitationId}:`, error);
        return { success: false, message: `An unexpected error occurred: ${error.message}` };
    }
}

// Helper (add to db.ts if not already present for getInvitationById)
// This is a simplified version. Ensure getInvitationById exists in db.ts or adapt.
namespace db { export async function getInvitationById(id: string): Promise<InvitationData | null> {
    const docRef = (await import('@/lib/db')).db.collection('invitations').doc(id); // Dynamic import to avoid cycle
    const docSnap = await docRef.get();
    if (!docSnap.exists) return null;
    return convertTimestampsInObj(docSnap.data() as InvitationData);
}}
// Helper (add to db.ts if not already present for convertTimestampsInObj)
function convertTimestampsInObj<T extends Record<string, any>>(data: T): T { // Dynamic import to avoid cycle
  return (require('@/lib/db') as any).convertTimestampsInObj(data);
}
