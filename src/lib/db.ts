
import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString, EventMood, GuestInput } from '@/types';
import { randomUUID } from 'crypto';


const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations';
const EMAIL_LOGS_COLLECTION = 'emailLogs';

// --- Event Functions ---
export async function createEvent(eventData: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'>): Promise<EventData | null> {
  try {
    const newEventRef = db.collection(EVENTS_COLLECTION).doc(); // Auto-generate ID
    const fullEventData = {
      ...eventData,
      id: newEventRef.id, // Store the auto-generated ID within the document
      confirmedGuestsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await newEventRef.set(fullEventData);
    
    // Fetch the document to get server-generated timestamps
    const docSnap = await newEventRef.get();
    if (!docSnap.exists) return null; // Should not happen
    return convertTimestampsInObj(docSnap.data() as EventData);

  } catch (error) {
    console.error("Error creating event:", error);
    return null;
  }
}


export async function getEventById(id: string): Promise<EventData | null> {
  try {
    const docRef = db.collection(EVENTS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`Event with ID ${id} not found.`);
      return null;
    }
    const data = docSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount'> & { createdAt?: Timestamp, updatedAt?: Timestamp, _confirmedGuestsCount?: number, date: Timestamp | string };
    
    const invitationsSnap = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', id)
      .where('status', '==', 'confirmed')
      .count()
      .get();
    const confirmedGuestsCount = invitationsSnap.data().count;

    return convertTimestampsInObj({
      id: docSnap.id,
      ...data,
      date: timestampToIsoString(data.date as Timestamp)!, 
      confirmedGuestsCount: data._confirmedGuestsCount ?? confirmedGuestsCount, 
    }) as EventData;
  } catch (error) {
    console.error(`Error fetching event ${id}:`, error);
    return null;
  }
}

// --- Invitation Functions ---

export async function createInvitations(eventId: string, guests: GuestInput[]): Promise<InvitationData[]> {
  const batch = db.batch();
  const createdInvitations: InvitationData[] = [];

  for (const guest of guests) {
    const uniqueToken = randomUUID(); // Generate a unique token
    const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(); // Firestore auto-ID for the doc
    const newInvitation: Omit<InvitationData, 'id' | 'createdAt' | 'updatedAt' | 'rsvpAt' | 'visited'> & { createdAt: any, updatedAt: any } = {
      uniqueToken,
      eventId,
      guestName: guest.name,
      guestEmail: guest.email,
      status: 'pending',
      originalGuestName: guest.name,
      originalGuestEmail: guest.email,
      visited: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(invitationRef, newInvitation);
    // Optimistically add to results, timestamps will be stringified later if needed client-side
    createdInvitations.push({ 
        ...newInvitation, 
        id: invitationRef.id, 
        // Convert server timestamps to placeholders for client if necessary
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        rsvpAt: null,
        visited: false,
    });
  }

  try {
    await batch.commit();
    // For more accurate data, one might re-fetch these, but for creation, this is usually sufficient
    return createdInvitations.map(inv => convertTimestampsInObj(inv)); 
  } catch (error) {
    console.error("Error creating invitations in batch:", error);
    throw error; // Re-throw to be handled by the caller
  }
}

export async function getInvitationByToken(token: string): Promise<InvitationData | null> {
  try {
    const invitationsQuery = db.collection(INVITATIONS_COLLECTION).where('uniqueToken', '==', token).limit(1);
    const snapshot = await invitationsQuery.get();

    if (snapshot.empty) {
      console.log(`Invitation with token ${token} not found.`);
      return null;
    }
    const docSnap = snapshot.docs[0];
    const invitation = { id: docSnap.id, ...docSnap.data() } as InvitationData;

    if (!invitation.visited) {
      await docSnap.ref.update({ visited: true, updatedAt: FieldValue.serverTimestamp() });
      invitation.visited = true;
    }
    
    return convertTimestampsInObj(invitation);
  } catch (error) {
    console.error(`Error fetching invitation by token ${token}:`, error);
    return null;
  }
}

export async function updateInvitationRsvp(
  uniqueToken: string, // Changed from invitationId
  status: 'confirmed' | 'declining', 
  name: string,
  email: string
): Promise<{ success: boolean; message: string; invitation?: InvitationData }> {
  
  const invitationQuery = db.collection(INVITATIONS_COLLECTION).where('uniqueToken', '==', uniqueToken).limit(1);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationQuery);
      if (invitationSnapshot.empty) {
        throw new Error('Invitation not found.');
      }
      const invitationRef = invitationSnapshot.docs[0].ref;
      const invitationData = invitationSnapshot.docs[0].data() as InvitationData;

      const eventRef = db.collection(EVENTS_COLLECTION).doc(invitationData.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found for this invitation.');
      }
      const eventData = eventSnap.data() as EventData & { _confirmedGuestsCount?: number };
      
      const oldStatus = invitationData.status;
      let newConfirmedGuestCount = eventData._confirmedGuestsCount ?? (await getEventStats(eventData.id))?.confirmed ?? 0;

      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (eventData.seatLimit > 0 && newConfirmedGuestCount >= eventData.seatLimit) {
          // TODO: Handle waitlisting logic if desired, for now, it's an error.
          throw new Error('Sorry, the event is currently full.');
        }
      }
      
      const updateData: Partial<InvitationData> & { updatedAt: any, rsvpAt: any } = {
        guestName: name,
        guestEmail: email,
        status: status as RsvpStatus,
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateData);

      if (oldStatus !== status) {
        if (status === 'confirmed') {
          newConfirmedGuestCount++;
        } else if (oldStatus === 'confirmed' && status === 'declining') {
          newConfirmedGuestCount--;
        }
        transaction.update(eventRef, { _confirmedGuestsCount: newConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
      }
      
      const reservationQuery = db.collection(RESERVATIONS_COLLECTION)
                                 .where('invitationId', '==', invitationData.id) // Still use Firestore doc ID for reservation link
                                 .limit(1);
      const reservationSnap = await transaction.get(reservationQuery);

      if (status === 'confirmed') {
        if (reservationSnap.empty) {
          const newReservationRef = db.collection(RESERVATIONS_COLLECTION).doc();
          transaction.set(newReservationRef, {
            invitationId: invitationData.id, // Link to the invitation document ID
            eventId: invitationData.eventId,
            reservationTime: FieldValue.serverTimestamp(),
            status: 'confirmed',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
           transaction.update(reservationSnap.docs[0].ref, { status: 'confirmed', updatedAt: FieldValue.serverTimestamp() });
        }
      } else if (status === 'declining') {
        if (!reservationSnap.empty) {
          transaction.delete(reservationSnap.docs[0].ref);
        }
      }

      return {
        ...invitationData,
        ...updateData,
        rsvpAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
      } as InvitationData;
    });
    
    return { success: true, message: 'RSVP updated successfully.', invitation: convertTimestampsInObj(result) };

  } catch (error: any) {
    console.error('Error updating RSVP:', error);
    return { success: false, message: error.message || 'Failed to update RSVP. Please try again.' };
  }
}

