import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, CalendarDays, MapPin, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
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
        Effortlessly manage your event invitations and track responses. Guests can easily RSVP through unique, personalized links.
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
            <p className="mt-2 text-sm text-muted-foreground">Example link: /rsvp/your-unique-link</p>
          </CardContent>
        </Card>

        <Card className="text-left shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarDays className="mr-2 h-6 w-6 text-accent" />
              For Event Organizers
            </CardTitle>
            <CardDescription>
              Manage your event, view guest responses, and send reminders through the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin">Go to Admin Dashboard</Link>
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">Access statistics and guest management tools.</p>
          </CardContent>
        </Card>
      </div>

      <div className="pt-8 max-w-3xl w-full space-y-4">
        <h2 className="text-2xl font-semibold text-primary">Key Features</h2>
        <ul className="list-disc list-inside text-left text-muted-foreground space-y-1">
          <li><MapPin className="inline h-4 w-4 mr-1 text-accent" />Clear Event Details Display</li>
          <li><Info className="inline h-4 w-4 mr-1 text-accent" />Simple RSVP Form via Unique Links</li>
          <li><Ticket className="inline h-4 w-4 mr-1 text-accent" />Seat Reservation Limits</li>
          <li><CalendarDays className="inline h-4 w-4 mr-1 text-accent" />Admin Dashboard for Stats & Management</li>
        </ul>
      </div>
    </div>
  );
}
