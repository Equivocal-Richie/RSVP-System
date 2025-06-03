
import { getInvitationByToken, getEventById } from '@/lib/db';
import FeedbackFormComponent from './components/FeedbackForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, MessageSquareText } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';

interface FeedbackPageProps {
  params: {
    token: string;
  };
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const { token } = params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Invalid Link</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          The link you used (<code>/.../{token.substring(0,8)}...</code>) is invalid or has expired.
          Please check the link or contact the event organizer if you believe this is an error.
        </p>
      </div>
    );
  }

  // Optionally, you might want to check if feedback has already been submitted for this invitation
  // and display a "thank you" message instead of the form if so. This requires an additional DB query.

  const event = await getEventById(invitation.eventId);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold">Event Not Found</h1>
        <p className="text-muted-foreground mt-2">The event associated with this link could not be found.</p>
      </div>
    );
  }
  
  // Only allow feedback from confirmed guests (optional rule)
  // if (invitation.status !== 'confirmed') {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-4">
  //       <Info className="w-16 h-16 text-blue-500 mb-4" />
  //       <h1 className="text-3xl font-bold">Feedback Not Applicable</h1>
  //       <p className="text-muted-foreground mt-2 max-w-md">
  //         Feedback can typically only be submitted by confirmed attendees. Your RSVP status is currently: {invitation.status}.
  //       </p>
  //     </div>
  //   );
  // }


  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col items-center">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader className="text-center">
            {event.eventImagePath ? (
                <Image
                src={event.eventImagePath}
                alt={event.name}
                width={600}
                height={200}
                className="rounded-md object-cover w-full max-h-48 mb-4 shadow-md"
                data-ai-hint="event highlight"
                />
            ) : (
                 <Image
                src="https://placehold.co/600x200.png"
                alt="Event placeholder"
                width={600}
                height={200}
                className="rounded-md object-cover w-full max-h-48 mb-4 shadow-md"
                data-ai-hint="event placeholder"
                />
            )}
            <MessageSquareText className="mx-auto h-10 w-10 text-primary mb-2" />
            <CardTitle className="text-2xl md:text-3xl">Share Your Feedback</CardTitle>
            <CardDescription className="text-md">
              For: <strong>{event.name}</strong>
              <br />
              Held on: {format(new Date(event.date), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center text-muted-foreground mb-6">
              Hello {invitation.guestName}, thank you for attending! Your insights are valuable to us for improving future events.
            </p>
            <FeedbackFormComponent invitationToken={invitation.uniqueToken} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: FeedbackPageProps) {
  const { token } = params;
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return { title: "Invalid Feedback Link - RSVP Now" };
  }
  const event = await getEventById(invitation.eventId);
  return {
    title: `Feedback for ${event?.name || 'Event'} - RSVP Now`,
    description: `Share your feedback for ${event?.name || 'our event'}.`,
  };
}
