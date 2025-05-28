
import { getEventByPublicLinkToken } from '@/lib/db';
import RsvpFormComponent from '../../[token]/components/RsvpForm'; // Adjust path as necessary
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, MapPin, Info, Users, CheckSquare, AlertTriangle, Palette, Building } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added Alert imports
import { format } from 'date-fns';
import Image from 'next/image';
import type { EventData, InvitationData, RsvpStatus } from '@/types';
import { Badge } from '@/components/ui/badge';

interface PublicRsvpPageProps {
  params: {
    token: string; // This 'token' is actually the eventId for public RSVPs
  };
}

export default async function PublicRsvpPage({ params }: PublicRsvpPageProps) {
  const { token: eventId } = params;
  const event = await getEventByPublicLinkToken(eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          The event you're trying to RSVP for (<code>/rsvp/public/{eventId}</code>) could not be found or is not public.
          Please check the link or contact the event organizer.
        </p>
      </div>
    );
  }
  
  // For public RSVP, we don't have a pre-existing invitation.
  // We create a mock or minimal invitation object for the form,
  // primarily to pass the eventId and signal it's a public RSVP.
  // The actual guest details will be entered by the user in the form.
  const mockPublicInvitation: InvitationData = {
    id: `public-${eventId}`, // Temporary ID for client-side form
    uniqueToken: eventId, // Using eventId as the token for public link context
    eventId: eventId,
    guestName: '', // To be filled by user
    guestEmail: '', // To be filled by user
    status: 'pending', // Will become 'confirmed' upon successful public RSVP
    visited: true, // Assumed true as they are on the page
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const availableSeats = event.seatLimit > 0 ? event.seatLimit - event.confirmedGuestsCount : Infinity;
  const eventDate = event.date ? new Date(event.date) : new Date();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl text-primary">{event.name}</CardTitle>
                  <CardDescription className="text-lg">Welcome! RSVP for this public event.</CardDescription>
                </div>
                {/* Badge for public events might show capacity or 'Public Event' */}
                 <Badge 
                    variant={'outline'} 
                    className={`ml-auto shrink-0 bg-accent text-accent-foreground`}
                  >
                    Public Event
                  </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.eventImagePath ? (
                <Image
                  src={event.eventImagePath}
                  alt={event.name}
                  width={800}
                  height={300}
                  className="rounded-md object-cover w-full shadow-md"
                  data-ai-hint="event venue celebration"
                />
              ) : (
                 <Image 
                  src={"https://placehold.co/800x300.png"} 
                  alt={event.name}
                  width={800} 
                  height={300} 
                  className="rounded-md object-cover w-full shadow-md"
                  data-ai-hint="event placeholder"
                />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2 text-accent" />
                  <span>Date: {format(eventDate, "MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2 text-accent" />
                  <span>Time: {event.time}</span>
                </div>
                <div className="flex items-center col-span-1 sm:col-span-2">
                  <MapPin className="h-5 w-5 mr-2 text-accent" />
                  <span>Location: {event.location}</span>
                </div>
                 <div className="flex items-center">
                  <Palette className="h-5 w-5 mr-2 text-accent" />
                  <span>Mood: <span className="capitalize">{event.mood}</span></span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-accent" />
                  <span>
                    Seats: {event.seatLimit <= 0 ? 'Open Event' : 
                             (availableSeats > 0 ? `${availableSeats} available / ${event.seatLimit} total` : 'Event Full')}
                  </span>
                </div>
                {event.organizerEmail && (
                  <div className="flex items-center col-span-1 sm:col-span-2">
                    <Building className="h-5 w-5 mr-2 text-accent" />
                    <span>Organizer Contact: <a href={`mailto:${event.organizerEmail}`} className="underline hover:text-primary">{event.organizerEmail}</a></span>
                  </div>
                )}
              </div>
              <div className="pt-2">
                <h3 className="font-semibold flex items-center mb-1"><Info className="h-5 w-5 mr-2 text-accent" />Description</h3>
                <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          {/* 
            Pass isPublicRsvp={true} to the form.
            The form will need to handle this:
            - Potentially different server action.
            - No "decline" option typically for public sign-ups.
            - Guest name/email are entered by user, not pre-filled from invitation.
          */}
          <RsvpFormComponent invitation={mockPublicInvitation} event={event} isPublicRsvp={true} />
           <Alert variant="default" className="mt-4 bg-secondary">
              <Info className="h-4 w-4" />
              <AlertTitle>Public RSVP Note</AlertTitle>
              <AlertDescription>
                By submitting this form, you are registering for this public event. 
                Your spot will be confirmed subject to availability.
              </AlertDescription>
            </Alert>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: PublicRsvpPageProps) {
  const { token: eventId } = params;
  const event = await getEventByPublicLinkToken(eventId);
  if (!event) {
    return {
      title: "Event Not Found - RSVP Now",
    };
  }
  return {
    title: `RSVP for ${event.name} (Public) - RSVP Now`,
    description: `Join ${event.name}! Register here for this public event.`,
  };
}
