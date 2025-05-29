
import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj, type FirestoreTimestampType } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString, EventMood, GuestInput, EmailStatus } from '@/types';
import { randomUUID } from 'crypto';


const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations'; // Not fully utilized yet
const EMAIL_LOGS_COLLECTION = 'emailLogs';

// --- Event Functions ---

export async function getMostRecentEventIdForUser(userId: string): Promise<string | null> {
  try {
    const snapshot = await db.collection(EVENTS_COLLECTION)
      .where('creatorId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`No events found for user ${userId}.`);
      return null;
    }
    // Firestore composite index missing for `getMostRecentEventIdForUser`. Please create it in the Firebase console.
    // Required index: events collection, creatorId ASC, createdAt DESC
    return snapshot.docs[0].id;
  } catch (error: any) {
    console.error(`Error fetching most recent event ID for user ${userId}:`, error.message);
    if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getMostRecentEventIdForUser` on `events` collection: `creatorId` (Ascending), `createdAt` (Descending). Please create it in the Firebase console. Link: " + error.details);
    }
    return null;
  }
}

export async function createEvent(eventDataInput: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'>): Promise<EventData | null> {
  try {
    const newEventRef = db.collection(EVENTS_COLLECTION).doc();
    
    const finalFirestoreWriteData = {
      ...eventDataInput, 
      id: newEventRef.id, // Store doc ID within the document
      date: Timestamp.fromDate(new Date(eventDataInput.date)), 
      eventImagePath: eventDataInput.eventImagePath || null, // Ensure null if not provided
      organizerEmail: eventDataInput.organizerEmail || null, // Ensure null if not provided
      _confirmedGuestsCount: 0, // Initialize confirmed count
      isPublic: eventDataInput.isPublic ?? false, 
      publicRsvpLink: eventDataInput.publicRsvpLink || null, 
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await newEventRef.set(finalFirestoreWriteData);
    
    const docSnap = await newEventRef.get();
    if (!docSnap.exists) {
        console.error("Failed to find event document immediately after creation:", newEventRef.id);
        return null;
    }

    const fetchedData = docSnap.data();
    if (!fetchedData) {
        console.error("Event document data is empty after creation:", newEventRef.id);
        return null;
    }
    
    const clientEventData: EventData = {
      id: docSnap.id,
      creatorId: fetchedData.creatorId,
      name: fetchedData.name,
      date: timestampToIsoString(fetchedData.date as FirestoreTimestampType)!,
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
      createdAt: timestampToIsoString(fetchedData.createdAt as FirestoreTimestampType),
      updatedAt: timestampToIsoString(fetchedData.updatedAt as FirestoreTimestampType),
    };
    
    return convertTimestampsInObj(clientEventData);

  } catch (error) {
    console.error("Error creating event in db.ts:", error);
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
    if (typeof firestoreData._confirmedGuestsCount === 'number') {
      actualConfirmedCount = firestoreData._confirmedGuestsCount;
    } else if (typeof firestoreData.confirmedGuestsCount === 'number') { // Legacy check
      actualConfirmedCount = firestoreData.confirmedGuestsCount;
      console.warn(`Event ${id} is using legacy 'confirmedGuestsCount' field. Standard is '_confirmedGuestsCount'. Data read successfully, but consider migration.`);
    } else {
      console.warn(`_confirmedGuestsCount (and confirmedGuestsCount) not found for event ${id}, calculating from invitations.`);
      const invitationsSnap = await db.collection(INVITATIONS_COLLECTION)
        .where('eventId', '==', id)
        .where('status', '==', 'confirmed')
        .count()
        .get();
      actualConfirmedCount = invitationsSnap.data().count;
    }
    
    const clientEventData: EventData = {
        id: docSnap.id,
        creatorId: firestoreData.creatorId,
        name: firestoreData.name,
        date: timestampToIsoString(firestoreData.date as FirestoreTimestampType)!, 
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
        createdAt: timestampToIsoString(firestoreData.createdAt as FirestoreTimestampType),
        updatedAt: timestampToIsoString(firestoreData.updatedAt as FirestoreTimestampType),
    };

    return convertTimestampsInObj(clientEventData);
  } catch (error) {
    console.error(`Error fetching event ${id}:`, error);
    return null;
  }
}


export async function updateEventPublicStatus(eventId: string, publicRsvpToken: string): Promise<boolean> {
  try {
    const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
    await eventRef.update({
      isPublic: true,
      publicRsvpLink: publicRsvpToken, 
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error(`Error updating public status for event ${eventId}:`, error);
    return false;
  }
}

export async function getPublicEvents(): Promise<EventData[]> {
  try {
    const snapshot = await db.collection(EVENTS_COLLECTION)
      .where('isPublic', '==', true)
      .orderBy('date', 'desc') 
      .get();
      
    // Firestore composite index missing for `getPublicEvents`. Please create it in the Firebase console.
    // Required index: events collection, isPublic ASC, date DESC

    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as EventData));
  } catch (error: any) {
    console.error("Error fetching public events:", error.message);
     if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getPublicEvents` on `events` collection: `isPublic` (Ascending), `date` (Descending). Please create it in the Firebase console. Link: " + error.details);
    }
    return [];
  }
}

