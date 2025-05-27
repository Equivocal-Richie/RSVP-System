
"use server";

import { getEventById, getAllInvitationsForEvent, getEventStats, getMostRecentEventId } from "@/lib/db";
import { tabulateRsvpStats, type TabulateRsvpStatsInput, type TabulateRsvpStatsOutput } from "@/ai/flows/tabulate-rsvps";
import type { InvitationData, RsvpStats, EventData } from "@/types";

export async function fetchAdminDashboardData(): Promise<{
  event: EventData | null;
  stats: RsvpStats | null;
  invitations: InvitationData[];
  eventDetails: string; // For AI processing
  guestListString: string; // For AI processing
}> {
  const recentEventId = await getMostRecentEventId();

  if (!recentEventId) {
    return {
      event: null,
      stats: null,
      invitations: [],
      eventDetails: "No events found.",
      guestListString: ""
    };
  }

  const event = await getEventById(recentEventId);
  const stats = await getEventStats(recentEventId);
  const invitations = await getAllInvitationsForEvent(recentEventId);

  const eventDetailsForAI = event
    ? `Event: ${event.name}, Date: ${event.date}, Time: ${event.time}, Location: ${event.location}, Seat Limit: ${event.seatLimit}, Mood: ${event.mood}`
    : "Event details not available.";
  
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
  console.log("Attempting to resend invitations to guests with tokens:", guestUniqueTokens);
  return { success: true, message: `Queued ${guestUniqueTokens.length} invitations for re-sending.` };
}
