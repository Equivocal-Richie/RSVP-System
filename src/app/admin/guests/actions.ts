
"use server";

import { getAllEventsForUser, getAllInvitationsForEvent } from "@/lib/db";
import type { UserGuestRow, InvitationData, EventData } from "@/types";
import Papa from 'papaparse'; // For CSV generation

export async function fetchAllUserGuests(userId: string): Promise<{ guests: UserGuestRow[], error?: string }> {
  if (!userId) {
    return { guests: [], error: "User not authenticated." };
  }

  try {
    const events = await getAllEventsForUser(userId);
    if (!events || events.length === 0) {
      return { guests: [] };
    }

    const allGuests: UserGuestRow[] = [];

    for (const event of events) {
      const invitations = await getAllInvitationsForEvent(event.id);
      invitations.forEach(inv => {
        allGuests.push({
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          guestId: inv.id,
          guestName: inv.guestName,
          guestEmail: inv.guestEmail,
          status: inv.status,
        });
      });
    }
    // Sort by event date (most recent first), then by guest name
    allGuests.sort((a, b) => {
        if (a.eventDate > b.eventDate) return -1;
        if (a.eventDate < b.eventDate) return 1;
        return a.guestName.localeCompare(b.guestName);
    });
    
    return { guests: allGuests };
  } catch (error) {
    console.error("Error fetching all user guests:", error);
    return { guests: [], error: "Failed to fetch guest data." };
  }
}

export async function exportAllUserGuestsToCsv(userId: string): Promise<{ csv?: string; error?: string }> {
  if (!userId) {
    return { error: "User not authenticated for export." };
  }
  
  const { guests, error } = await fetchAllUserGuests(userId);

  if (error) {
    return { error };
  }
  if (guests.length === 0) {
    return { error: "No guest data available to export." };
  }

  try {
    // Define headers for the CSV file
    const headers = ["Event Name", "Event Date", "Guest Name", "Guest Email", "RSVP Status"];
    
    // Map guest data to an array of arrays for papaparse
    const dataToParse = guests.map(guest => [
      guest.eventName,
      new Date(guest.eventDate).toLocaleDateString(), // Format date for readability
      guest.guestName,
      guest.guestEmail,
      guest.status.charAt(0).toUpperCase() + guest.status.slice(1) // Capitalize status
    ]);

    // Add headers as the first row
    const csvString = Papa.unparse([headers, ...dataToParse]);
    return { csv: csvString };

  } catch (parseError) {
    console.error("Error generating CSV for all user guests:", parseError);
    return { error: "Failed to generate CSV data." };
  }
}
