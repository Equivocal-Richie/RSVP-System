
import { db, FieldValue, Timestamp, timestampToIsoString, convertTimestampsInObj, type FirestoreTimestampType } from './firebaseAdmin';
import type { EventData, InvitationData, RsvpStats, ReservationData, EmailLogData, RsvpStatus, TimestampString, EventMood, GuestInput, EmailStatus, EventFeedbackData } from '@/types';
import { randomUUID } from 'crypto';


const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'invitations';
const RESERVATIONS_COLLECTION = 'reservations';
const EMAIL_LOGS_COLLECTION = 'emailLogs';
const USER_PROFILES_COLLECTION = 'userProfiles';
const EVENT_FEEDBACK_COLLECTION = 'eventFeedback';


export async function getMostRecentEventIdForUser(userId: string): Promise<string | null> {
  if (!userId) return null;
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
    // Firestore composite index for `getMostRecentEventIdForUser`:
    // Collection: `events`, Fields: `creatorId` (Ascending), `createdAt` (Descending)
    return snapshot.docs[0].id;
  } catch (error: any) {
    console.error(`Error fetching most recent event ID for user ${userId}:`, error.message);
    if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getMostRecentEventIdForUser` on `events` collection. Required: `creatorId` (Ascending), `createdAt` (Descending). Please create this index in the Firebase console.");
    }
    return null;
  }
}

export async function createEvent(eventDataInput: Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'>): Promise<EventData | null> {
  try {
    const newEventRef = db.collection(EVENTS_COLLECTION).doc();

    const finalFirestoreWriteData = {
      ...eventDataInput,
      id: newEventRef.id,
      date: Timestamp.fromDate(new Date(eventDataInput.date)),
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
    } else if (typeof firestoreData.confirmedGuestsCount === 'number') { // fallback for old data
      actualConfirmedCount = firestoreData.confirmedGuestsCount;
    } else {
      console.warn(`_confirmedGuestsCount not found or invalid for event ${id}, calculating from invitations as a fallback.`);
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

export async function getAllEventsForUser(userId: string): Promise<EventData[]> {
  if (!userId) return [];
  try {
    const snapshot = await db.collection(EVENTS_COLLECTION)
      .where('creatorId', '==', userId)
      .orderBy('date', 'desc') // Order by event date, most recent first
      .get();

    // Firestore composite index for `getAllEventsForUser`:
    // Collection: `events`, Fields: `creatorId` (Ascending), `date` (Descending)

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const confirmedGuestsCount = typeof data._confirmedGuestsCount === 'number' ? data._confirmedGuestsCount : 0;
        return convertTimestampsInObj({ id: doc.id, ...data, confirmedGuestsCount } as EventData);
    });
  } catch (error: any) {
    console.error(`Error fetching all events for user ${userId}:`, error.message);
    if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getAllEventsForUser` on `events` collection. Required: `creatorId` (Ascending), `date` (Descending). Please create this index in the Firebase console.");
    }
    return [];
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

    // Firestore composite index for `getPublicEvents`:
    // Collection: `events`, Fields: `isPublic` (Ascending), `date` (Descending)

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const confirmedGuestsCount = typeof data._confirmedGuestsCount === 'number' ? data._confirmedGuestsCount : 0;
        return convertTimestampsInObj({ id: doc.id, ...data, confirmedGuestsCount } as EventData);
    });
  } catch (error: any) {
    console.error("Error fetching public events:", error.message);
     if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getPublicEvents` on `events` collection. Required: `isPublic` (Ascending), `date` (Descending). Please create this index in the Firebase console.");
    }
    return [];
  }
}

export async function getEventByPublicLinkToken(token: string): Promise<EventData | null> {
    // Assuming publicRsvpLink token is the eventId itself for public events
    return getEventById(token);
}


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
      guestEmail: guest.email.toLowerCase(), // Store email in lowercase
      status: 'pending',
      originalGuestName: guest.name,
      originalGuestEmail: guest.email.toLowerCase(),
      isPublicOrigin: false, // Explicitly false for non-public invitations
      visited: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(invitationRef, newInvitation);

    // Optimistic data for immediate return, timestamps will be server-generated
    createdInvitations.push({
        ...newInvitation,
        id: invitationRef.id,
        createdAt: new Date().toISOString(), // Placeholder
        updatedAt: new Date().toISOString(), // Placeholder
        rsvpAt: null,
        visited: false, // Will be false initially
    });
  }

  try {
    await batch.commit();
    // For more accuracy, re-fetch or construct with known server values if needed,
    // but optimistic return is often fine for UI updates.
    // For this example, we'll return the optimistically created ones and then fetch them properly to ensure server timestamps
    const fetchedInvitations: InvitationData[] = [];
    for (const guestData of createdInvitations) {
         const docSnap = await db.collection(INVITATIONS_COLLECTION).doc(guestData.id).get();
         if (docSnap.exists) {
            fetchedInvitations.push(convertTimestampsInObj({ id: docSnap.id, ...docSnap.data() } as InvitationData));
         } else {
            // This case should ideally not happen if batch commit was successful
            console.warn(`Invitation ${guestData.id} not immediately found after batch commit. Using optimistic data.`);
            fetchedInvitations.push(convertTimestampsInObj(guestData)); // Fallback to optimistic data
         }
    }
    return fetchedInvitations;
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

    // Update visited status if it's the first time
    if (!invitation.visited) {
      await docSnap.ref.update({
        visited: true,
        updatedAt: FieldValue.serverTimestamp() // Also update 'updatedAt'
      });
      invitation.visited = true; // Reflect change in returned object
      invitation.updatedAt = new Date().toISOString(); // Optimistic update for returned object
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
  const normalizedEmail = email.toLowerCase();

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
      // Cast event data with _confirmedGuestsCount
      const eventDataFromDb = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType };


      const oldStatus = invitationDataFromDb.status;
      let currentConfirmedGuestCount = eventDataFromDb._confirmedGuestsCount ?? 0; // Default to 0 if undefined
      let finalStatus: RsvpStatus = status;

      if (status === 'confirmed' && oldStatus !== 'confirmed') {
        if (eventDataFromDb.seatLimit > 0 && currentConfirmedGuestCount >= eventDataFromDb.seatLimit) {
          // Event is full, move to waitlist if not already confirmed.
          // If they were 'declining' or 'pending' and now confirm to a full event, they go to waitlist.
          finalStatus = 'waitlisted';
        } else {
          // Space available or unlimited seats, confirm them.
          currentConfirmedGuestCount++;
        }
      } else if (status === 'declining' && oldStatus === 'confirmed') {
        // Was confirmed, now declining.
        currentConfirmedGuestCount = Math.max(0, currentConfirmedGuestCount - 1);
      } else if (status === 'confirmed' && oldStatus === 'waitlisted') {
        // Was waitlisted, admin might be confirming them (though this function is guest-facing).
        // Or, a spot opened and they re-confirmed. Check seats again.
        if (eventDataFromDb.seatLimit > 0 && currentConfirmedGuestCount >= eventDataFromDb.seatLimit) {
            finalStatus = 'waitlisted'; // Remain waitlisted if still full
        } else {
            currentConfirmedGuestCount++; // Confirm them
            // Note: If an admin action moves from waitlist to confirmed, that action should handle email.
        }
      }
      // If status isn't changing or oldStatus was already 'declined' and new is 'declined', count doesn't change.

      const updateDataForInvitation: Partial<Omit<InvitationData, 'id' | 'createdAt'>> & { updatedAt: any, rsvpAt: any } = {
        guestName: name, // Update name and email based on form submission
        guestEmail: normalizedEmail,
        status: finalStatus,
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, updateDataForInvitation);

      // Update event's confirmed guest count if it changed
      if (currentConfirmedGuestCount !== (eventDataFromDb._confirmedGuestsCount ?? 0)) {
         transaction.update(eventRef, { _confirmedGuestsCount: currentConfirmedGuestCount, updatedAt: FieldValue.serverTimestamp() });
      }

      // Construct the invitation object to return, reflecting the committed state
      const returnedInvitation: InvitationData = convertTimestampsInObj({
        ...invitationDataFromDb, // Start with existing data
        ...updateDataForInvitation, // Overlay with updates
        status: finalStatus, // Ensure finalStatus is used
        rsvpAt: new Date().toISOString(), // Optimistic timestamp for return
        updatedAt: new Date().toISOString(), // Optimistic timestamp
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
  const normalizedEmail = guestEmail.toLowerCase();

  // Firestore composite index needed: invitations collection, fields: eventId (ASC), guestEmail (ASC), isPublicOrigin (ASC)
  const existingInvitationQuery = db.collection(INVITATIONS_COLLECTION)
    .where('eventId', '==', eventId)
    .where('guestEmail', '==', normalizedEmail) // Check against normalized email
    .where('isPublicOrigin', '==', true) // Ensure it was a public RSVP
    .limit(1);

  try {
    const newInvitationData = await db.runTransaction(async (transaction) => {
      const existingSnapshot = await transaction.get(existingInvitationQuery);
      if (!existingSnapshot.empty) {
        const existingInv = existingSnapshot.docs[0].data() as InvitationData;
        // If user already has an active (confirmed or waitlisted) public RSVP, prevent new one.
        if (existingInv.status === 'confirmed' || existingInv.status === 'waitlisted') {
           const clientExistingInv = convertTimestampsInObj({ id: existingSnapshot.docs[0].id, ...existingInv });
          throw {
            knownError: true, // Custom flag to identify this specific error type
            message: `You have already RSVP'd for this event. Your current status is: ${existingInv.status}.`,
            invitation: clientExistingInv
          };
        }
        // If existing public RSVP was 'declined' or 'pending' (unlikely for public), allow them to re-RSVP by creating a new one essentially.
        // Or, one might choose to update the existing one. For simplicity, current logic creates new if not active.
      }

      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) {
        throw new Error('Event not found.');
      }
      const eventData = eventSnap.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date' | 'creatorId'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType, creatorId: string };

      let rsvpStatus: RsvpStatus = 'confirmed';
      let confirmedGuestsIncrement = 1;

      if (eventData.seatLimit > 0 && (eventData._confirmedGuestsCount ?? 0) >= eventData.seatLimit) {
        rsvpStatus = 'waitlisted';
        confirmedGuestsIncrement = 0; // Don't increment if waitlisted
      }

      const uniqueToken = randomUUID(); // Generate a new unique token for this public RSVP
      const newInvitationRef = db.collection(INVITATIONS_COLLECTION).doc();

      const newInvitationDocData = {
        uniqueToken,
        eventId,
        guestName,
        guestEmail: normalizedEmail, // Store normalized email
        status: rsvpStatus,
        visited: true, // Mark as visited since they are RSVPing now
        originalGuestName: guestName, // Name as entered by the guest
        originalGuestEmail: guestEmail, // Email as entered (original case)
        isPublicOrigin: true, // Mark as public RSVP
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
      } else if (eventData.seatLimit > 0 && rsvpStatus === 'waitlisted') {
        // No change to confirmed count, but still update event's updatedAt
        transaction.update(eventRef, { updatedAt: FieldValue.serverTimestamp() });
      }
      // If event has unlimited seats, _confirmedGuestsCount is still incremented.

      // Construct the invitation object to return
      const createdInvitationForClient: InvitationData = {
        id: newInvitationRef.id,
        ...newInvitationDocData,
        status: rsvpStatus, // Ensure this is the final decided status
        rsvpAt: new Date().toISOString(), // Optimistic timestamp
        createdAt: new Date().toISOString(), // Optimistic timestamp
        updatedAt: new Date().toISOString(), // Optimistic timestamp
      };
      return createdInvitationForClient;
    });

    // If transaction was successful
    const message = newInvitationData.status === 'confirmed'
      ? "RSVP successful! You're confirmed."
      : "Thank you! The event is currently full, but you've been added to the waitlist.";
    return { success: true, message: message, invitation: newInvitationData };

  } catch (error: any) {
    if (error.knownError) { // Handle the custom error for existing RSVP
        return { success: false, message: error.message, invitation: error.invitation as InvitationData | null };
    }
    console.error('Error creating public RSVP invitation:', error);
    if (error.code === 5 && error.message.includes("requires an index")) {
        console.error("Firestore composite index missing for `createPublicRsvpInvitation` check on `invitations` collection. Required: `eventId` (Ascending), `guestEmail` (Ascending), `isPublicOrigin` (Ascending). Please create this index in the Firebase console.");
    }
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
      .orderBy('createdAt', 'desc') // Typically, you might want to order by guestName or createdAt
      .get();

    // Firestore composite index for `getAllInvitationsForEvent`:
    // Collection: `invitations`, Fields: `eventId` (Ascending), `createdAt` (Descending)

    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as InvitationData));
  } catch (error: any) {
    console.error(`Error fetching all invitations for event ${eventId}:`, error.message);
     if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getAllInvitationsForEvent` on `invitations` collection. Required: `eventId` (Ascending), `createdAt` (Descending). Please create this index in the Firebase console.");
    }
    return [];
  }
}

export async function getWaitlistedGuestsForEvent(eventId: string): Promise<InvitationData[]> {
  try {
    const snapshot = await db.collection(INVITATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .where('status', '==', 'waitlisted')
      .orderBy('createdAt', 'asc') // FIFO for waitlist typically
      .get();
    // Firestore composite index for `getWaitlistedGuestsForEvent`:
    // Collection: `invitations`, Fields: `eventId` (Ascending), `status` (Ascending), `createdAt` (Ascending)
    return snapshot.docs.map(doc => convertTimestampsInObj({ id: doc.id, ...doc.data() } as InvitationData));
  } catch (error: any) {
    console.error(`Error fetching waitlisted guests for event ${eventId}:`, error);
    if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getWaitlistedGuestsForEvent`. Required: `eventId` (ASC), `status` (ASC), `createdAt` (ASC).");
    }
    return [];
  }
}

