
"use server";

import { getAllInvitationsForEvent, getEventStats, getMostRecentEventIdForUser, getEventById } from "@/lib/db";
import { tabulateRsvpStats, type TabulateRsvpStatsInput, type TabulateRsvpStatsOutput } from "@/ai/flows/tabulate-rsvps";
import type { InvitationData, RsvpStats, EventData } from "@/types";
import { sendFeedbackRequestEmailAction } from "@/app/feedback/actions"; // Import the action

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

export async function resendInvitations(guestUniqueTokens: string[]): Promise<{ success: boolean; message: string }> {
  // Placeholder: Actual resend logic would involve re-queuing emails.
  console.log("Attempting to resend invitations to guests with tokens:", guestUniqueTokens);
  // In a real implementation, you would:
  // 1. Fetch invitation details for each token.
  // 2. Call your email sending service for each.
  // 3. Update email logs.
  return { success: true, message: `Queued ${guestUniqueTokens.length} invitations for re-sending (simulated).` };
}

export async function triggerSendFeedbackRequestsAction(eventId: string): Promise<{
  success: boolean;
  message: string;
  attemptedCount?: number;
  successfulCount?: number;
  failedCount?: number;
}> {
  if (!eventId) {
    return { success: false, message: "Event ID is required." };
  }

  try {
    const invitations = await getAllInvitationsForEvent(eventId);
    const confirmedInvitations = invitations.filter(inv => inv.status === 'confirmed');

    if (confirmedInvitations.length === 0) {
      return { success: true, message: "No confirmed guests found for this event to send feedback requests to." };
    }

    let successfulCount = 0;
    let failedCount = 0;

    // Simulate queuing by iterating. In production, this would add to a Cloud Task/PubSub queue.
    for (const inv of confirmedInvitations) {
      try {
        // Assuming sendFeedbackRequestEmailAction is designed to handle one invitationId
        const result = await sendFeedbackRequestEmailAction(inv.id);
        if (result.success) {
          successfulCount++;
        } else {
          failedCount++;
          console.warn(`Failed to queue/send feedback request for invitation ${inv.id}: ${result.message}`);
        }
      } catch (loopError) {
        failedCount++;
        console.error(`Error in loop for feedback request, invitation ${inv.id}:`, loopError);
      }
    }
    
    let summaryMessage = `Attempted to send ${confirmedInvitations.length} feedback request emails. `;
    summaryMessage += `Successful: ${successfulCount}, Failed: ${failedCount}. `;
    summaryMessage += `(Note: This is a simulation. True bulk sending requires a queueing system. Be mindful of daily email limits like Brevo's 300/day free tier.)`;

    return {
      success: true,
      message: summaryMessage,
      attemptedCount: confirmedInvitations.length,
      successfulCount,
      failedCount,
    };

  } catch (error: any) {
    console.error(`Error triggering feedback requests for event ${eventId}:`, error);
    return { success: false, message: error.message || "Failed to trigger feedback requests." };
  }
}
