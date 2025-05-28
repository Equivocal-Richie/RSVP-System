

// Base type for Firestore Timestamps, which will be converted to string for client
type FirestoreTimestamp = {
  _seconds: number;
  _nanoseconds: number;
};
// Helper to indicate a string that was derived from a Firestore Timestamp
export type TimestampString = string;


export type EventMood = 'formal' | 'casual' | 'celebratory' | 'professional' | 'themed';

export interface EventData {
  id: string;
  name: string;
  date: TimestampString; // ISO string date, from Firestore Timestamp
  time: string;
  location: string;
  description: string;
  mood: EventMood;
  eventImagePath?: string; // Optional: path/URL to event image
  seatLimit: number; // Set to 0 or -1 if no limit
  confirmedGuestsCount: number; // This will be derived or read from a denormalized field
  organizerEmail?: string; // For "Inquire" functionality
  isPublic?: boolean; // Defaults to false
  publicRsvpLink?: string; // Unique link for public RSVPs if isPublic is true
  createdAt?: TimestampString; // from Firestore Timestamp
  updatedAt?: TimestampString; // from Firestore Timestamp
}

export type RsvpStatus = 'pending' | 'confirmed' | 'declined' | 'waitlisted';

export interface InvitationData {
  id: string; // Firestore document ID
  uniqueToken: string; // Unique unguessable URL part, indexed
  eventId: string;
  guestName: string;
  guestEmail: string;
  status: RsvpStatus;
  visited: boolean;
  rsvpAt?: TimestampString | null; // ISO string date, from Firestore Timestamp
  originalGuestName?: string; // If admin updates, keep original for reference
  originalGuestEmail?: string; // If admin updates, keep original for reference
  createdAt?: TimestampString; // from Firestore Timestamp
  updatedAt?: TimestampString; // from Firestore Timestamp
}

export interface GuestInput {
  name: string;
  email: string;
}

export interface ReservationData {
  id: string; // Firestore document ID
  invitationId: string; // Corresponds to InvitationData.id (or uniqueToken if preferred for lookup)
  eventId: string;
  reservationTime: TimestampString; // from Firestore Timestamp
  status: 'confirmed' | 'waitlisted';
  createdAt?: TimestampString;
  updatedAt?: TimestampString;
}

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced';

export interface EmailLogData {
  id: string; // Firestore document ID
  invitationId: string;
  eventId: string;
  emailAddress: string;
  sentAt: TimestampString | null; // from Firestore Timestamp, null if queued/failed before sending
  status: EmailStatus;
  brevoMessageId?: string; // Optional: To store Brevo's message ID for tracking
  errorMessage?: string; // Optional: For logging errors from Brevo
  createdAt?: TimestampString;
  // No updatedAt for email logs, typically immutable after creation or final status update
}

export interface RsvpStats {
  confirmed: number;
  pending: number;
  declined: number;
  waitlisted: number;
  totalSeats: number; // 0 or -1 means unlimited
  availableSeats: number; // Meaningful only if totalSeats > 0
}

export interface UserData {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Add other profile fields as needed
  createdAt?: TimestampString;
}
