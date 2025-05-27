import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString } from '@/types';

const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations';
const EMAIL_LOGS_COLLECTION = 'emailLogs';

// --- Event Functions ---

export async function getEventById(id: string): Promise<EventData | null> {
  try {
    const docRef = db.collection(EVENTS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`Event with ID ${id} not found.`);
      return null;
    }
    const data = docSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount'> & { createdAt?: Timestamp, updatedAt?: Timestamp, _confirmedGuestsCount?: number, date: Timestamp | string };
    
    // Fetch current confirmed guest count for the event
    const invitationsSnap = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', id)
      .where('status', '==', 'confirmed')
      .count()
      .get();
    const confirmedGuestsCount = invitationsSnap.data().count;

    return convertTimestampsInObj({
      id: docSnap.id,
      ...data,
      date: timestampToIsoString(data.date as Timestamp)!, // Ensure date is string
      confirmedGuestsCount: data._confirmedGuestsCount ?? confirmedGuestsCount, // Prefer internal counter, fallback to calculation
    }) as EventData;
  } catch (error) {
    console.error(`Error fetching event ${id}:`, error);
    return null;
  }
}

// --- Invitation Functions ---

export async function getInvitationById(id: string): Promise<InvitationData | null> {
  try {
    const docRef = db.collection(INVITATIONS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`Invitation with ID ${id} not found.`);
      return null;
    }

    const invitation = { id: docSnap.id, ...docSnap.data() } as InvitationData;

    if (!invitation.visited) {
      await docRef.update({ visited: true, updatedAt: FieldValue.serverTimestamp() });
      invitation.visited = true;
    }
    
    return convertTimestampsInObj(invitation);
  } catch (error) {
    console.error(`Error fetching invitation ${id}:`, error);
    return null;
  }
}

export async function updateInvitationRsvp(
  invitationId: string,
  status: 'confirmed' | 'declining', // Aligned to new RsvpStatus subset used by form
  name: string,
  email: string
): Promise<{ success: boolean; message: string; invitation?: InvitationData }> {
  const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(invitationId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const invitationSnap = await transaction.get(invitationRef);
      if (!invitationSnap.exists) {
        throw new Error('Invitation not found.');
      }
      const invitationData = invitationSnap.data() as InvitationData;

      const eventRef = db.collection(EVENTS_COLLECTION).doc(invitationData.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found for this invitation.');
      }
      const eventData = eventSnap.data() as EventData & { _confirmedGuestsCount?: number };
      
      const oldStatus = invitationData.status;
      let newConfirmedGuestCount = eventData._confirmedGuestsCount ?? (await getEventStats(eventData.id))?.confirmed ?? 0;

      // Seat limit check
      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (newConfirmedGuestCount >= eventData.seatLimit) {
          // Potentially set to 'waitlisted' in future, for now, it's an error if form only supports confirmed/declined.
          // Or, if the desire is to auto-waitlist:
          // newStatusForInvitation = 'waitlisted';
          // newStatusForReservation = 'waitlisted';
          // No change to confirmedGuestCount for waitlisted.
          throw new Error('Sorry, the event is currently full.');
        }
      }
      
      const updateData: Partial<InvitationData> & { updatedAt: any, rsvpAt: any } = {
        guestName: name,
        guestEmail: email,
        status: status as RsvpStatus, // Cast to full RsvpStatus
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateData);

      // Update confirmed guest count on event
      if (oldStatus !== status) {
        if (status === 'confirmed') {
          newConfirmedGuestCount++;
        } else if (oldStatus === 'confirmed' && status === 'declining') {
          newConfirmedGuestCount--;
        }
        transaction.update(eventRef, { _confirmedGuestsCount: newConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
      }
      
      // Manage Reservation
      const reservationQuery = db.collection(RESERVATIONS_COLLECTION)
                                 .where('invitationId', '==', invitationId)
                                 .limit(1);
      const reservationSnap = await transaction.get(reservationQuery);

      if (status === 'confirmed') {
        if (reservationSnap.empty) {
          const newReservationRef = db.collection(RESERVATIONS_COLLECTION).doc();
          transaction.set(newReservationRef, {
            invitationId: invitationId,
            eventId: invitationData.eventId,
            reservationTime: FieldValue.serverTimestamp(),
            status: 'confirmed',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          // Update existing reservation if it was, e.g., waitlisted and now confirmed (though current logic doesn't allow this path from form)
           transaction.update(reservationSnap.docs[0].ref, { status: 'confirmed', updatedAt: FieldValue.serverTimestamp() });
        }
      } else if (status === 'declining') {
        if (!reservationSnap.empty) {
          // If declining, remove/invalidate any existing reservation
          transaction.delete(reservationSnap.docs[0].ref);
        }
      }

      return {
        id: invitationId,
        ...invitationData,
        ...updateData,
        // Timestamps will be server-generated; this is an optimistic local representation
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
    const event = await getEventById(eventId); // This already gets event.seatLimit and event._confirmedGuestsCount
    if (!event) return null;

    const statuses: RsvpStatus[] = ['pending', 'confirmed', 'declined', 'waitlisted'];
    const counts: { [key in RsvpStatus]: number } = {
      pending: 0,
      confirmed: 0,
      declined: 0,
      waitlisted: 0,
    };

    // Efficiently get counts for all statuses for the given eventId
    const invitationsQuery = db.collection(INVITATIONS_COLLECTION).where('eventId', '==', eventId);
    
    for (const status of statuses) {
        const countSnapshot = await invitationsQuery.where('status', '==', status).count().get();
        counts[status] = countSnapshot.data().count;
    }
    
    // Prioritize the transactionally updated _confirmedGuestsCount from the event document if available
    // otherwise use the calculated count. This is useful for consistency.
    const confirmedCount = event.confirmedGuestsCount !== undefined ? event.confirmedGuestsCount : counts.confirmed;

    return {
      confirmed: confirmedCount,
      pending: counts.pending,
      declined: counts.declined,
      waitlisted: counts.waitlisted,
      totalSeats: event.seatLimit,
      availableSeats: event.seatLimit - confirmedCount,
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
      invitationId,
      eventId,
      reservationTime: FieldValue.serverTimestamp(),
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await newReservationRef.set(reservationData);
    const newReservationSnap = await newReservationRef.get(); // Get the data with server timestamps
    return convertTimestampsInObj({ id: newReservationSnap.id, ...newReservationSnap.data() } as ReservationData);
  } catch (error) {
    console.error(`Error creating reservation for invitation ${invitationId}:`, error);
    return null;
  }
}

// --- Email Log Functions ---
export async function createEmailLog(
  invitationId: string,
  eventId: string,
  emailAddress: string,
  status: 'sent' | 'failed' | 'bounced'
): Promise<EmailLogData | null> {
  try {
    const newLogRef = db.collection(EMAIL_LOGS_COLLECTION).doc();
    const logData = {
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
