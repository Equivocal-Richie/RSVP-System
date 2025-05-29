
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllUserGuests, exportAllUserGuestsToCsv } from '../actions';
import type { UserGuestRow, RsvpStatus } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, AlertCircle, Download, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PastGuestsClient() {
  const { user, loading: authLoading } = useAuth();
  const [allGuestsData, setAllGuestsData] = useState<UserGuestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadPastGuests() {
      if (authLoading) return;
      if (!user) {
        setError("Please sign in to view past guest data.");
        setIsLoading(false);
        setAllGuestsData([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      const result = await fetchAllUserGuests(user.uid);

      if (result.error) {
        setError(result.error);
        toast({ title: "Error Loading Past Guests", description: result.error, variant: "destructive" });
        setAllGuestsData([]);
      } else {
        setAllGuestsData(result.guests);
      }
      setIsLoading(false);
    }
    loadPastGuests();
  }, [user, authLoading, toast]);

  const handleExportCsv = async () => {
    if (!user) {
      toast({ title: "Authentication Error", description: "Please sign in to export.", variant: "destructive" });
      return;
    }
    const result = await exportAllUserGuestsToCsv(user.uid);
    if (result.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `all_past_guests_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "CSV Exported", description: "All past guests data downloaded." });
    } else {
      toast({ title: "CSV Export Error", description: result.error || "Failed to generate CSV.", variant: "destructive" });
    }
  };
  
  const getBadgeVariant = (status: RsvpStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'confirmed': return 'default';
      case 'declining': return 'destructive';
      case 'pending': return 'secondary';
      case 'waitlisted': return 'outline';
      default: return 'secondary';
    }
  };

  const getBadgeClassName = (status: RsvpStatus) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500 hover:bg-green-600 text-white';
      case 'declining': return ''; 
      case 'pending': return 'bg-gray-400 hover:bg-gray-500 text-white';
      case 'waitlisted': return 'bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600';
      default: return '';
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading guest data...</span>
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
        <AlertDescription>You need to be signed in to view your past guest data.</AlertDescription>
      </Alert>
    );
  }
  
  if (allGuestsData.length === 0 && !isLoading) {
    return (
      <Card className="text-center shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-center">
            <Users className="mr-2 h-6 w-6 text-primary" />
            No Past Guest Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Once you have events with invited guests, their details will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle className="flex items-center">
                <Users className="mr-2 h-6 w-6 text-primary" />
                All Past Guests
                </CardTitle>
                <CardDescription>
                A comprehensive list of all guests invited to your past events.
                </CardDescription>
            </div>
            <Button onClick={handleExportCsv} variant="outline" size="sm" disabled={allGuestsData.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export as CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Guest Email</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allGuestsData.map((guest) => (
                <TableRow key={`${guest.eventId}-${guest.guestId}`}>
                  <TableCell className="font-medium">{guest.eventName}</TableCell>
                  <TableCell>{format(new Date(guest.eventDate), "MMM d, yyyy")}</TableCell>
                  <TableCell>{guest.guestName}</TableCell>
                  <TableCell>{guest.guestEmail}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                        variant={getBadgeVariant(guest.status)} 
                        className={cn(getBadgeClassName(guest.status))}
                    >
                        {guest.status.charAt(0).toUpperCase() + guest.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
             {allGuestsData.length === 0 && (
                <TableCaption>No past guest data available.</TableCaption>
             )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
