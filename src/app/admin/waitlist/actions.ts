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
    EmailQueuePayload,
    EmailStatus, // Ensure EmailStatus is imported
    EmailType // Ensure EmailType is imported
} from "@/types";
// AI flow is for content generation, which would be used by the (future) worker.
// import { generatePersonalizedInvitation } from '@/ai/flows/generate-invitation-text-flow';
// Direct email sending is removed.
// import { sendInvitationEmail } from '@/lib/emailService'; 

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
      // Default to the most recent event (userEvents is already sorted by date desc)
      selectedEventId = userEvents[0].id; 
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
      // This case should be less likely if acceptResult.invitation is present
      return { success: false, message: "Failed to retrieve event or invitation details for queuing email." };
    }

    // Queue 'waitlistAccepted' email
    const emailPayload: EmailQueuePayload = {
        emailType: 'waitlistAccepted',
        invitationId: invitation.id,
        recipient: { name: invitation.guestName, email: invitation.guestEmail },
        eventId: event.id,
    };

    // SIMULATE ADDING TO QUEUE
    console.log(`SIMULATING QUEUE: Add payload for waitlist acceptance ${invitation.id}:`, JSON.stringify(emailPayload));

    await createEmailLog({
        invitationId: invitation.id,
        eventId: event.id,
        emailAddress: invitation.guestEmail,
        emailType: 'waitlistAccepted',
        status: 'queued',
        sentAt: null, 
    });

    return { success: true, message: `Guest ${invitation.guestName} accepted. Notification email queued.`, updatedInvitation: invitation };

  } catch (error: any) {
    console.error("Error processing accept waitlist guest action:", error);
    return { success: false, message: error.message || "An unexpected error occurred." };
  }
}

export async function processDeclineWaitlistGuestAction(
  invitationId: string,
  eventId: string 
): Promise<{ success: boolean; message: string; updatedInvitation?: InvitationData }> {
  try {
    const declineResult = await declineWaitlistedGuest(invitationId);
    if (!declineResult.success || !declineResult.invitation) {
      return { success: false, message: declineResult.message || "Failed to decline guest from waitlist." };
    }
    
    const event = await getEventById(eventId); 
    const invitation = declineResult.invitation;

    if (!event || !invitation) {
        return { success: false, message: "Failed to retrieve event or invitation details for queuing email." };
    }

    // Queue 'waitlistDeclined' email
    const emailPayload: EmailQueuePayload = {
        emailType: 'waitlistDeclined',
        invitationId: invitation.id,
        recipient: { name: invitation.guestName, email: invitation.guestEmail },
        eventId: event.id,
    };
    
    // SIMULATE ADDING TO QUEUE
    console.log(`SIMULATING QUEUE: Add payload for waitlist decline ${invitation.id}:`, JSON.stringify(emailPayload));

    await createEmailLog({
        invitationId: invitation.id,
        eventId: event.id,
        emailAddress: invitation.guestEmail,
        emailType: 'waitlistDeclined',
        status: 'queued',
        sentAt: null,
    });
    
    return { success: true, message: `Guest ${invitation.guestName} declined. Notification email queued.`, updatedInvitation: invitation };

  } catch (error: any) {
    console.error("Error processing decline waitlist guest action:", error);
    return { success: false, message: error.message || "An unexpected error occurred." };
  }
}