export async function getEventByPublicLinkToken(token: string): Promise<EventData | null> {
    // Assuming token is the eventId for public links for now
    return getEventById(token); 
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
      guestEmail: guest.email.toLowerCase(), // Normalize email
      status: 'pending',
      originalGuestName: guest.name,
      originalGuestEmail: guest.email.toLowerCase(), // Normalize email
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
        visited: false, 
    });
  }

  try {
    await batch.commit();
    const fetchedInvitations: InvitationData[] = [];
    for (const guestData of createdInvitations) { 
         const docSnap = await db.collection(INVITATIONS_COLLECTION).doc(guestData.id).get();
         if (docSnap.exists) {
            fetchedInvitations.push(convertTimestampsInObj({ id: docSnap.id, ...docSnap.data() } as InvitationData));
         } else {
            console.warn(`Invitation ${guestData.id} not immediately found after batch commit. Using optimistic data.`);
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
      const invitationDataFromDb = { id: invitationRef.id, ...invitationSnapshot.docs[0].data()} as InvitationData;


      const eventRef = db.collection(EVENTS_COLLECTION).doc(invitationDataFromDb.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found for this invitation.');
      }
      const eventDataFromDb = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType };
      
      const oldStatus = invitationDataFromDb.status;
      let currentConfirmedGuestCount = eventDataFromDb._confirmedGuestsCount ?? 0;
      let finalStatus: RsvpStatus = status;

      // Logic for confirming or waitlisting
      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (eventDataFromDb.seatLimit > 0 && currentConfirmedGuestCount >= eventDataFromDb.seatLimit) {
          finalStatus = 'waitlisted'; // Event is full, so waitlist
          // Do not increment confirmed guest count for waitlisted
        } else {
          // Space available, confirm the guest
          currentConfirmedGuestCount++;
        }
      } else if (status === 'declining' && oldStatus === 'confirmed') {
        currentConfirmedGuestCount = Math.max(0, currentConfirmedGuestCount - 1);
      }
      
      const updateDataForInvitation: Partial<Omit<InvitationData, 'id' | 'createdAt'>> & { updatedAt: any, rsvpAt: any } = {
        guestName: name, 
        guestEmail: email.toLowerCase(), 
        status: finalStatus,
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateDataForInvitation);

      // Only update event's confirmed count if it actually changed
      if (currentConfirmedGuestCount !== (eventDataFromDb._confirmedGuestsCount ?? 0)) {
         transaction.update(eventRef, { _confirmedGuestsCount: currentConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
      }
      
      const reservationQuery = db.collection(RESERVATIONS_COLLECTION)
                                 .where('invitationId', '==', invitationRef.id) 
                                 .limit(1);
      const reservationSnap = await transaction.get(reservationQuery);

      if (finalStatus === 'confirmed') {
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
      } else if (finalStatus === 'declining' || finalStatus === 'waitlisted') { // Remove reservation if declining or waitlisted (waitlist implies no confirmed seat yet)
        if (!reservationSnap.empty) {
          transaction.delete(reservationSnap.docs[0].ref);
        }
      }
      
      const returnedInvitation: InvitationData = convertTimestampsInObj({
        ...invitationDataFromDb,
        ...updateDataForInvitation,
        status: finalStatus, // ensure the final status is part of the returned object
        rsvpAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(), 
      });
      return returnedInvitation;
    });
    
    let message = 'RSVP updated successfully.';
    if (result.status === 'waitlisted') {
      message = 'The event is currently full. You have been added to the waitlist.';
    } else if (result.status === 'confirmed') {
      message = 'Thank you for confirming your attendance!';
    } else if (result.status === 'declining') {
      message = 'Your RSVP (declined) has been recorded. Thank you!';
    }
    return { success: true, message: message, invitation: result };

  } catch (error: any) {
    console.error('Error updating RSVP:', error);
    return { success: false, message: error.message || 'Failed to update RSVP. Please try again.' };
  }
}

