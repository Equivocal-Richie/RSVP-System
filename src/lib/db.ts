
import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString, EventMood, GuestInput, EmailStatus } from '@/types';
import { randomUUID } from 'crypto';


const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations';
const EMAIL_LOGS_COLLECTION = 'emailLogs';

// --- Event Functions ---

export async function getMostRecentEventId(): Promise<string | null> {
  try {
    const snapshot = await db.collection(EVENTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("No events found.");
      return null;
    }
    return snapshot.docs[0].id;
  } catch (error) {
    console.error("Error fetching most recent event ID:", error);
    return null;
  }
}

export async function createEvent(eventData: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'>): Promise<EventData | null> {
  try {
    const newEventRef = db.collection(EVENTS_COLLECTION).doc(); 
    
    const firestoreWriteData = {
      ...eventData, 
      date: Timestamp.fromDate(new Date(eventData.date)), 
      id: newEventRef.id, 
      _confirmedGuestsCount: 0, 
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      isPublic: eventData.isPublic ?? false, // Ensure default
    };
    await newEventRef.set(firestoreWriteData);
    
    const docSnap = await newEventRef.get();
    if (!docSnap.exists) return null; 

    const fetchedData = docSnap.data();
    if (!fetchedData) return null;

    const clientEventData: EventData = {
      id: docSnap.id,
      name: fetchedData.name,
      date: timestampToIsoString(fetchedData.date as Timestamp)!,
      time: fetchedData.time,
      location: fetchedData.location,
      description: fetchedData.description,
      mood: fetchedData.mood,
      eventImagePath: fetchedData.eventImagePath,
      seatLimit: fetchedData.seatLimit,
      confirmedGuestsCount: fetchedData._confirmedGuestsCount ?? 0,
      organizerEmail: fetchedData.organizerEmail,
      isPublic: fetchedData.isPublic ?? false,
      publicRsvpLink: fetchedData.publicRsvpLink,
      createdAt: timestampToIsoString(fetchedData.createdAt as Timestamp),
      updatedAt: timestampToIsoString(fetchedData.updatedAt as Timestamp),
    };
    
    return convertTimestampsInObj(clientEventData);

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
    const firestoreData = docSnap.data();
    if (!firestoreData) return null;
    
    let actualConfirmedCount = 0;
    // Prefer _confirmedGuestsCount (with underscore)
    if (typeof firestoreData._confirmedGuestsCount === 'number') {
      actualConfirmedCount = firestoreData._confirmedGuestsCount;
    } else if (typeof firestoreData.confirmedGuestsCount === 'number') { 
      // Fallback for data that might have 'confirmedGuestsCount' (no underscore)
      actualConfirmedCount = firestoreData.confirmedGuestsCount;
      console.warn(`Event ${id} is using 'confirmedGuestsCount' field. Standard is '_confirmedGuestsCount'. Data read successfully.`);
    } else {
      console.warn(`_confirmedGuestsCount (and confirmedGuestsCount) not found for event ${id}, calculating from invitations.`);
      const invitationsSnap = await db.collection(INVITATIONS_COLLECTION)
        .where('eventId', '==', id)
        .where('status', '==', 'confirmed')
        .count()
        .get();
      actualConfirmedCount = invitationsSnap.data().count;
      // Optionally, update _confirmedGuestsCount in Firestore here if it was missing
      // await docRef.update({ _confirmedGuestsCount: actualConfirmedCount, updatedAt: FieldValue.serverTimestamp() });
    }
    
    const clientEventData: EventData = {
        id: docSnap.id,
        name: firestoreData.name,
        date: timestampToIsoString(firestoreData.date as Timestamp)!, 
        time: firestoreData.time,
        location: firestoreData.location,
        description: firestoreData.description,
        mood: firestoreData.mood,
        eventImagePath: firestoreData.eventImagePath,
        seatLimit: firestoreData.seatLimit,
        confirmedGuestsCount: actualConfirmedCount,
        organizerEmail: firestoreData.organizerEmail,
        isPublic: firestoreData.isPublic ?? false,
        publicRsvpLink: firestoreData.publicRsvpLink,
        createdAt: timestampToIsoString(firestoreData.createdAt as Timestamp),
        updatedAt: timestampToIsoString(firestoreData.updatedAt as Timestamp),
    };

    return convertTimestampsInObj(clientEventData);
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
    const uniqueToken = randomUUID(); 
    const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(); 
    const newInvitation: Omit<InvitationData, 'id' | 'createdAt' | 'updatedAt' | 'rsvpAt'> & { createdAt: any, updatedAt: any } = {
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
    createdInvitations.push({ 
        ...newInvitation, 
        id: invitationRef.id, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        rsvpAt: null,
        visited: false, // Ensure visited is part of the returned object immediately
    });
  }

  try {
    await batch.commit();
    // Fetch the created invitations to get server-generated timestamps
    const fetchedInvitations: InvitationData[] = [];
    for (const guestData of createdInvitations) { // Use the temporary client-side createdInvitations to find docs
        // This is a simplification. In a real scenario, you might query by a batch ID or fetch docs individually if IDs are known.
        // For now, we'll assume the client-side constructed object is good enough for immediate return if timestamps are handled by convertTimestampsInObj.
        // To get actual server timestamps, you'd need to re-fetch.
        // This example assumes the data structure is largely correct and relies on `convertTimestampsInObj` for any server-generated TS.
         const docSnap = await db.collection(INVITATIONS_COLLECTION).doc(guestData.id).get();
         if (docSnap.exists) {
            fetchedInvitations.push(convertTimestampsInObj({ id: docSnap.id, ...docSnap.data() } as InvitationData));
         } else {
            // Fallback to the initially constructed object if fetch fails (less ideal)
            fetchedInvitations.push(convertTimestampsInObj(guestData));
         }
    }
    return fetchedInvitations; 
  } catch (error) {
    console.error("Error creating invitations in batch:", error);
    throw error; 
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
      await docSnap.ref.update({ 
        visited: true, 
        updatedAt: FieldValue.serverTimestamp() 
      });
      invitation.visited = true; 
      invitation.updatedAt = new Date().toISOString(); 
    }
    
    return convertTimestampsInObj(invitation);
  } catch (error) {
    console.error(`Error fetching invitation by token ${token}:`, error);
    return null;
  }
}

