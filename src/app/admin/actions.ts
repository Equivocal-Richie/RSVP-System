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
    ? `Event: ${event.name}, Date: ${event.date}, Time: ${event.time}, Location: ${event.location}, Seat Limit: ${event.seatLimit}`
    : "Event details not available.";
  
  const guestListString = invitations
    .map(inv => `${inv.guestName} (${inv.guestEmail}): ${inv.status}`)
    .join("\n");

  return { stats, invitations, eventDetails, guestListString };
}

export async function triggerAiTabulation(input: TabulateRsvpStatsInput): Promise<TabulateRsvpStatsOutput | { error: string }> {
  try {
    // Here, you might add logic to ensure the user has permissions to do this
    const result = await tabulateRsvpStats(input);
    // In a real app, you'd use result.guestsToRemind to queue emails.
    // For now, we just return the result.
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

    const headers = ["Invitation ID", "Guest Name", "Guest Email", "Status", "RSVP At", "Visited"];
    const csvRows = [
      headers.join(','),
      ...invitations.map(inv => [
        inv.id,
        `"${inv.guestName.replace(/"/g, '""')}"`, // Handle quotes in names
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

// Placeholder for re-sending invitations action
export async function resendInvitations(guestIds: string[]): Promise<{ success: boolean; message: string }> {
  // This is where you'd integrate with your email queueing system (e.g., Firebase Functions + Cloud Tasks + SendGrid)
  console.log("Attempting to resend invitations to:", guestIds);
  // Simulate success
  return { success: true, message: `Queued ${guestIds.length} invitations for re-sending.` };
}
