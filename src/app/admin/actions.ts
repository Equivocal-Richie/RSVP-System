
"use server";

import { getEventById, getAllInvitationsForEvent, getEventStats } from "@/lib/db";
import { tabulateRsvpStats, type TabulateRsvpStatsInput, type TabulateRsvpStatsOutput } from "@/ai/flows/tabulate-rsvps";
import type { InvitationData, RsvpStats } from "@/types";

export async function fetchAdminDashboardData(eventId: string): Promise<{
  stats: RsvpStats | null;
  invitations: InvitationData[];
  eventDetails: string;
  guestListString: string;
}> {
  const stats = await getEventStats(eventId);
  const invitations = await getAllInvitationsForEvent(eventId);
  const event = await getEventById(eventId);

  const eventDetails = event 
    ? `Event: ${event.name}, Date: ${event.date}, Time: ${event.time}, Location: ${event.location}, Seat Limit: ${event.seatLimit}, Mood: ${event.mood}`
    : "Event details not available.";
  
  const guestListString = invitations
    .map(inv => `${inv.guestName} (${inv.guestEmail}): ${inv.status}`)
    .join("\n");

  return { stats, invitations, eventDetails, guestListString };
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

export async function exportGuestsToCsv(eventId: string): Promise<string | { error: string }> {
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
  // This is where you'd integrate with your email queueing system 
  // (e.g., Firebase Functions + Cloud Tasks + SendGrid)
  // For now, we use guestUniqueTokens to identify them.
  console.log("Attempting to resend invitations to guests with tokens:", guestUniqueTokens);
  // Simulate success
  return { success: true, message: `Queued ${guestUniqueTokens.length} invitations for re-sending.` };
}
