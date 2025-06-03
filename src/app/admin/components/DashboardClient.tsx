
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAdminDashboardData, triggerAiTabulation, exportGuestsToCsv, resendInvitations, triggerSendFeedbackRequestsAction } from '../actions';
import type { InvitationData, RsvpStats, RsvpStatus, EventData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Download, MailWarning, BarChart3, Users, Activity, Send, CheckSquare, UserX, Clock, PlusCircle, CalendarClock, EyeOff, MessageSquareQuote, Info, Layers } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from "@/components/ui/progress";
import type { TabulateRsvpStatsOutput } from '@/ai/flows/tabulate-rsvps';
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import * as RechartsPrimitive from "recharts";

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

const rsvpChartConfig = {
  guests: { label: "Guests" },
  Confirmed: { label: "Confirmed", color: "hsl(var(--chart-2))" },
  Pending: { label: "Pending", color: "hsl(var(--chart-4))" },
  Declined: { label: "Declined", color: "hsl(var(--destructive))" },
  Waitlisted: { label: "Waitlisted", color: "hsl(var(--chart-5))" },
  ToRemindAI: { label: "To Remind (AI)", color: "hsl(var(--chart-1))" },
} satisfies RechartsPrimitive.ChartConfig;

const BREVO_DAILY_LIMIT = 300;

