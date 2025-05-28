
import { getEventById, getInvitationByToken, updateInvitationRsvp } from '@/lib/db';
import RsvpFormComponent from './components/RsvpForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, MapPin, Info, Users, CheckSquare, AlertTriangle, MailWarning, Smile, Palette, Building } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface RsvpPageProps {
  params: {
    token: string;
  };
}

export default async function RsvpPage({ params }: RsvpPageProps) {
  const { token } = params;
  const invitation = await getInvitationByToken(token); 

  if (!invitation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Invalid Invitation Link</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          The invitation link you used (<code>/.../{token.substring(0,8)}...</code>) is invalid, has expired, or has already been used. 
          Please check the link or contact the event organizer if you believe this is an error.
        </p>
      </div>
    );
  }

  const event = await getEventById(invitation.eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground mt-2">The event associated with this invitation could not be found. Please contact the event organizer.</p>
      </div>
    );
  }

  const availableSeats = event.seatLimit > 0 ? event.seatLimit - event.confirmedGuestsCount : Infinity;
  // Ensure event.date is treated as a string (ISO format) from db.ts conversion
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
                  <CardDescription className="text-lg">You&apos;re invited! Please RSVP below.</CardDescription>
                </div>
                {invitation.status !== 'pending' && (
                  <Badge 
                    variant={
                      invitation.status === 'confirmed' ? 'default' : 
                      invitation.status === 'declining' ? 'destructive' : 
                      invitation.status === 'waitlisted' ? 'secondary' : 
                      'outline'
                    } 
                    className={`ml-auto shrink-0 ${
                      invitation.status === 'confirmed' ? 'bg-green-500 hover:bg-green-600' : 
                      invitation.status === 'waitlisted' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''
                    }`}
                  >
                    {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                  </Badge>
                )}
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
              {invitation.status === 'waitlisted' && (
                <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-700">
                  <MailWarning className="h-5 w-5 text-yellow-700 dark:text-yellow-500" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-300">You are on the Waitlist</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                    Thank you for your interest! Spots are currently full. We&apos;ll notify you if a seat becomes available.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <RsvpFormComponent invitation={invitation} event={event} />
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: RsvpPageProps) {
  const { token } = params;
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return {
      title: "Invalid Invitation - RSVP Now",
    };
  }
  const event = await getEventById(invitation.eventId);
  return {
    title: `RSVP for ${event?.name || 'Event'} - RSVP Now`,
    description: `Respond to your invitation for ${event?.name || 'our upcoming event'}.`,
  };
}
