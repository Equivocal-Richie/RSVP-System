
import { getEventByPublicLinkToken } from '@/lib/db'; // Using eventId as token for now
import RsvpFormComponent from '@/app/rsvp/[token]/components/RsvpForm'; // Re-use existing form component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, MapPin, Info, Users, AlertTriangle, Palette, Building } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import type { EventData } from '@/types';
// import { submitPublicRsvp } from './actions'; // Action for public RSVP submission (future)

interface PublicRsvpPageProps {
  params: {
    token: string; // This token will be the eventId for now
  };
}

export default async function PublicRsvpPage({ params }: PublicRsvpPageProps) {
  const { token: eventId } = params; // Assuming token is eventId for public links
  const event: EventData | null = await getEventByPublicLinkToken(eventId);

  if (!event || !event.isPublic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Event Not Found or Not Public</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          The event you're trying to access (<code>.../{eventId}</code>) is either not available or not open for public RSVP.
          Please check the link or contact the event organizer.
        </p>
      </div>
    );
  }

  const availableSeats = event.seatLimit > 0 ? event.seatLimit - event.confirmedGuestsCount : Infinity;
  const eventDate = event.date ? new Date(event.date) : new Date();

  // For public RSVP, there's no pre-existing invitation.
  // The RsvpFormComponent will need to be adapted or a new one created
  // to handle form submission that creates a new "public" invitation.
  // For now, we pass a null or minimal invitation object.
  const mockPublicInvitation = {
    id: `public-${eventId}`, // Temporary ID
    uniqueToken: `public-${eventId}`, // This needs to be handled carefully for actual submissions
    eventId: event.id,
    guestName: '', // Form will collect this
    guestEmail: '', // Form will collect this
    status: 'pending' as 'pending', // Initial status for the form
    visited: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl text-primary">{event.name}</CardTitle>
                  <CardDescription className="text-lg">Public RSVP. Please fill out the form to reserve your spot.</CardDescription>
                </div>
                 <Badge variant="secondary" className="ml-auto shrink-0 bg-accent text-accent-foreground">
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
                             (availableSeats > 0 ? `${availableSeats} / ${event.seatLimit} available` : 'Event Full')}
                  </span>
                </div>
                {event.organizerEmail && (
                  <div className="flex items-center col-span-1 sm:col-span-2">
                    <Building className="h-5 w-5 mr-2 text-accent" />
                    <span>Organizer Contact: {event.organizerEmail}</span>
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
            WARNING: RsvpFormComponent and its associated `submitRsvp` action are designed 
            for unique invitation tokens and UPDATE existing invitations.
            For public RSVPs, we need a new action (`submitPublicRsvp`) that CREATES 
            a new invitation record. This part is not fully implemented for submission yet.
            The form will display, but submission might fail or behave unexpectedly 
            without adapting `submitRsvp` or creating `submitPublicRsvp`.
          */}
          <RsvpFormComponent invitation={mockPublicInvitation} event={event} isPublicRsvp={true} />
           <Alert variant="default" className="mt-4 bg-secondary">
              <Info className="h-4 w-4" />
              <AlertTitle>Public RSVP Note</AlertTitle>
              <AlertDescription>
                You are using a public RSVP link. Submitting this form will attempt to reserve a seat if available.
                The submission logic for public RSVPs is currently under development and might not fully create a new reservation in this version.
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
  if (!event || !event.isPublic) {
    return {
      title: "Event Not Found - RSVP Now",
    };
  }
  return {
    title: `RSVP for ${event.name} (Public) - RSVP Now`,
    description: `Public RSVP for ${event.name}. Reserve your spot!`,
  };
}

    