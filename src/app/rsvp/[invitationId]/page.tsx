import { getEventById, getInvitationById } from '@/lib/db';
import RsvpFormComponent from './components/RsvpForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, MapPin, Info, Users, CheckSquare, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface RsvpPageProps {
  params: {
    invitationId: string;
  };
}

export default async function RsvpPage({ params }: RsvpPageProps) {
  const invitationId = params.invitationId;
  const invitation = await getInvitationById(invitationId);

  if (!invitation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Invalid Invitation</h1>
        <p className="text-muted-foreground mt-2">The invitation link you used is invalid or has expired. Please check the link or contact the event organizer.</p>
      </div>
    );
  }

  const event = await getEventById(invitation.eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground mt-2">The event associated with this invitation could not be found. Please contact the event organizer.</p>
      </div>
    );
  }

  const availableSeats = event.seatLimit - event.confirmedGuestsCount;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl text-primary">{event.name}</CardTitle>
                  <CardDescription className="text-lg">You're invited! Please RSVP below.</CardDescription>
                </div>
                {invitation.status !== 'pending' && (
                  <Badge variant={invitation.status === 'attending' ? 'default' : 'destructive'} className="ml-auto shrink-0">
                    {invitation.status === 'attending' ? 'Attending' : 'Declined'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Image 
                src="https://placehold.co/800x300.png" 
                alt={event.name}
                width={800} 
                height={300} 
                className="rounded-md object-cover w-full shadow-md"
                data-ai-hint="event venue"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2 text-accent" />
                  <span>Date: {format(new Date(event.date), "MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center">
                  <CalendarDays className="h-5 w-5 mr-2 text-accent" /> {/* Using CalendarDays for time too for consistency */}
                  <span>Time: {event.time}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-accent" />
                  <span>Location: {event.location}</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-accent" />
                  <span>Seats Available: {availableSeats > 0 ? `${availableSeats} / ${event.seatLimit}` : 'Event Full'}</span>
                </div>
              </div>
              <div className="pt-2">
                <h3 className="font-semibold flex items-center mb-1"><Info className="h-5 w-5 mr-2 text-accent" />Description</h3>
                <p className="text-muted-foreground">{event.description}</p>
              </div>
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
