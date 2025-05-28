
import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj, type FirestoreTimestampType } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString, EventMood, GuestInput, EmailStatus } from '@/types';
import { randomUUID } from 'crypto';


const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations';
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
    return snapshot.docs[0].id;
  } catch (error: any) {
    console.error(`Error fetching most recent event ID for user ${userId}:`, error.message);
    if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getMostRecentEventIdForUser`. Please create it in the Firebase console. Link: " + error.details);
    }
    return null;
  }
}

export async function createEvent(eventDataInput: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'>): Promise<EventData | null> {
  try {
    const newEventRef = db.collection(EVENTS_COLLECTION).doc();
    
    const finalFirestoreWriteData = {
      ...eventDataInput, // Includes creatorId
      id: newEventRef.id,
      name: eventDataInput.name,
      description: eventDataInput.description,
      date: Timestamp.fromDate(new Date(eventDataInput.date)), 
      time: eventDataInput.time,
      location: eventDataInput.location,
      mood: eventDataInput.mood,
      seatLimit: eventDataInput.seatLimit,
      eventImagePath: eventDataInput.eventImagePath || null,
      organizerEmail: eventDataInput.organizerEmail || null,
      _confirmedGuestsCount: 0,
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
      console.warn(`Event ${id} is using 'confirmedGuestsCount' field. Standard is '_confirmedGuestsCount'. Data read successfully, but consider migration.`);
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
      
    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as EventData));
  } catch (error: any) {
    console.error("Error fetching public events:", error.message);
     if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getPublicEvents`. Please create it in the Firebase console. Link: " + error.details);
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
      guestEmail: guest.email,
      status: 'pending',
      originalGuestName: guest.name,
      originalGuestEmail: guest.email,
      visited: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(invitationRef, newInvitation);
    // For optimistic client update, create an object that matches InvitationData structure
    createdInvitations.push({ 
        ...newInvitation, 
        id: invitationRef.id, 
        createdAt: new Date().toISOString(), // Approximate for immediate use
        updatedAt: new Date().toISOString(), // Approximate for immediate use
        rsvpAt: null, // Not RSVP'd yet
        visited: false, // Not visited yet
    });
  }

  try {
    await batch.commit();
    // After commit, re-fetch to get actual server timestamps for better accuracy client-side if needed
    // Or trust the optimistic data with approximate timestamps for speed.
    // For simplicity, returning the optimistic data. If precise timestamps are critical on client immediately, a re-fetch loop here is an option.
    const fetchedInvitations: InvitationData[] = [];
    for (const guestData of createdInvitations) { // Use the createdInvitations array which has IDs
         const docSnap = await db.collection(INVITATIONS_COLLECTION).doc(guestData.id).get();
         if (docSnap.exists) {
            fetchedInvitations.push(convertTimestampsInObj({ id: docSnap.id, ...docSnap.data() } as InvitationData));
         } else {
            // This case should be rare if batch commit was successful
            console.warn(`Invitation ${guestData.id} not immediately found after batch commit. Using optimistic data.`);
            fetchedInvitations.push(convertTimestampsInObj(guestData)); // Use the data we constructed
         }
    }
    return fetchedInvitations; 
  } catch (error) {
    console.error("Error creating invitations in batch:", error);
    throw error; // Re-throw to be caught by the calling server action
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

    // Mark as visited if not already
    if (!invitation.visited) {
      await docSnap.ref.update({ 
        visited: true, 
        updatedAt: FieldValue.serverTimestamp() 
      });
      invitation.visited = true; // Update the object we're returning too
      invitation.updatedAt = new Date().toISOString(); // Approximate for immediate client use
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
      const invitationDataFromDb = invitationSnapshot.docs[0].data() as Omit<InvitationData, 'id' | 'createdAt' | 'updatedAt' | 'rsvpAt'> & { createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, rsvpAt?: FirestoreTimestampType | null };


      const eventRef = db.collection(EVENTS_COLLECTION).doc(invitationDataFromDb.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found for this invitation.');
      }
      const eventDataFromDb = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType };
      
      const oldStatus = invitationDataFromDb.status;
      let currentConfirmedGuestCount = eventDataFromDb._confirmedGuestsCount ?? 0;

      // Check seat limit if confirming
      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (eventDataFromDb.seatLimit > 0 && currentConfirmedGuestCount >= eventDataFromDb.seatLimit) {
          // TODO: Implement waitlisting logic instead of throwing error
          // For now, if event is full, prevent confirmation.
          throw new Error('Sorry, the event is currently full.');
        }
      }
      
      // Update invitation details
      const updateDataForInvitation: Partial<InvitationData> & { updatedAt: any, rsvpAt: any } = {
        guestName: name, // Update name if it was changed in the form
        guestEmail: email, // Update email if it was changed
        status: status as RsvpStatus,
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateDataForInvitation);

      // Update event's confirmed guest count if status changed
      let newConfirmedGuestCount = currentConfirmedGuestCount;
      if (oldStatus !== status) {
        if (status === 'confirmed') {
          newConfirmedGuestCount++;
        } else if (oldStatus === 'confirmed' && status === 'declining') {
          newConfirmedGuestCount = Math.max(0, newConfirmedGuestCount - 1); // Ensure count doesn't go below 0
        }
        
        // Only update if the count actually changed
        if (newConfirmedGuestCount !== currentConfirmedGuestCount) {
           transaction.update(eventRef, { _confirmedGuestsCount: newConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
        }
      }
      
      // Handle reservations (simplified: create/update on confirm, delete on decline)
      const reservationQuery = db.collection(RESERVATIONS_COLLECTION)
                                 .where('invitationId', '==', invitationRef.id) // Assuming invitationRef.id is the Firestore doc ID
                                 .limit(1);
      const reservationSnap = await transaction.get(reservationQuery);

      if (status === 'confirmed') {
        if (reservationSnap.empty) {
          const newReservationRef = db.collection(RESERVATIONS_COLLECTION).doc();
          transaction.set(newReservationRef, {
            id: newReservationRef.id, // Store doc ID within document
            invitationId: invitationRef.id, // Link to invitation document ID
            eventId: invitationDataFromDb.eventId,
            reservationTime: FieldValue.serverTimestamp(),
            status: 'confirmed', // or 'waitlisted' based on future logic
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
           // If reservation exists, ensure its status is 'confirmed'
           transaction.update(reservationSnap.docs[0].ref, { status: 'confirmed', updatedAt: FieldValue.serverTimestamp() });
        }
      } else if (status === 'declining') {
        if (!reservationSnap.empty) {
          // If declining, we can remove the reservation document
          transaction.delete(reservationSnap.docs[0].ref);
        }
      }
      
      // Construct the InvitationData object to return
      const returnedInvitation: InvitationData = {
        ...(convertTimestampsInObj({ ...invitationDataFromDb, id: invitationRef.id })), // Convert existing timestamps
        ...updateDataForInvitation, // Spread the updates
        rsvpAt: new Date().toISOString(), // Approximate for immediate client use
        updatedAt: new Date().toISOString(), // Approximate for immediate client use
      };
      return returnedInvitation;
    });
    
    return { success: true, message: 'RSVP updated successfully.', invitation: result };

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


      if (eventData.seatLimit > 0 && (eventData._confirmedGuestsCount ?? 0) >= eventData.seatLimit) {
        // TODO: Future: Implement waitlisting for public RSVP
        throw new Error('Sorry, the event is currently full.');
      }

      const uniqueToken = randomUUID();
      const newInvitationRef = db.collection(INVITATIONS_COLLECTION).doc();
      
      const newInvitationDocData = {
        uniqueToken,
        eventId,
        guestName,
        guestEmail,
        status: 'confirmed' as RsvpStatus, // Public RSVPs are directly confirmed
        visited: true, // They are visiting the link to RSVP
        originalGuestName: guestName,
        originalGuestEmail: guestEmail,
        rsvpAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      transaction.set(newInvitationRef, newInvitationDocData);

      transaction.update(eventRef, {
        _confirmedGuestsCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      const createdInvitationForClient: InvitationData = {
        id: newInvitationRef.id,
        ...newInvitationDocData,
        status: 'confirmed', 
        rsvpAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return createdInvitationForClient;
    });

    return { success: true, message: "RSVP successful! You're confirmed.", invitation: newInvitationData };

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
      
    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as InvitationData));
  } catch (error: any) {
    console.error(`Error fetching all invitations for event ${eventId}:`, error.message);
     if (error.code === 9 && error.message.includes("requires an index")) { 
      console.error("Firestore composite index missing for `getAllInvitationsForEvent`. Please create it in the Firebase console. Link: " + error.details);
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

    const statuses: RsvpStatus[] = ['pending', 'declined', 'waitlisted']; 
    const counts: { [key in RsvpStatus]?: number } = {};

    const invitationsQuery = db.collection(INVITATIONS_COLLECTION).where('eventId', '==', eventId);
    
    for (const status of statuses) {
        const countSnapshot = await invitationsQuery.where('status', '==', status).count().get();
        counts[status] = countSnapshot.data().count;
    }
    
    const totalSeats = event.seatLimit <= 0 ? Infinity : event.seatLimit;
    const availableSeats = totalSeats === Infinity ? Infinity : Math.max(0, totalSeats - event.confirmedGuestsCount);

    return {
      confirmed: event.confirmedGuestsCount, // This is now consistently from getEventById
      pending: counts.pending ?? 0,
      declined: counts.declined ?? 0,
      waitlisted: counts.waitlisted ?? 0,
      totalSeats: event.seatLimit <= 0 ? 0 : event.seatLimit, 
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
