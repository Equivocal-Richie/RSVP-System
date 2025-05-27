
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAdminDashboardData, triggerAiTabulation, exportGuestsToCsv, resendInvitations } from '../actions';
import type { InvitationData, RsvpStats, RsvpStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Download, MailWarning, BarChart3, Users, Activity, Send, CheckSquare, UserX, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from "@/components/ui/progress";
import type { TabulateRsvpStatsOutput } from '@/ai/flows/tabulate-rsvps';
import { cn } from "@/lib/utils"; // Import cn from lib/utils

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart";
import * as RechartsPrimitive from "recharts";

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

// Chart configuration - defined outside component or memoized if dynamic
const rsvpChartConfig = {
  guests: { label: "Guests" }, // General label for the 'count' dataKey
  Confirmed: { label: "Confirmed", color: "hsl(var(--chart-2))" },
  Pending: { label: "Pending", color: "hsl(var(--chart-4))" },
  Declined: { label: "Declined", color: "hsl(var(--destructive))" },
  Waitlisted: { label: "Waitlisted", color: "hsl(var(--chart-5))" },
  ToRemindAI: { label: "To Remind (AI)", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

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
    const guestsToRemindIds = aiSummary.guestsToRemind
      .map(guestIdentifier => invitations.find(inv => inv.guestName === guestIdentifier || inv.guestEmail === guestIdentifier)?.id)
      .filter(Boolean) as string[];

    if (guestsToRemindIds.length === 0) {
        toast({ title: "No Matching Guests", description: "Could not match AI's list of guests to remind with actual invitations.", variant: "destructive"});
        return;
    }

    setIsAiLoading(true);
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
  
  const getBadgeVariant = (status: RsvpStatus) => {
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
      case 'confirmed': return 'bg-green-500 hover:bg-green-600';
      case 'declining': return ''; 
      case 'pending': return 'bg-gray-400 hover:bg-gray-500';
      case 'waitlisted': return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      default: return '';
    }
  };


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard title="Total Invited" value={invitations.length} icon={Users} description="Total number of guests invited." />
        <StatCard title="Confirmed RSVPs" value={stats?.confirmed ?? 0} icon={CheckSquare} description={`${confirmedPercentage.toFixed(1)}% of capacity`} className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700" />
        <StatCard title="Pending RSVPs" value={stats?.pending ?? 0} icon={MailWarning} description="Guests who haven't responded." className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700"/>
        <StatCard title="Declined RSVPs" value={stats?.declined ?? 0} icon={UserX} description="Guests who cannot attend." className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700"/>
        <StatCard title="Waitlisted" value={stats?.waitlisted ?? 0} icon={Clock} description="Guests on the waitlist." className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"/>
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
          <CardDescription>Visualize RSVP distribution and use AI to tabulate stats and identify guests to remind.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {rsvpChartData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ChartContainer config={rsvpChartConfig} className="h-full w-full">
                <RechartsPrimitive.BarChart
                  data={rsvpChartData}
                  layout="horizontal"
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }} // Adjust left margin for YAxis labels
                >
                  <RechartsPrimitive.CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <RechartsPrimitive.XAxis
                    dataKey="category"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => rsvpChartConfig[value as keyof typeof rsvpChartConfig]?.label || value}
                  />
                  <RechartsPrimitive.YAxis dataKey="guests" tickLine={false} axisLine={false} tickMargin={8} />
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
                       <Badge 
                        variant={getBadgeVariant(inv.status)} 
                        className={cn(getBadgeClassName(inv.status))}
                       >
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
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
            <p>• <strong>Firestore Setup:</strong> Ensure Firebase Admin SDK is configured with credentials in environment variables.</p>
            <p>• <strong>Data Seeding:</strong> Manually add initial event (ID: {EVENT_ID}) and guest data to Firestore for the app to function.</p>
            <p>• <strong>Email Integration:</strong> Actual email sending for (re-)invitations needs SendGrid/Firebase Functions setup (Email Logs table is ready).</p>
            <p>• <strong>Guest Management:</strong> Full CRUD for guests (edit name/email, add/delete) not implemented.</p>
            <p>• <strong>Authentication:</strong> Admin dashboard is currently public. Add authentication.</p>
            <p>• <strong>Error Handling:</strong> More robust error handling and edge case management (e.g. Firestore offline).</p>
            <p>• <strong>Waitlist UI:</strong> Form doesn't auto-waitlist yet; 'waitlisted' status primarily for DB schema & admin use for now.</p>
        </CardContent>
      </Card>
    </div>
  );
}

