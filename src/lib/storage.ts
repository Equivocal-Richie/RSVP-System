
'use server';

import { storage } from './firebaseAdmin'; // Firebase Admin Storage instance
import { randomUUID } from 'crypto';

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
const EVENT_IMAGES_FOLDER = 'event-images';

/**
 * Uploads an image file to Firebase Storage and returns its public URL.
 * @param imageFile The File object to upload.
 * @param eventId The ID of the event, used for naming the file.
 * @returns The public URL of the uploaded image, or null if upload fails.
 */
export async function uploadEventImage(
  imageFile: File,
  eventId: string
): Promise<string | null> {
  if (!imageFile) return null;

  const bucket = storage.bucket(BUCKET_NAME);
  
  // Generate a unique filename to prevent overwrites and ensure uniqueness
  const fileExtension = imageFile.name.split('.').pop() || 'jpg';
  const uniqueFileName = `${eventId}-${randomUUID()}.${fileExtension}`;
  const filePath = `${EVENT_IMAGES_FOLDER}/${uniqueFileName}`;
  const fileUpload = bucket.file(filePath);

  try {
    // Convert File to Buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload the buffer
    await fileUpload.save(buffer, {
      metadata: {
        contentType: imageFile.type,
      },
      public: true, // Make the file publicly readable
    });

    // Get the public URL
    // Note: Firebase Storage public URLs have a specific format.
    // For buckets that are not the default `{projectId}.appspot.com`, the URL might be different.
    // The `file.publicUrl()` method is generally reliable.
    // Alternative: const [metadata] = await fileUpload.getMetadata(); return metadata.mediaLink;
    // Or: return `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`; (Ensure this matches your bucket's public URL structure)

    // Making file public and then getting URL
    await fileUpload.makePublic(); // Ensure it's public
    const publicUrl = fileUpload.publicUrl(); 

    console.log(`Image uploaded for event ${eventId}: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error(`Error uploading image for event ${eventId} to ${filePath}:`, error);
    return null;
  }
}

// Helper function to delete an image if an event update removes it or event is deleted
export async function deleteEventImage(imageUrl: string): Promise<boolean> {
    if (!imageUrl || !imageUrl.startsWith(`https://storage.googleapis.com/${BUCKET_NAME}/`)) {
        console.warn("Invalid or non-Firebase Storage URL provided for deletion:", imageUrl);
        return false;
    }

    try {
        const filePath = imageUrl.substring(`https://storage.googleapis.com/${BUCKET_NAME}/`.length).split('?')[0]; // Remove query params like token
        const file = storage.bucket(BUCKET_NAME).file(filePath);
        await file.delete();
        console.log(`Successfully deleted image: ${filePath}`);
        return true;
    } catch (error: any) {
        if (error.code === 404) {
            console.warn(`Image not found for deletion (already deleted?): ${imageUrl}`);
            return true; // Or false depending on desired behavior for "not found"
        }
        console.error(`Error deleting image ${imageUrl}:`, error);
        return false;
    }
}