export async function updateInvitationRsvp(
  uniqueToken: string, 
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
      const invitationDataFromDb = invitationSnapshot.docs[0].data() as Omit<InvitationData, 'id' | 'createdAt' | 'updatedAt' | 'rsvpAt'> & { createdAt: Timestamp, updatedAt: Timestamp, rsvpAt?: Timestamp | null };


      const eventRef = db.collection(EVENTS_COLLECTION).doc(invitationDataFromDb.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found for this invitation.');
      }
      const eventDataFromDb = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date'> & { _confirmedGuestsCount?: number, createdAt: Timestamp, updatedAt: Timestamp, date: Timestamp };
      
      const oldStatus = invitationDataFromDb.status;
      let currentConfirmedGuestCount = eventDataFromDb._confirmedGuestsCount ?? 0;

      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (eventDataFromDb.seatLimit > 0 && currentConfirmedGuestCount >= eventDataFromDb.seatLimit) {
          throw new Error('Sorry, the event is currently full.');
        }
      }
      
      const updateDataForInvitation: Partial<InvitationData> & { updatedAt: any, rsvpAt: any } = {
        guestName: name,
        guestEmail: email,
        status: status as RsvpStatus,
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateDataForInvitation);

      let newConfirmedGuestCount = currentConfirmedGuestCount;
      if (oldStatus !== status) {
        if (status === 'confirmed') {
          newConfirmedGuestCount++;
        } else if (oldStatus === 'confirmed' && status === 'declining') {
          newConfirmedGuestCount = Math.max(0, newConfirmedGuestCount - 1); 
        }
        // Only update _confirmedGuestsCount if it changed.
        if (newConfirmedGuestCount !== currentConfirmedGuestCount) {
           transaction.update(eventRef, { _confirmedGuestsCount: newConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
        }
      }
      
      const reservationQuery = db.collection(RESERVATIONS_COLLECTION)
                                 .where('invitationId', '==', invitationRef.id) 
                                 .limit(1);
      const reservationSnap = await transaction.get(reservationQuery);

      if (status === 'confirmed') {
        if (reservationSnap.empty) {
          const newReservationRef = db.collection(RESERVATIONS_COLLECTION).doc();
          transaction.set(newReservationRef, {
            id: newReservationRef.id,
            invitationId: invitationRef.id, 
            eventId: invitationDataFromDb.eventId,
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
      
      const returnedInvitation: InvitationData = {
        ...(convertTimestampsInObj({ ...invitationDataFromDb, id: invitationRef.id })), 
        ...updateDataForInvitation, 
        rsvpAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(), 
      };
      return returnedInvitation;
    });
    
    return { success: true, message: 'RSVP updated successfully.', invitation: result };

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
    if (!event) {
        console.warn(`getEventStats: Event ${eventId} not found.`);
        return null;
    }

    const statuses: RsvpStatus[] = ['pending', 'declined', 'waitlisted']; 
    const counts: { [key in RsvpStatus]?: number } = {};

    const invitationsQuery = db.collection(INVITATIONS_COLLECTION).where('eventId', '==', eventId);
    
    for (const status of statuses) {
        const countSnapshot = await invitationsQuery.where('status', '==', status).count().get();
        counts[status] = countSnapshot.data().count;
    }
    
    const totalSeats = event.seatLimit <= 0 ? Infinity : event.seatLimit;
    // Use event.confirmedGuestsCount directly as it's now reliably fetched by getEventById
    const availableSeats = totalSeats === Infinity ? Infinity : Math.max(0, totalSeats - event.confirmedGuestsCount);

    return {
      confirmed: event.confirmedGuestsCount,
      pending: counts.pending ?? 0,
      declined: counts.declined ?? 0,
      waitlisted: counts.waitlisted ?? 0,
      totalSeats: event.seatLimit, 
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
    const reservationDataForDb = {
      id: newReservationRef.id,
      invitationId,
      eventId,
      reservationTime: FieldValue.serverTimestamp(),
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await newReservationRef.set(reservationDataForDb);
    const newReservationSnap = await newReservationRef.get(); 
    const fetchedData = newReservationSnap.data();
    if (!fetchedData) return null;
    
    return convertTimestampsInObj({ 
        id: newReservationSnap.id, 
        ...fetchedData 
    } as ReservationData); 
  } catch (error) {
    console.error(`Error creating reservation for invitation ${invitationId}:`, error);
    return null;
  }
}

// --- Email Log Functions ---
export async function createEmailLog(
  logEntry: Omit<EmailLogData, 'id' | 'createdAt' | 'sentAt'> & { sentAt?: any } // sentAt can be FieldValue or null
): Promise<EmailLogData | null> {
  try {
    const newLogRef = db.collection(EMAIL_LOGS_COLLECTION).doc();
    const logDataForDb = {
      ...logEntry,
      id: newLogRef.id,
      sentAt: logEntry.sentAt === null ? null : (logEntry.sentAt || FieldValue.serverTimestamp()), // Allow explicit null or default to server TS
      createdAt: FieldValue.serverTimestamp(), 
    };
    await newLogRef.set(logDataForDb);
    const newLogSnap = await newLogRef.get();
    const fetchedData = newLogSnap.data();
    if(!fetchedData) return null;

    return convertTimestampsInObj({ 
        id: newLogSnap.id, 
        ...fetchedData 
    } as EmailLogData); 
  } catch (error) {
    console.error(`Error creating email log for invitation ${logEntry.invitationId}:`, error);
    return null;
  }
}

