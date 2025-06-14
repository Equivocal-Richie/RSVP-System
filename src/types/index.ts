
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
  creatorId: string; // ID of the user who created the event
  name: string;
  date: TimestampString; // ISO string date, from Firestore Timestamp
  time: string;
  location: string;
  description: string;
  mood: EventMood;
  eventImagePath?: string; // Optional: path/URL to event image
  seatLimit: number; // Set to 0 or -1 if no limit
  confirmedGuestsCount: number; // This will be derived or read from a denormalized field (_confirmedGuestsCount in Firestore)
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
  guestEmail: string; // Always stored in lowercase
  status: RsvpStatus;
  visited: boolean;
  rsvpAt?: TimestampString | null; // ISO string date, from Firestore Timestamp
  originalGuestName?: string; // If admin updates, keep original for reference
  originalGuestEmail?: string; // If admin updates, keep original for reference - stores original case email
  isPublicOrigin?: boolean; // True if this invitation was created via a public RSVP link, defaults to false.
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

export type EmailStatus = 'queued' | 'processing' | 'sent' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced';
export type EmailType = 
  | 'initialInvitation' 
  | 'publicRsvpConfirmed' 
  | 'publicRsvpWaitlisted' 
  | 'waitlistAccepted' 
  | 'waitlistDeclined' 
  | 'eventFeedback'
  | 'otpVerification'; // Added for OTP, though OTPs might be sent directly

export interface EmailLogData {
  id: string; // Firestore document ID
  invitationId: string; // Can be null if email is not related to a specific invitation (e.g. OTP)
  eventId?: string; // Can be null if not event-specific (e.g. OTP for general account)
  emailAddress: string;
  emailType: EmailType; // What kind of email was this?
  sentAt: TimestampString | null; // from Firestore Timestamp, null if queued/failed before sending
  status: EmailStatus;
  brevoMessageId?: string; // Optional: To store Brevo's message ID for tracking
  errorMessage?: string; // Optional: For logging errors from Brevo
  createdAt?: TimestampString;
  // No updatedAt for email logs, typically immutable after creation or final status update
}

export interface EmailQueuePayload {
  emailType: EmailType;
  // For invitation-related emails
  invitationId?: string; 
  // For general emails or where invitationId isn't primary context
  eventId?: string;
  recipient: {
    name: string;
    email: string;
  };
  // Specific data for certain email types
  otp?: string; // For OTP emails
  // Other fields can be added as needed per emailType
  // e.g. eventName for context if not fetching full event object in worker
}


export interface RsvpStats {
  confirmed: number;
  pending: number;
  declined: number;
  waitlisted: number;
  totalSeats: number; // 0 means unlimited for display purposes
  availableSeats: number; // Meaningful only if totalSeats > 0
}

export interface UserData {
  id: string; // Firebase Auth UID
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Add other profile fields as needed
  createdAt?: TimestampString;
  updatedAt?: TimestampString; // Added for consistency
}

export interface EventAnalyticRow {
  eventId: string;
  eventName: string;
  eventDate: TimestampString;
  confirmedGuests: number;
  seatLimit: number;
  capacityFilledPercentage: number | null; // null if seatLimit is 0 or less
  changeFromPreviousPercentage: number | null; // null if no previous event or previous event had no seat limit
}

// For AI Event Analysis
export interface AnalyzeEventPerformanceInput {
  eventId: string;
  eventName: string;
  eventDescription: string;
  eventDate: TimestampString;
  confirmedGuests: number;
  seatLimit: number;
  capacityFilledPercentage: number | null;
  guestFeedbackSummary?: string;
}

export interface EventAnalysisOutput {
  insights: string[];
  suggestions: string[];
  overallSentiment?: string; // Future enhancement
}

// For Past Guests Page
export interface UserGuestRow {
  eventId: string;
  eventName: string;
  eventDate: TimestampString;
  guestId: string; // This is invitationId
  guestName: string;
  guestEmail: string;
  status: RsvpStatus;
}

// For Event Feedback System
export interface EventFeedbackData {
  id: string; // Firestore document ID
  eventId: string;
  invitationId: string; // Links to the specific guest's invitation
  guestNameAtTimeOfFeedback: string; // Name of the guest when they submitted feedback
  rating: number; // e.g., 1-5
  likedMost: string;
  suggestionsForImprovement: string;
  submittedAt: TimestampString; // from Firestore Timestamp
}

export interface GenerateFeedbackEmailInput {
  eventName: string;
  guestName: string;
}

export interface GenerateFeedbackEmailOutput {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullEmailText: string;
}

// For Waitlist Management Page
export interface WaitlistGuestInfo extends InvitationData {
  // We can extend InvitationData or just use it directly.
  // Adding specific fields if needed for the waitlist view.
}
export interface EventForSelector {
    id: string;
    name: string;
    date: TimestampString;
}

    