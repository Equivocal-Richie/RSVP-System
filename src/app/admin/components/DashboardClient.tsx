
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAdminDashboardData, triggerAiTabulation, exportGuestsToCsv, resendInvitations } from '../actions';
import type { InvitationData, RsvpStats } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Download, MailWarning, BarChart3, Users, Activity, Send, CheckSquare, UserX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type { TabulateRsvpStatsOutput } from '@/ai/flows/tabulate-rsvps';

const EVENT_ID = "event123"; // Assuming a single event for now

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, description, className }) => (
  <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function DashboardClient() {
  const [stats, setStats] = useState<RsvpStats | null>(null);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [eventDetails, setEventDetails] = useState<string>("");
  const [guestListString, setGuestListString] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<TabulateRsvpStatsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const data = await fetchAdminDashboardData(EVENT_ID);
      setStats(data.stats);
      setInvitations(data.invitations);
      setEventDetails(data.eventDetails);
      setGuestListString(data.guestListString);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleAiTabulation = async () => {
    if (!eventDetails || !guestListString) {
      toast({ title: "Error", description: "Event data not loaded for AI tabulation.", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    setAiSummary(null);
    const result = await triggerAiTabulation({ eventDetails, guestList: guestListString });
    if ("error" in result) {
      toast({ title: "AI Tabulation Error", description: result.error, variant: "destructive" });
    } else {
      setAiSummary(result);
      toast({ title: "AI Tabulation Complete", description: "RSVP stats processed by AI." });
    }
    setIsAiLoading(false);
  };

  const handleResendInvitations = async () => {
    if (!aiSummary || !aiSummary.guestsToRemind || aiSummary.guestsToRemind.length === 0) {
      toast({ title: "No Guests to Remind", description: "AI analysis found no guests needing reminders, or analysis not run.", variant: "default" });
      return;
    }
    // In a real app, guestsToRemind might be full guest objects or detailed identifiers.
    // Here it's a list of strings, assumed to be guest names or emails from the prompt.
    // We'll map them to invitation IDs if possible.
    const guestsToRemindIds = aiSummary.guestsToRemind
      .map(guestIdentifier => invitations.find(inv => inv.guestName === guestIdentifier || inv.guestEmail === guestIdentifier)?.id)
      .filter(Boolean) as string[];

    if (guestsToRemindIds.length === 0) {
        toast({ title: "No Matching Guests", description: "Could not match AI's list of guests to remind with actual invitations.", variant: "destructive"});
        return;
    }

    setIsAiLoading(true); // Reuse for this loading state
    const result = await resendInvitations(guestsToRemindIds);
    toast({ title: result.success ? "Success" : "Error", description: result.message, variant: result.success ? "default" : "destructive"});
    setIsAiLoading(false);
  };

  const handleExportCsv = async () => {
    const result = await exportGuestsToCsv(EVENT_ID);
    if (typeof result === 'string') {
      const blob = new Blob([result], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rsvp_guests_${EVENT_ID}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "CSV Exported", description: "Guest list downloaded." });
      }
    } else {
      toast({ title: "CSV Export Error", description: result.error, variant: "destructive" });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const confirmedPercentage = stats && stats.totalSeats > 0 ? (stats.confirmed / stats.totalSeats) * 100 : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Invited" value={invitations.length} icon={Users} description="Total number of guests invited." />
        <StatCard title="Confirmed RSVPs" value={stats?.confirmed ?? 0} icon={CheckSquare} description={`${confirmedPercentage.toFixed(1)}% of capacity`} className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700" />
        <StatCard title="Pending RSVPs" value={stats?.pending ?? 0} icon={MailWarning} description="Guests who haven't responded." className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700"/>
        <StatCard title="Declined RSVPs" value={stats?.declined ?? 0} icon={UserX} description="Guests who cannot attend." className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700"/>
      </div>

      {stats && stats.totalSeats > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Event Capacity</CardTitle>
            <CardDescription>{`${stats.confirmed} / ${stats.totalSeats} seats filled`}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={confirmedPercentage} className="w-full h-4" />
            <p className="text-sm text-muted-foreground mt-2">{stats.availableSeats} seats remaining</p>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>AI RSVP Analysis & Actions</CardTitle>
          <CardDescription>Use AI to tabulate stats and identify guests to remind. Then, resend invitations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
            <Button onClick={handleAiTabulation} disabled={isAiLoading}>
              <BarChart3 className="mr-2 h-4 w-4" /> {isAiLoading && !aiSummary ? 'Analyzing...' : 'Run AI Tabulation'}
            </Button>
            {aiSummary && aiSummary.guestsToRemind.length > 0 && (
               <Button onClick={handleResendInvitations} disabled={isAiLoading} variant="outline">
                <Send className="mr-2 h-4 w-4" /> {isAiLoading && aiSummary ? 'Sending...' : `Resend to ${aiSummary.guestsToRemind.length} Unresponsive`}
              </Button>
            )}
          </div>
          {isAiLoading && !aiSummary && <p className="text-sm text-muted-foreground">AI is processing the guest list...</p>}
          {aiSummary && (
            <Alert className="mt-4">
              <BarChart3 className="h-4 w-4" />
              <AlertTitle>AI Analysis Results</AlertTitle>
              <AlertDescription>
                <p><strong>Summary:</strong> {aiSummary.summary}</p>
                {aiSummary.guestsToRemind.length > 0 ? (
                  <>
                    <p className="mt-2"><strong>Guests to remind ({aiSummary.guestsToRemind.length}):</strong></p>
                    <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                      {aiSummary.guestsToRemind.map((guest, index) => <li key={index}>{guest}</li>)}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2">No guests currently need a reminder according to AI analysis.</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Guest List</CardTitle>
            <Button onClick={handleExportCsv} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <CardDescription>Overview of all invited guests and their RSVP status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>RSVP'd At</TableHead>
                  <TableHead>Visited Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.guestName}</TableCell>
                    <TableCell>{inv.guestEmail}</TableCell>
                    <TableCell>
                      <Badge variant={
                        inv.status === 'attending' ? 'default' : 
                        inv.status === 'declining' ? 'destructive' : 'secondary'
                      } className={inv.status === 'attending' ? 'bg-green-500 hover:bg-green-600' : ''}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{inv.rsvpAt ? new Date(inv.rsvpAt).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{inv.visited ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
           {invitations.length === 0 && <p className="text-center text-muted-foreground py-4">No invitations found for this event.</p>}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Developer Notes / TODOs</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Email Integration:</strong> Actual email sending for (re-)invitations needs SendGrid/Firebase Functions setup.</p>
            <p>• <strong>Guest Management:</strong> Full CRUD for guests (edit name/email, add/delete) not implemented.</p>
            <p>• <strong>Authentication:</strong> Admin dashboard is currently public. Add authentication.</p>
            <p>• <strong>Error Handling:</strong> More robust error handling and edge case management.</p>
            <p>• <strong>Multiple Events:</strong> UI currently assumes a single event (ID: {EVENT_ID}).</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper cn function if not globally available or for standalone components
function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}