export async function createPublicRsvpInvitation(
  eventId: string,
  guestName: string,
  guestEmail: string
): Promise<{ success: boolean; message: string; invitation?: InvitationData | null }> {
  
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);

  try {
    const newInvitationData = await db.runTransaction(async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found.');
      }
      const eventData = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date' | 'creatorId'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType, creatorId: string };

      let rsvpStatus: RsvpStatus = 'confirmed';
      let confirmedGuestsIncrement = 1;

      if (eventData.seatLimit > 0 && (eventData._confirmedGuestsCount ?? 0) >= eventData.seatLimit) {
        rsvpStatus = 'waitlisted';
        confirmedGuestsIncrement = 0; // Don't increment confirmed count if waitlisted
      }

      const uniqueToken = randomUUID();
      const newInvitationRef = db.collection(INVITATIONS_COLLECTION).doc();
      
      const newInvitationDocData = {
        uniqueToken,
        eventId,
        guestName,
        guestEmail: guestEmail.toLowerCase(), // Normalize email
        status: rsvpStatus,
        visited: true, 
        originalGuestName: guestName,
        originalGuestEmail: guestEmail.toLowerCase(), // Normalize email
        rsvpAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      transaction.set(newInvitationRef, newInvitationDocData);

      if (confirmedGuestsIncrement > 0) {
        transaction.update(eventRef, {
          _confirmedGuestsCount: FieldValue.increment(confirmedGuestsIncrement),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        // If waitlisted, just update the event's updatedAt timestamp
        transaction.update(eventRef, { updatedAt: FieldValue.serverTimestamp() });
      }
      
      const createdInvitationForClient: InvitationData = {
        id: newInvitationRef.id,
        ...newInvitationDocData,
        status: rsvpStatus, 
        rsvpAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return createdInvitationForClient;
    });
    
    const message = newInvitationData.status === 'confirmed' 
      ? "RSVP successful! You're confirmed." 
      : "Thank you! The event is currently full, but you've been added to the waitlist.";
    return { success: true, message: message, invitation: newInvitationData };

  } catch (error: any) {
    console.error('Error creating public RSVP invitation:', error);
    return { success: false, message: error.message || "Failed to process public RSVP." };
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
      
    // Firestore composite index missing for `getAllInvitationsForEvent`. Please create it in the Firebase console.
    // Required index: invitations collection, eventId ASC, createdAt DESC

    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as InvitationData));
  } catch (error: any) {
    console.error(`Error fetching all invitations for event ${eventId}:`, error.message);
     if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getAllInvitationsForEvent` on `invitations` collection: `eventId` (Ascending), `createdAt` (Descending). Please create it in the Firebase console. Link: " + error.details);
    }
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

    // Get counts for pending, declined, and waitlisted directly from queries
    const pendingSnapshot = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .where('status', '==', 'pending')
      .count().get();
    const declinedSnapshot = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .where('status', '==', 'declining')
      .count().get();
    const waitlistedSnapshot = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .where('status', '==', 'waitlisted')
      .count().get();
    
    const totalSeats = event.seatLimit <= 0 ? Infinity : event.seatLimit;
    // availableSeats is primarily relevant for new confirmations. 
    // The confirmedGuestsCount from the event object is the source of truth for confirmed.
    const availableSeats = totalSeats === Infinity ? Infinity : Math.max(0, totalSeats - event.confirmedGuestsCount);

    return {
      confirmed: event.confirmedGuestsCount,
      pending: pendingSnapshot.data().count,
      declined: declinedSnapshot.data().count,
      waitlisted: waitlistedSnapshot.data().count,
      totalSeats: event.seatLimit <= 0 ? 0 : event.seatLimit, // 0 represents unlimited for display simplicity
      availableSeats: availableSeats,
    };
  } catch (error) {
    console.error(`Error fetching event stats for ${eventId}:`, error);
    return null;
  }
}

// --- Email Log Functions ---
export async function createEmailLog(
  logEntry: Omit<EmailLogData, 'id' | 'createdAt' | 'sentAt'> & { sentAt?: any } 
): Promise<EmailLogData | null> {
  try {
    const newLogRef = db.collection(EMAIL_LOGS_COLLECTION).doc();
    const logDataForDb = {
      ...logEntry,
      id: newLogRef.id,
      sentAt: logEntry.sentAt === null ? null : (logEntry.sentAt || FieldValue.serverTimestamp()), 
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

// --- User Profile Functions (example, can be expanded) ---
export async function getUserProfile(userId: string) {
  const profileRef = db.collection('userProfiles').doc(userId);
  const doc = await profileRef.get();
  if (!doc.exists) return null;
  return convertTimestampsInObj({ id: doc.id, ...doc.data() });
}

// Firestore composite index creation reminders (add these as comments where queries are made if not auto-detected by Firebase Extensions)
// 1. For getMostRecentEventIdForUser: Collection 'events', fields: creatorId (ASC), createdAt (DESC)
// 2. For getPublicEvents: Collection 'events', fields: isPublic (ASC), date (DESC)
// 3. For getAllInvitationsForEvent: Collection 'invitations', fields: eventId (ASC), createdAt (DESC)
// 4. For getEventStats (individual status counts): Separate indexes for (eventId, status) are usually auto-created or single-field indexes suffice.
//    If combining status with another orderBy, then a composite index might be needed.