export async function getAllInvitationsForEvent(eventId: string): Promise<InvitationData[]> {
  try {
    const eventDoc = await db.collection(EVENTS_COLLECTION).doc(eventId).get();
    if (!eventDoc.exists) {
      console.warn(`getAllInvitationsForEvent: Event ${eventId} not found.`);
      return [];
    }

    const snapshot = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .orderBy('createdAt', 'desc')
      .get();
      
    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as InvitationData));
  } catch (error) {
    console.error(`Error fetching all invitations for event ${eventId}:`, error);
    return [];
  }
}

export async function getEventStats(eventId: string): Promise<RsvpStats | null> {
  try {
    const event = await getEventById(eventId);
    if (!event) return null;

    const statuses: RsvpStatus[] = ['pending', 'confirmed', 'declined', 'waitlisted'];
    const counts: { [key in RsvpStatus]: number } = {
      pending: 0,
      confirmed: 0,
      declined: 0,
      waitlisted: 0,
    };

    const invitationsQuery = db.collection(INVITATIONS_COLLECTION).where('eventId', '==', eventId);
    
    for (const status of statuses) {
        const countSnapshot = await invitationsQuery.where('status', '==', status).count().get();
        counts[status] = countSnapshot.data().count;
    }
    
    const confirmedCount = event.confirmedGuestsCount !== undefined ? event.confirmedGuestsCount : counts.confirmed;
    const totalSeats = event.seatLimit <= 0 ? Infinity : event.seatLimit; // Handle unlimited seats
    const availableSeats = totalSeats === Infinity ? Infinity : totalSeats - confirmedCount;


    return {
      confirmed: confirmedCount,
      pending: counts.pending,
      declined: counts.declined,
      waitlisted: counts.waitlisted,
      totalSeats: event.seatLimit, // Keep original seatLimit for display
      availableSeats: availableSeats,
    };
  } catch (error) {
    console.error(`Error fetching event stats for ${eventId}:`, error);
    return null;
  }
}

export async function updateGuestInfoByAdmin(invitationId: string, newName: string, newEmail: string): Promise<boolean> {
  try {
    const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(invitationId);
    await invitationRef.update({
      guestName: newName,
      guestEmail: newEmail,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error(`Error updating guest info for invitation ${invitationId}:`, error);
    return false;
  }
}

// --- Reservation Functions ---
export async function createReservation(
  invitationId: string,
  eventId: string,
  status: 'confirmed' | 'waitlisted'
): Promise<ReservationData | null> {
  try {
    const newReservationRef = db.collection(RESERVATIONS_COLLECTION).doc();
    const reservationData = {
      id: newReservationRef.id,
      invitationId,
      eventId,
      reservationTime: FieldValue.serverTimestamp(),
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await newReservationRef.set(reservationData);
    const newReservationSnap = await newReservationRef.get(); 
    return convertTimestampsInObj({ id: newReservationSnap.id, ...newReservationSnap.data() } as ReservationData);
  } catch (error) {
    console.error(`Error creating reservation for invitation ${invitationId}:`, error);
    return null;
  }
}

// --- Email Log Functions ---
export async function createEmailLog(
  invitationId: string, // or uniqueToken
  eventId: string,
  emailAddress: string,
  status: 'sent' | 'failed' | 'bounced' | 'queued'
): Promise<EmailLogData | null> {
  try {
    const newLogRef = db.collection(EMAIL_LOGS_COLLECTION).doc();
    const logData = {
      id: newLogRef.id,
      invitationId,
      eventId,
      emailAddress,
      sentAt: FieldValue.serverTimestamp(),
      status,
      createdAt: FieldValue.serverTimestamp(),
    };
    await newLogRef.set(logData);
    const newLogSnap = await newLogRef.get();
    return convertTimestampsInObj({ id: newLogSnap.id, ...newLogSnap.data() } as EmailLogData);
  } catch (error) {
    console.error(`Error creating email log for invitation ${invitationId}:`, error);
    return null;
  }
}
