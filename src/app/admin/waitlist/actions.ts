
"use server";

import { 
    getAllEventsForUser, 
    getWaitlistedGuestsForEvent,
    getEventById,
    getInvitationById,
    acceptWaitlistedGuest,
    declineWaitlistedGuest,
    createEmailLog
} from "@/lib/db";
import type { 
    EventData, 
    InvitationData, 
    EventForSelector,
    EmailStatus,
    EmailType
} from "@/types";
import { generatePersonalizedInvitation } from '@/ai/flows/generate-invitation-text-flow';
import { sendInvitationEmail } from '@/lib/emailService'; // Re-use for consistency

interface WaitlistPageData {
  events: EventForSelector[];
  waitlistedGuests: InvitationData[];
  selectedEventDetails: EventData | null;
  error?: string;
}

export async function fetchWaitlistPageData(userId: string, eventId?: string): Promise<WaitlistPageData> {
  if (!userId) {
    return { events: [], waitlistedGuests: [], selectedEventDetails: null, error: "User not authenticated." };
  }

  try {
    const userEvents = await getAllEventsForUser(userId);
    const eventSelectors: EventForSelector[] = userEvents.map(e => ({ id: e.id, name: e.name, date: e.date }));

    let selectedEventId = eventId;
    if (!selectedEventId && userEvents.length > 0) {
      selectedEventId = userEvents[0].id; // Default to the most recent event
    }

    let waitlistedGuests: InvitationData[] = [];
    let selectedEventDetails: EventData | null = null;

    if (selectedEventId) {
      waitlistedGuests = await getWaitlistedGuestsForEvent(selectedEventId);
      selectedEventDetails = await getEventById(selectedEventId);
    }
    
    return { events: eventSelectors, waitlistedGuests, selectedEventDetails };

  } catch (error) {
    console.error("Error fetching waitlist page data:", error);
    return { events: [], waitlistedGuests: [], selectedEventDetails: null, error: "Failed to load waitlist data." };
  }
}

export async function processAcceptWaitlistGuestAction(
  invitationId: string, 
  eventId: string
): Promise<{ success: boolean; message: string; updatedInvitation?: InvitationData }> {
  try {
    const acceptResult = await acceptWaitlistedGuest(invitationId, eventId);
    if (!acceptResult.success || !acceptResult.invitation) {
      return { success: false, message: acceptResult.message || "Failed to accept guest from waitlist." };
    }

    const event = await getEventById(eventId);
    const invitation = acceptResult.invitation;

    if (!event || !invitation) {
      return { success: false, message: "Failed to retrieve event or invitation details for email." };
    }

    // Send 'waitlistAccepted' email
    const aiEmailContent = await generatePersonalizedInvitation({
      eventName: event.name,
      eventDescription: event.description,
      eventMood: event.mood,
      guestName: invitation.guestName,
      emailType: 'waitlistAccepted'
    });

    const emailResult = await sendInvitationEmail(invitation, event, aiEmailContent, `Update on Your RSVP for ${event.name}`);
    
    await createEmailLog({
        invitationId: invitation.id,
        eventId: event.id,
        emailAddress: invitation.guestEmail,
        status: emailResult.success ? 'sent' : 'failed',
        brevoMessageId: emailResult.messageId,
        errorMessage: emailResult.error,
        sentAt: emailResult.success ? new Date().toISOString() : null,
    });

    return { success: true, message: `Guest ${invitation.guestName} accepted and notified.`, updatedInvitation: invitation };

  } catch (error: any) {
    console.error("Error processing accept waitlist guest action:", error);
    return { success: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function processDeclineWaitlistGuestAction(
  invitationId: string,
  eventId: string // eventId needed to fetch event details for email context
): Promise<{ success: boolean; message: string; updatedInvitation?: InvitationData }> {
  try {
    const declineResult = await declineWaitlistedGuest(invitationId);
    if (!declineResult.success || !declineResult.invitation) {
      return { success: false, message: declineResult.message || "Failed to decline guest from waitlist." };
    }
    
    const event = await getEventById(eventId); // Fetch event details
    const invitation = declineResult.invitation;

    if (!event || !invitation) {
        return { success: false, message: "Failed to retrieve event or invitation details for email." };
    }

    // Send 'waitlistDeclined' email
    const aiEmailContent = await generatePersonalizedInvitation({
      eventName: event.name,
      eventDescription: event.description, // Provide description for context
      eventMood: event.mood,
      guestName: invitation.guestName,
      emailType: 'waitlistDeclined'
    });
    
    const emailResult = await sendInvitationEmail(invitation, event, aiEmailContent, `Update on Your Waitlist Status for ${event.name}`);

    await createEmailLog({
        invitationId: invitation.id,
        eventId: event.id,
        emailAddress: invitation.guestEmail,
        status: emailResult.success ? 'sent' : 'failed',
        brevoMessageId: emailResult.messageId,
        errorMessage: emailResult.error,
        sentAt: emailResult.success ? new Date().toISOString() : null,
    });
    
    return { success: true, message: `Guest ${invitation.guestName} declined from waitlist and notified.`, updatedInvitation: invitation };

  } catch (error: any) {
    console.error("Error processing decline waitlist guest action:", error);
    return { success: false, message: error.message || "An unexpected error occurred." };
  }
}