export async function acceptWaitlistedGuest(invitationId: string, eventId: string): Promise<{success: boolean, message: string, invitation?: InvitationData}> {
  const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(invitationId);
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);

  try {
    const updatedInvitation = await db.runTransaction(async (transaction) => {
      const invDoc = await transaction.get(invitationRef);
      const eventDoc = await transaction.get(eventRef);

      if (!invDoc.exists) throw new Error("Invitation not found.");
      if (!eventDoc.exists) throw new Error("Event not found.");

      const invitation = invDoc.data() as InvitationData;
      const event = eventDoc.data() as Omit<EventData, 'id' | 'confirmedGuestsCount' | 'createdAt' | 'updatedAt'| 'date'> & { _confirmedGuestsCount?: number, createdAt: FirestoreTimestampType, updatedAt: FirestoreTimestampType, date: FirestoreTimestampType };


      if (invitation.status !== 'waitlisted') {
        throw new Error(`Guest is not on the waitlist. Current status: ${invitation.status}`);
      }

      const currentConfirmedCount = event._confirmedGuestsCount ?? 0;
      if (event.seatLimit > 0 && currentConfirmedCount >= event.seatLimit) {
        throw new Error("Cannot accept guest: Event is already at full capacity.");
      }

      // Update invitation
      transaction.update(invitationRef, {
        status: 'confirmed',
        rsvpAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Increment event confirmed count
      transaction.update(eventRef, {
        _confirmedGuestsCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return convertTimestampsInObj({
        ...invitation,
        status: 'confirmed',
        rsvpAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as InvitationData);
    });
    return { success: true, message: "Guest accepted from waitlist and confirmed.", invitation: updatedInvitation };
  } catch (error: any) {
    console.error(`Error accepting waitlisted guest ${invitationId}:`, error);
    return { success: false, message: error.message || "Failed to accept guest from waitlist." };
  }
}

export async function declineWaitlistedGuest(invitationId: string): Promise<{success: boolean, message: string, invitation?: InvitationData}> {
  const invitationRef = db.collection(INVITATIONS_COLLECTION).doc(invitationId);
  try {
    const invDoc = await invitationRef.get();
    if (!invDoc.exists) throw new Error("Invitation not found.");
    const invitation = invDoc.data() as InvitationData;
    if (invitation.status !== 'waitlisted') {
        throw new Error(`Guest is not on the waitlist. Current status: ${invitation.status}`);
    }

    await invitationRef.update({
      status: 'declined', // Or a new status like 'waitlist-declined'
      updatedAt: FieldValue.serverTimestamp()
    });
    const updatedDoc = await invitationRef.get();
    return { 
        success: true, 
        message: "Guest declined from waitlist.",
        invitation: convertTimestampsInObj(updatedDoc.data() as InvitationData)
    };
  } catch (error: any) {
    console.error(`Error declining waitlisted guest ${invitationId}:`, error);
    return { success: false, message: error.message || "Failed to decline guest from waitlist." };
  }
}


export async function getEventStats(eventId: string): Promise<RsvpStats | null> {
  try {
    const event = await getEventById(eventId);
    if (!event) {
        console.warn(`getEventStats: Event ${eventId} not found.`);
        return null;
    }

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

    const totalSeats = event.seatLimit <= 0 ? 0 : event.seatLimit; // 0 means unlimited for display
    const availableSeats = totalSeats === 0 ? Infinity : Math.max(0, totalSeats - event.confirmedGuestsCount);

    return {
      confirmed: event.confirmedGuestsCount,
      pending: pendingSnapshot.data().count,
      declined: declinedSnapshot.data().count,
      waitlisted: waitlistedSnapshot.data().count,
      totalSeats: totalSeats,
      availableSeats: availableSeats,
    };
  } catch (error) {
    console.error(`Error fetching event stats for ${eventId}:`, error);
    return null;
  }
}

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

export async function getUserProfile(userId: string): Promise<UserData | null> {
  const profileRef = db.collection(USER_PROFILES_COLLECTION).doc(userId);
  const doc = await profileRef.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return convertTimestampsInObj({ id: doc.id, ...data } as UserData);
}

// Functions for Event Feedback
export async function createEventFeedback(
  feedbackData: Omit<EventFeedbackData, 'id' | 'submittedAt'>
): Promise<EventFeedbackData | null> {
  try {
    const newFeedbackRef = db.collection(EVENT_FEEDBACK_COLLECTION).doc();
    const feedbackToSave = {
      ...feedbackData,
      id: newFeedbackRef.id,
      submittedAt: FieldValue.serverTimestamp(),
    };
    await newFeedbackRef.set(feedbackToSave);
    const docSnap = await newFeedbackRef.get();
    if (!docSnap.exists) return null;
    return convertTimestampsInObj(docSnap.data() as EventFeedbackData);
  } catch (error) {
    console.error("Error creating event feedback:", error);
    return null;
  }
}

export async function getFeedbackForEvent(eventId: string): Promise<EventFeedbackData[]> {
  try {
    const snapshot = await db.collection(EVENT_FEEDBACK_COLLECTION)
      .where('eventId', '==', eventId)
      .orderBy('submittedAt', 'desc')
      .get();
    // Firestore composite index for `getFeedbackForEvent`:
    // Collection: `eventFeedback`, Fields: `eventId` (Ascending), `submittedAt` (Descending)
    return snapshot.docs.map(doc => convertTimestampsInObj(doc.data() as EventFeedbackData));
  } catch (error: any) {
    console.error(`Error fetching feedback for event ${eventId}:`, error);
    if (error.code === 5 && error.message.includes("requires an index")) {
      console.error("Firestore composite index missing for `getFeedbackForEvent` on `eventFeedback` collection. Required: `eventId` (Ascending), `submittedAt` (Descending). Please create this index in the Firebase console.");
    }
    return [];
  }
}

// Helper to get a specific invitation by ID (not token)
export async function getInvitationById(invitationId: string): Promise<InvitationData | null> {
    const docRef = db.collection(INVITATIONS_COLLECTION).doc(invitationId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.log(`Invitation with ID ${invitationId} not found.`);
      return null;
    }
    return convertTimestampsInObj({ id: docSnap.id, ...docSnap.data() } as InvitationData);
}
