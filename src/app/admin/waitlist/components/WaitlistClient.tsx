
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWaitlistPageData, processAcceptWaitlistGuestAction, processDeclineWaitlistGuestAction } from '../actions';
import type { EventData, InvitationData, EventForSelector } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, ListChecks, UserRoundCheck, UserRoundX, AlertCircle, Info, Users, MailWarning, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const BREVO_DAILY_LIMIT = 300; 

export default function WaitlistClient() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<EventForSelector[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);
  const [selectedEventDetails, setSelectedEventDetails] = useState<EventData | null>(null);
  const [waitlistedGuests, setWaitlistedGuests] = useState<InvitationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({}); 
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      if (authLoading || !user) {
        if (!authLoading && !user) {
            setError("Please sign in to manage waitlists.");
            setIsLoading(false);
        }
        return;
      }
      setIsLoading(true);
      setError(null);
      const result = await fetchWaitlistPageData(user.uid, selectedEventId);

      if (result.error) {
        setError(result.error);
        toast({ title: "Error Loading Data", description: result.error, variant: "destructive" });
      } else {
        setEvents(result.events);
        setWaitlistedGuests(result.waitlistedGuests);
        setSelectedEventDetails(result.selectedEventDetails);
        if (!selectedEventId && result.selectedEventDetails) {
          setSelectedEventId(result.selectedEventDetails.id);
        }
      }
      setIsLoading(false);
    }
    loadData();
  }, [user, authLoading, selectedEventId, toast]);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const handleProcessGuest = async (invitationId: string, eventId: string, action: 'accept' | 'decline') => {
    setIsProcessing(prev => ({ ...prev, [invitationId]: true }));
    
    const actionFunction = action === 'accept' ? processAcceptWaitlistGuestAction : processDeclineWaitlistGuestAction;
    const result = await actionFunction(invitationId, eventId);

    if (result.success) {
      toast({ title: "Action Succeeded", description: result.message }); // Message now reflects queuing
      if (user) {
        // Re-fetch data to update the list and counts
        const updatedData = await fetchWaitlistPageData(user.uid, selectedEventId);
        if (!updatedData.error) {
          setWaitlistedGuests(updatedData.waitlistedGuests);
          setSelectedEventDetails(updatedData.selectedEventDetails);
        }
      }
    } else {
      toast({ title: "Error", description: result.message || `Failed to ${action} guest.`, variant: "destructive" });
    }
    setIsProcessing(prev => ({ ...prev, [invitationId]: false }));
  };

  const availableSeats = useMemo(() => {
    if (!selectedEventDetails || selectedEventDetails.seatLimit <= 0) return Infinity;
    return selectedEventDetails.seatLimit - selectedEventDetails.confirmedGuestsCount;
  }, [selectedEventDetails]);

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading waitlist data...</span>
      </div>
    );
  }

  if (error) {
     return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!user) {
     return (
      <Alert variant="default" className="max-w-2xl mx-auto bg-card">
        <Info className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
            You need to be signed in to manage event waitlists. Please <Link href="/auth" className="underline">sign in</Link>.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center text-2xl">
                <ListChecks className="mr-3 h-7 w-7 text-primary" />
                Waitlist Management
              </CardTitle>
              <CardDescription>
                Manage guests on the waitlist for your events.
              </CardDescription>
            </div>
            {events.length > 0 && (
              <Select onValueChange={handleEventChange} value={selectedEventId}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map(eventItem => ( // Renamed event to eventItem to avoid conflict
                    <SelectItem key={eventItem.id} value={eventItem.id}>
                      {eventItem.name} ({format(new Date(eventItem.date), "MMM d, yyyy")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {selectedEventDetails && (
          <CardContent className="space-y-4">
             <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-700 dark:text-blue-300">Event: {selectedEventDetails.name}</AlertTitle>
                <AlertDescription className="text-sm text-blue-600 dark:text-blue-400">
                    Capacity: {selectedEventDetails.seatLimit <= 0 ? "Unlimited" : selectedEventDetails.seatLimit} | 
                    Confirmed: {selectedEventDetails.confirmedGuestsCount} | 
                    Available Seats: {availableSeats <= 0 && selectedEventDetails.seatLimit > 0 ? <span className="font-bold text-red-600 dark:text-red-400">Full</span> : (availableSeats === Infinity ? "Unlimited" : availableSeats)}
                </AlertDescription>
            </Alert>
            <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-900/30">
                <MailWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-700 dark:text-amber-300">Email Queueing Notice</AlertTitle>
                <AlertDescription className="text-sm text-amber-600 dark:text-amber-400">
                    Accepting or declining a guest will queue an email for background sending. Please be mindful of daily sending limits (e.g., Brevo free tier: {BREVO_DAILY_LIMIT} emails/day). For production, a robust queueing system is necessary.
                </AlertDescription>
            </Alert>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Waitlisted On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitlistedGuests.length > 0 ? waitlistedGuests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell className="font-medium">{guest.guestName}</TableCell>
                    <TableCell>{guest.guestEmail}</TableCell>
                    <TableCell>{guest.createdAt ? format(new Date(guest.createdAt), "MMM d, yyyy HH:mm") : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcessGuest(guest.id, guest.eventId, 'accept')}
                        disabled={isProcessing[guest.id] || (availableSeats <= 0 && selectedEventDetails.seatLimit > 0)}
                        className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-70"
                      >
                        {isProcessing[guest.id] && isProcessing[guest.id] ? <Activity className="mr-1 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-1 h-4 w-4" />}
                        Accept & Queue Email
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleProcessGuest(guest.id, guest.eventId, 'decline')}
                        disabled={isProcessing[guest.id]}
                      >
                         {isProcessing[guest.id] && isProcessing[guest.id] ? <Activity className="mr-1 h-4 w-4 animate-spin" /> : <UserRoundX className="mr-1 h-4 w-4" />}
                        Decline & Queue Email
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No guests currently on the waitlist for this event.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {waitlistedGuests.length === 0 && !selectedEventId && events.length > 0 && (
                 <p className="text-center text-muted-foreground py-4">Please select an event to view its waitlist.</p>
            )}
             {events.length === 0 && (
                 <CardFooter className="justify-center">
                    <p className="text-muted-foreground">You have not created any events yet. </p>
                    <Button variant="link" asChild><Link href="/admin/create-event">Create an Event</Link></Button>
                 </CardFooter>
            )}
          </CardContent>
        )}
         {!selectedEventId && events.length > 0 && (
            <CardContent className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an event from the dropdown above to manage its waitlist.</p>
            </CardContent>
        )}
        {events.length === 0 && !isLoading && (
             <CardContent className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">No Events Found</h3>
                <p className="text-muted-foreground">Create an event to start managing waitlists.</p>
                <Button asChild className="mt-4"><Link href="/admin/create-event">Create Your First Event</Link></Button>
            </CardContent>
        )}

      </Card>
    </div>
  );
}

    