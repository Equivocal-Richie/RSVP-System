
"use server";

import { getEventById, getAllInvitationsForEvent, getEventStats, getMostRecentEventIdForUser } from "@/lib/db";
import { tabulateRsvpStats, type TabulateRsvpStatsInput, type TabulateRsvpStatsOutput } from "@/ai/flows/tabulate-rsvps";
import type { InvitationData, RsvpStats, EventData } from "@/types";

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
  if (!event) { // Added check if event fetch fails for some reason
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
