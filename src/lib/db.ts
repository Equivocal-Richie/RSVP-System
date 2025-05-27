// Mock database simulating Firestore
import type { EventData, InvitationData, RsvpStats } from '@/types';

let mockEvents: EventData[] = [
  {
    id: 'event123',
    name: 'Annual Tech Gala 2024',
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    time: '18:00 PST',
    location: 'Grand Tech Hall, Silicon Valley',
    description: 'Join us for an evening of celebration, networking, and recognition of achievements in the tech industry. Dress code: Formal.',
    seatLimit: 150,
    confirmedGuestsCount: 78,
  },
];

let mockInvitations: InvitationData[] = [
  { id: 'unique-guest-link-1', eventId: 'event123', guestName: 'Alice Wonderland', guestEmail: 'alice@example.com', status: 'pending', visited: false, originalGuestName: 'Alice Wonderland', originalGuestEmail: 'alice@example.com' },
  { id: 'unique-guest-link-2', eventId: 'event123', guestName: 'Bob The Builder', guestEmail: 'bob@example.com', status: 'attending', visited: true, rsvpAt: new Date().toISOString(), originalGuestName: 'Bob The Builder', originalGuestEmail: 'bob@example.com'  },
  { id: 'unique-guest-link-3', eventId: 'event123', guestName: 'Charlie Brown', guestEmail: 'charlie@example.com', status: 'declining', visited: true, rsvpAt: new Date().toISOString(), originalGuestName: 'Charlie Brown', originalGuestEmail: 'charlie@example.com'  },
  { id: 'unique-guest-link-4', eventId: 'event123', guestName: 'Diana Prince', guestEmail: 'diana@example.com', status: 'pending', visited: false, originalGuestName: 'Diana Prince', originalGuestEmail: 'diana@example.com'  },
  // Add more mock guests for testing pagination or AI tabulation
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `guest-link-${i + 5}`,
    eventId: 'event123',
    guestName: `Pending Guest ${i + 1}`,
    guestEmail: `pending${i+1}@example.com`,
    status: 'pending' as 'pending' | 'attending' | 'declining',
    visited: false,
    originalGuestName: `Pending Guest ${i + 1}`,
    originalGuestEmail: `pending${i+1}@example.com`,
  })),
   { id: 'full-event-guest', eventId: 'event123', guestName: 'Late Comer', guestEmail: 'late@example.com', status: 'pending', visited: false, originalGuestName: 'Late Comer', originalGuestEmail: 'late@example.com' }
];

export async function getEventById(id: string): Promise<EventData | null> {
  return mockEvents.find(event => event.id === id) || null;
}

export async function getInvitationById(id: string): Promise<InvitationData | null> {
  const invitation = mockInvitations.find(inv => inv.id === id);
  if (invitation && !invitation.visited) {
    invitation.visited = true; // Mark as visited on first fetch
  }
  return invitation || null;
}

export async function updateInvitationRsvp(
  invitationId: string,
  status: 'attending' | 'declining',
  name: string,
  email: string
): Promise<{ success: boolean; message: string, invitation?: InvitationData } > {
  const invitationIndex = mockInvitations.findIndex(inv => inv.id === invitationId);
  if (invitationIndex === -1) {
    return { success: false, message: 'Invitation not found.' };
  }

  const event = mockEvents.find(e => e.id === mockInvitations[invitationIndex].eventId);
  if (!event) {
    return { success: false, message: 'Event not found for this invitation.' };
  }

  const oldStatus = mockInvitations[invitationIndex].status;

  if (status === 'attending') {
    if (oldStatus !== 'attending' && event.confirmedGuestsCount >= event.seatLimit) {
      return { success: false, message: 'Sorry, the event is currently full.' };
    }
    if (oldStatus !== 'attending') {
      event.confirmedGuestsCount += 1;
    }
  } else if (status === 'declining') {
    if (oldStatus === 'attending') {
      event.confirmedGuestsCount -= 1;
    }
  }
  
  mockInvitations[invitationIndex] = {
    ...mockInvitations[invitationIndex],
    guestName: name, // Update guest name
    guestEmail: email, // Update guest email
    status,
    rsvpAt: new Date().toISOString(),
  };

  return { success: true, message: 'RSVP updated successfully.', invitation: mockInvitations[invitationIndex] };
}

export async function getAllInvitationsForEvent(eventId: string): Promise<InvitationData[]> {
  if (!mockEvents.find(e => e.id === eventId)) return []; // ensure event exists
  return mockInvitations.filter(inv => inv.eventId === eventId);
}

export async function getEventStats(eventId: string): Promise<RsvpStats | null> {
  const event = mockEvents.find(e => e.id === eventId);
  if (!event) return null;

  const invitations = mockInvitations.filter(inv => inv.eventId === eventId);
  const confirmed = invitations.filter(inv => inv.status === 'attending').length;
  const pending = invitations.filter(inv => inv.status === 'pending').length;
  const declined = invitations.filter(inv => inv.status === 'declining').length;
  
  // Ensure confirmedGuestsCount on event matches calculated confirmed for consistency
  event.confirmedGuestsCount = confirmed;

  return {
    confirmed,
    pending,
    declined,
    totalSeats: event.seatLimit,
    availableSeats: event.seatLimit - confirmed,
  };
}

// Function to simulate updating guest info by admin (simplified)
export async function updateGuestInfoByAdmin(invitationId: string, newName: string, newEmail: string): Promise<boolean> {
  const invitation = mockInvitations.find(inv => inv.id === invitationId);
  if (invitation) {
    invitation.guestName = newName;
    invitation.guestEmail = newEmail;
    // In a real scenario, you might want to differentiate between guest-updated name/email and admin-updated.
    // For this mock, we'll just update. If they were pre-filled, originalGuestName/Email would hold the original values.
    if (!invitation.originalGuestName) invitation.originalGuestName = newName;
    if (!invitation.originalGuestEmail) invitation.originalGuestEmail = newEmail;
    return true;
  }
  return false;
}
