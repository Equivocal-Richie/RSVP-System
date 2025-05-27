export interface EventData {
  id: string;
  name: string;
  date: string; 
  time: string;
  location: string;
  description: string;
  seatLimit: number;
  confirmedGuestsCount: number;
}

export interface InvitationData {
  id: string; // Unique unguessable URL part
  eventId: string;
  guestName: string;
  guestEmail: string;
  status: 'pending' | 'attending' | 'declining';
  visited: boolean;
  rsvpAt?: string; // ISO string date
  originalGuestName?: string; // Store original name for reference
  originalGuestEmail?: string; // Store original email for reference
}

export interface RsvpStats {
  confirmed: number;
  pending: number;
  declined: number;
  totalSeats: number;
  availableSeats: number;
}