export default function DashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<RsvpStats | null>(null);
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [eventDetailsForAI, setEventDetailsForAI] = useState<string>("");
  const [guestListStringForAI, setGuestListStringForAI] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<TabulateRsvpStatsOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadData() {
      if (authLoading) return;
      if (!user) {
        setIsLoading(false);
        setCurrentEvent(null);
        setStats(null);
        setInvitations([]);
        return;
      }
      setIsLoading(true);
      const data = await fetchAdminDashboardData(user.uid);
      setCurrentEvent(data.event);
      setStats(data.stats);
      setInvitations(data.invitations);
      setEventDetailsForAI(data.eventDetails);
      setGuestListStringForAI(data.guestListString);
      setIsLoading(false);
    }
    loadData();
  }, [user, authLoading]);

  const rsvpChartData = useMemo(() => {
    const data: { category: string; guests: number; fill: string }[] = [];
    if (stats) {
      data.push({ category: "Confirmed", guests: stats.confirmed, fill: "var(--color-Confirmed)" });
      data.push({ category: "Pending", guests: stats.pending, fill: "var(--color-Pending)" });
      data.push({ category: "Declined", guests: stats.declined, fill: "var(--color-Declined)" });
      data.push({ category: "Waitlisted", guests: stats.waitlisted, fill: "var(--color-Waitlisted)" });
    }
    if (aiSummary && aiSummary.guestsToRemind.length > 0) {
      data.push({ category: "ToRemindAI", guests: aiSummary.guestsToRemind.length, fill: "var(--color-ToRemindAI)" });
    }
    return data;
  }, [stats, aiSummary]);

  const handleAiTabulation = async () => {
    if (!currentEvent || !eventDetailsForAI || !guestListStringForAI) {
      toast({ title: "Error", description: "Event data not loaded for AI tabulation.", variant: "destructive" });
      return;
    }
    setIsAiLoading(true);
    setAiSummary(null);
    const result = await triggerAiTabulation({ eventDetails: eventDetailsForAI, guestList: guestListStringForAI });
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
    const guestsToRemindInvitationIds = aiSummary.guestsToRemind
      .map(guestIdentifier => {
        // Attempt to match by name first, then by email as a fallback. This assumes guestIdentifier might be name or email.
        const inv = invitations.find(inv => inv.guestName === guestIdentifier || inv.guestEmail === guestIdentifier);
        return inv?.id;
      })
      .filter(Boolean) as string[];

    if (guestsToRemindInvitationIds.length === 0) {
        toast({ title: "No Matching Guests", description: "Could not match AI's list of guests to remind with actual invitations.", variant: "destructive"});
        return;
    }

    setIsAiLoading(true);
    const result = await resendInvitations(guestsToRemindInvitationIds);
    toast({
      title: result.success ? "Invitations Queued" : "Error",
      description: result.message,
      variant: result.success ? "default" : "destructive",
      duration: result.success ? 5000 : 8000
    });
    setIsAiLoading(false);
  };

  const handleExportCsv = async () => {
    if (!currentEvent) {
      toast({ title: "No Event Loaded", description: "Cannot export guests as no event data is loaded.", variant: "destructive" });
      return;
    }
    const result = await exportGuestsToCsv(currentEvent.id);
    if (typeof result === 'string') {
      const blob = new Blob([result], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rsvp_guests_${currentEvent.id}_${new Date().toISOString().split('T')[0]}.csv`);
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

  const handleSendFeedbackRequests = async () => {
    if (!currentEvent) {
        toast({ title: "No Event Loaded", description: "Please select an event first.", variant: "destructive" });
        return;
    }
    if (!stats || stats.confirmed === 0) {
        toast({ title: "No Confirmed Guests", description: "There are no confirmed guests for this event to send feedback requests to.", variant: "default" });
        return;
    }

    setIsSendingFeedback(true);
    const result = await triggerSendFeedbackRequestsAction(currentEvent.id);
    if (result.success) {
        toast({
            title: "Feedback Requests Queued",
            description: result.message, // Message now explains queuing and limits
            duration: 10000,
        });
    } else {
        toast({
            title: "Error Queuing Feedback Requests",
            description: result.message,
            variant: "destructive",
        });
    }
    setIsSendingFeedback(false);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const confirmedPercentage = stats && stats.totalSeats > 0 ? (stats.confirmed / stats.totalSeats) * 100 : 0;

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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
          {currentEvent && (
            <p className="text-lg text-muted-foreground flex items-center">
              <CalendarClock className="mr-2 h-5 w-5" />
              Showing stats for your event: <strong className="ml-1 text-foreground">{currentEvent.name}</strong> (Most Recent)
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/admin/create-event">
            <PlusCircle className="mr-2 h-5 w-5" />
            Create New Event
          </Link>
        </Button>
      </div>

      {!user ? (
        <Card className="shadow-lg">
          <CardHeader><CardTitle>Not Authenticated</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Please <Link href="/auth" className="underline text-primary">sign in</Link> to view your dashboard.</p></CardContent>
        </Card>
      ) : !currentEvent && !isLoading ? (
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><EyeOff className="mr-2 h-6 w-6 text-muted-foreground"/>No Event Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">You haven't created any events yet, or your most recent event could not be loaded.</p>
            <Button asChild className="mt-4">
                <Link href="/admin/create-event">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create Your First Event
                </Link>
            </Button>
          </CardContent>
        </Card>
      ) : currentEvent && stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <StatCard title="Total Invited" value={invitations.length} icon={Users} description="Total number of guests invited." />
            <StatCard title="Confirmed RSVPs" value={stats.confirmed} icon={CheckSquare} description={`${confirmedPercentage.toFixed(1)}% of capacity`} className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700" />
            <StatCard title="Pending RSVPs" value={stats.pending} icon={MailWarning} description="Guests who haven't responded." className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700"/>
            <StatCard title="Declined RSVPs" value={stats.declined} icon={UserX} description="Guests who cannot attend." className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700"/>
            <StatCard title="Waitlisted" value={stats.waitlisted} icon={Clock} description="Guests on the waitlist." className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"/>
          </div>

          {stats.totalSeats > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Event Capacity</CardTitle>
                <CardDescription>{`${stats.confirmed} / ${stats.totalSeats === Infinity ? 'Unlimited' : stats.totalSeats} seats filled`}</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.totalSeats !== Infinity && <Progress value={confirmedPercentage} className="w-full h-4" />}
                <p className="text-sm text-muted-foreground mt-2">
                    {stats.totalSeats === Infinity ? "This event has unlimited capacity." : (stats.availableSeats > 0 ? `${stats.availableSeats} seats remaining` : 'No seats remaining')}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>AI RSVP Analysis & Actions</CardTitle>
              <CardDescription>Visualize RSVP distribution and use AI to tabulate stats and identify guests to remind.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rsvpChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ChartContainer config={rsvpChartConfig} className="h-full w-full">
                    <RechartsPrimitive.BarChart
                      data={rsvpChartData}
                      layout="horizontal"
                      margin={{ top: 5, right: 20, left: 5, bottom: 20 }}
                    >
                      <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" vertical={false}/>
                      <RechartsPrimitive.XAxis
                        dataKey="category"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => rsvpChartConfig[value as keyof typeof rsvpChartConfig]?.label || value}
                        interval={0}
                      />
                      <RechartsPrimitive.YAxis dataKey="guests" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltipContent />}
                      />
                      <RechartsPrimitive.Bar dataKey="guests" radius={[4, 4, 0, 0]} barSize={40}>
                        {rsvpChartData.map((entry) => (
                          <RechartsPrimitive.Cell key={`cell-${entry.category}`} fill={entry.fill} />
                        ))}
                      </RechartsPrimitive.Bar>
                    </RechartsPrimitive.BarChart>
                  </ChartContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No data available for chart yet. Load event data or run AI tabulation.</p>
              )}

              <div className="flex space-x-4">
                <Button onClick={handleAiTabulation} disabled={isAiLoading || !currentEvent}>
                  <BarChart3 className="mr-2 h-4 w-4" /> {isAiLoading && !aiSummary ? 'Analyzing...' : 'Run AI Tabulation'}
                </Button>
                {aiSummary && aiSummary.guestsToRemind.length > 0 && (
                  <Button onClick={handleResendInvitations} disabled={isAiLoading} variant="outline">
                    <Send className="mr-2 h-4 w-4" /> {isAiLoading && aiSummary ? 'Queuing...' : `Queue Resend to ${aiSummary.guestsToRemind.length} Unresponsive`}
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <CardTitle>Guest List</CardTitle>
                    <CardDescription>Overview of all invited guests and their RSVP status for the current event.</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button
                        onClick={handleSendFeedbackRequests}
                        variant="outline"
                        size="sm"
                        disabled={!currentEvent || !stats || stats.confirmed === 0 || isSendingFeedback}
                        className="w-full sm:w-auto"
                    >
                      <Layers className="mr-2 h-4 w-4" />
                      {isSendingFeedback ? 'Queuing Feedback Requests...' : `Queue Feedback Requests (${stats?.confirmed || 0} confirmed)`}
                    </Button>
                    <Button onClick={handleExportCsv} variant="outline" size="sm" disabled={!currentEvent} className="w-full sm:w-auto">
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Alert variant="default" className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-900/30">
                <MailWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-700 dark:text-amber-300">Email Sending & Queueing Notice</AlertTitle>
                <AlertDescription className="text-sm text-amber-600 dark:text-amber-400">
                    Actions like sending/resending invitations or feedback requests now add emails to a processing queue.
                    Actual sending happens in the background. Current demo uses Brevo's free tier (limited to {BREVO_DAILY_LIMIT} emails/day).
                    For future larger events we're going to implement a more robust queueing system and appropriate email plan with worker logic.
                </AlertDescription>
              </Alert>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>RSVP'd At</TableHead>
                      <TableHead>Visited Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length > 0 ? invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.guestName}</TableCell>
                        <TableCell>{inv.guestEmail}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getBadgeVariant(inv.status)}
                            className={cn(getBadgeClassName(inv.status))}
                          >
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="truncate max-w-xs text-xs">{inv.uniqueToken}</TableCell>
                        <TableCell>{inv.rsvpAt ? new Date(inv.rsvpAt).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>{inv.visited ? 'Yes' : 'No'}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">No invitations found for this event.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card className="shadow-lg">
        <CardHeader><CardTitle>Developer Notes / TODOs</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>Firestore Setup:</strong> Ensure Firebase Admin SDK is configured. Composite indexes might be needed (check server logs for links). Events, Invitations, and Feedback collections have specific index requirements mentioned in `db.ts` comments.</p>
            <p>• <strong>Email Queueing:</strong> Critical for >300 guests. Current implementation queues emails conceptually (logs to console & DB status 'queued'). Production requires real queue (Cloud Tasks/PubSub) & worker functions.</p>
            <p>• <strong>Feedback System:</strong> Feedback form & storage in place. Feedback summary for AI analysis uses simple concatenation; could be enhanced with an AI summarization flow.</p>
            <p>• <strong>Waitlist Management:</strong> UI and accept/decline logic implemented. Emails are queued.</p>
        </CardContent>
      </Card>
    </div>
  );
}
