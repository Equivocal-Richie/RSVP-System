
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Ticket, CalendarDays, MapPin, Info, Building, Eye, LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getPublicEvents } from "@/lib/db";
import type { EventData } from "@/types";
import { format } from "date-fns";

async function HomePageContent() {
  const publicEvents: EventData[] = await getPublicEvents();

  return (
    <div className="space-y-12">
      <div className="flex flex-col items-center justify-center text-center space-y-8">
        <Image
          src="https://placehold.co/800x400.png"
          alt="Event Banner"
          width={800}
          height={400}
          className="rounded-lg shadow-xl object-cover"
          data-ai-hint="event celebration"
        />

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
          Welcome to RSVP Now
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
          Effortlessly manage your event invitations and track responses. Guests can easily RSVP through unique, personalized links. Discover public events below!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full pt-8">
          <Card className="text-left shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ticket className="mr-2 h-6 w-6 text-accent" />
                For Guests
              </CardTitle>
              <CardDescription>
                Received an invitation? Access your personalized RSVP form using the unique link provided in your email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>If you have your unique link, you're all set! Simply click it to respond.</p>
              <p className="mt-2 text-sm text-muted-foreground">Example link: /rsvp/your-unique-token</p>
            </CardContent>
          </Card>

          <Card className="text-left shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CalendarDays className="mr-2 h-6 w-6 text-accent" />
                For Event Organizers
              </CardTitle>
              <CardDescription>
                Ready to plan your next event? Sign in or create an account to access the dashboard and management tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/auth">
                  <LogIn className="mr-2 h-5 w-5" />
                  Create Event / Sign In
                </Link>
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">Access statistics and guest management tools after signing in.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {publicEvents.length > 0 && (
        <div className="space-y-8">
          <h2 className="text-3xl font-bold text-center text-primary">Public Events</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicEvents.map((event) => (
              <Card key={event.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <div className="relative w-full h-48">
                  <Image
                    src={event.eventImagePath || "https://placehold.co/600x400.png"}
                    alt={event.name}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint={event.eventImagePath ? "event specific" : "event placeholder"}
                  />
                </div>
                <CardHeader>
                  <CardTitle>{event.name}</CardTitle>
                  <CardDescription className="flex items-center text-xs">
                    <CalendarDays className="mr-1.5 h-4 w-4" /> {format(new Date(event.date), "MMMM d, yyyy")} at {event.time}
                  </CardDescription>
                  <CardDescription className="flex items-center text-xs">
                     <MapPin className="mr-1.5 h-4 w-4" /> {event.location}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {event.description} {/* AI Summary placeholder */}
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                  <Button asChild className="w-full sm:w-auto flex-1">
                    <Link href={`/rsvp/public/${event.id}`}>
                      <Ticket className="mr-2 h-4 w-4" /> Reserve Seat
                    </Link>
                  </Button>
                  {event.organizerEmail && (
                    <Button variant="outline" asChild className="w-full sm:w-auto flex-1">
                      <a href={`mailto:${event.organizerEmail}?subject=Inquiry about ${event.name}`}>
                        <Building className="mr-2 h-4 w-4" /> Inquire
                      </a>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
       {publicEvents.length === 0 && (
         <div className="text-center py-10">
            <Eye className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-primary">No Public Events Yet</h3>
            <p className="text-muted-foreground">Check back later for public events, or create one if you're an organizer!</p>
        </div>
      )}
    </div>
  );
}


export default function HomePage() {
  // This outer component remains a client component if needed for other client-side logic,
  // or can be entirely server-rendered by just returning HomePageContent.
  // For now, let's assume it's fine as is and HomePageContent does the server work.
  return <HomePageContent />;
}
