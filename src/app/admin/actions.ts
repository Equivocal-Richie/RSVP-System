
"use server";

import { getAllInvitationsForEvent, getEventStats, getMostRecentEventIdForUser, getEventById } from "@/lib/db";
import { tabulateRsvpStats, type TabulateRsvpStatsInput, type TabulateRsvpStatsOutput } from "@/ai/flows/tabulate-rsvps";
import type { InvitationData, RsvpStats, EventData, EmailQueuePayload } from "@/types";
import { sendFeedbackRequestEmailAction } from "@/app/feedback/actions"; 

export async function fetchAdminDashboardData(userId: string | null): Promise<{
  event: EventData | null;
  stats: RsvpStats | null;
  invitations: InvitationData[];
  eventDetails: string; 
  guestListString: string;
}> {
  if (!userId) {
    return {
      event: null,
      stats: null,
      invitations: [],
      eventDetails: "User not authenticated.",
      guestListString: ""
    };
  }

  const recentEventId = await getMostRecentEventIdForUser(userId);

  if (!recentEventId) {
    return {
      event: null,
      stats: null,
      invitations: [],
      eventDetails: "No events found for this user.",
      guestListString: ""
    };
  }

  const event = await getEventById(recentEventId);
  if (!event) { 
    return {
      event: null,
      stats: null,
      invitations: [],
      eventDetails: `Event with ID ${recentEventId} not found.`,
      guestListString: ""
    };
  }
  const stats = await getEventStats(recentEventId);
  const invitations = await getAllInvitationsForEvent(recentEventId);

  const eventDetailsForAI = `Event: ${event.name}, Date: ${event.date}, Time: ${event.time}, Location: ${event.location}, Seat Limit: ${event.seatLimit}, Mood: ${event.mood}`;
  
  const guestListForAI = invitations.length > 0
    ? invitations
        .map(inv => `${inv.guestName} (${inv.guestEmail}): ${inv.status}`)
        .join("\n")
    : "No guests invited for this event.";

  return { event, stats, invitations, eventDetails: eventDetailsForAI, guestListString: guestListForAI };
}

export async function triggerAiTabulation(input: TabulateRsvpStatsInput): Promise<TabulateRsvpStatsOutput | { error: string }> {
  try {
    const result = await tabulateRsvpStats(input);
    return result;
  } catch (error) {
    console.error("AI Tabulation Error:", error);
    return { error: "Failed to tabulate RSVP stats using AI." };
  }
}

export async function exportGuestsToCsv(eventId: string | undefined): Promise<string | { error: string }> {
  if (!eventId) {
    return { error: "No event specified for export." };
  }
  try {
    const invitations = await getAllInvitationsForEvent(eventId);
    if (!invitations.length) {
      return { error: "No guests found for this event." };
    }

    const headers = ["Invitation ID", "Unique Token", "Guest Name", "Guest Email", "Status", "RSVP At", "Visited"];
    const csvRows = [
      headers.join(','),
      ...invitations.map(inv => [
        inv.id,
        inv.uniqueToken,
        `"${inv.guestName.replace(/"/g, '""')}"`, 
        inv.guestEmail,
        inv.status,
        inv.rsvpAt ? new Date(inv.rsvpAt).toLocaleString() : "N/A",
        inv.visited ? "Yes" : "No"
      ].join(','))
    ];
    return csvRows.join('\n');
  } catch (error) {
    console.error("CSV Export Error:", error);
    return { error: "Failed to export guest data." };
  }
}

// Resend Invitations action now also simulates queuing
export async function resendInvitations(guestInvitationIds: string[]): Promise<{ success: boolean; message: string, queuedCount?: number }> {
  if (!guestInvitationIds || guestInvitationIds.length === 0) {
    return { success: false, message: "No guest invitations specified for resending." };
  }
  
  console.log("Attempting to queue resend invitations for guests with IDs:", guestInvitationIds);
  let queuedCount = 0;

  for (const invId of guestInvitationIds) {
    const invitation = await getInvitationById(invId); // Fetch full invitation details
    if (invitation && invitation.status === 'pending') { // Example: only resend to pending
        const payload: EmailQueuePayload = {
            emailType: 'initialInvitation', // Or a new 'reminderInvitation' type
            invitationId: invId,
            recipient: { name: invitation.guestName, email: invitation.guestEmail },
            eventId: invitation.eventId,
        };
        // SIMULATE ADDING TO QUEUE
        console.log(`SIMULATING QUEUE (Resend): Add payload for invitation ${invId}:`, JSON.stringify(payload));
        // Potentially update emailLog or create a new one for this resend attempt with 'queued'
        queuedCount++;
    } else {
        console.warn(`Skipping resend for invitation ${invId}, status: ${invitation?.status}`);
    }
  }

  return { 
    success: true, 
    message: `${queuedCount} invitations have been queued for re-sending.`,
    queuedCount 
  };
}

export async function triggerSendFeedbackRequestsAction(eventId: string): Promise<{
  success: boolean;
  message: string;
  attemptedCount?: number;
  successfulQueueCount?: number;
  failedQueueCount?: number;
}> {
  if (!eventId) {
    return { success: false, message: "Event ID is required." };
  }

  try {
    const invitations = await getAllInvitationsForEvent(eventId);
    const confirmedInvitations = invitations.filter(inv => inv.status === 'confirmed');

    if (confirmedInvitations.length === 0) {
      return { success: true, message: "No confirmed guests found for this event to queue feedback requests for." };
    }

    let successfulQueueCount = 0;
    let failedQueueCount = 0;

    for (const inv of confirmedInvitations) {
      try {
        // sendFeedbackRequestEmailAction now queues the request
        const result = await sendFeedbackRequestEmailAction(inv.id); 
        if (result.success) {
          successfulQueueCount++;
        } else {
          failedQueueCount++;
          console.warn(`Failed to queue feedback request for invitation ${inv.id}: ${result.message}`);
        }
      } catch (loopError) {
        failedQueueCount++;
        console.error(`Error in loop for queuing feedback request, invitation ${inv.id}:`, loopError);
      }
    }
    
    let summaryMessage = `Attempted to queue ${confirmedInvitations.length} feedback request emails. `;
    summaryMessage += `Successfully queued: ${successfulQueueCount}, Failed to queue: ${failedQueueCount}. `;
    summaryMessage += `(Note: Emails will be processed by a background worker. Be mindful of daily email limits like Brevo's 300/day free tier.)`;

    return {
      success: true,
      message: summaryMessage,
      attemptedCount: confirmedInvitations.length,
      successfulQueueCount,
      failedQueueCount,
    };

  } catch (error: any) {
    console.error(`Error triggering feedback requests queue for event ${eventId}:`, error);
    return { success: false, message: error.message || "Failed to trigger feedback request queuing." };
  }
}

    