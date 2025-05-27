
// Base type for Firestore Timestamps, which will be converted to string for client
type FirestoreTimestamp = {
  _seconds: number;
  _nanoseconds: number;
};
// Helper to indicate a string that was derived from a Firestore Timestamp
export type TimestampString = string;


export interface EventData {
  id: string;
  name: string;
  date: TimestampString; // ISO string date, from Firestore Timestamp
  time: string;
  location: string;
  description: string;
  seatLimit: number;
  confirmedGuestsCount: number; // This will be derived or read from a denormalized field
  createdAt?: TimestampString; // from Firestore Timestamp
  updatedAt?: TimestampString; // from Firestore Timestamp
}

export type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'waitlisted';

export interface InvitationData {
  id: string; // Unique unguessable URL part, used as Firestore document ID
  eventId: string;
  guestName: string;
  guestEmail: string;
  status: RsvpStatus;
  visited: boolean;
  rsvpAt?: TimestampString | null; // ISO string date, from Firestore Timestamp
  originalGuestName?: string;
  originalGuestEmail?: string;
  createdAt?: TimestampString; // from Firestore Timestamp
  updatedAt?: TimestampString; // from Firestore Timestamp
}

export interface ReservationData {
  id: string; // Firestore document ID
  invitationId: string; // Corresponds to InvitationData.id
  eventId: string;
  reservationTime: TimestampString; // from Firestore Timestamp
  status: 'confirmed' | 'waitlisted';
  createdAt?: TimestampString;
  updatedAt?: TimestampString;
}

export interface EmailLogData {
  id: string; // Firestore document ID
  invitationId: string;
  eventId: string;
  emailAddress: string;
  sentAt: TimestampString; // from Firestore Timestamp
  status: 'sent' | 'failed' | 'bounced';
  createdAt?: TimestampString;
}

export interface RsvpStats {
  confirmed: number;
  pending: number;
  declined: number;
  waitlisted: number; // Added waitlisted to stats
  totalSeats: number;
  availableSeats: number;
}
