
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEventAnalyticsData } from '../actions';
import type { EventAnalyticRow } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Activity, BarChart3, ArrowUpCircle, ArrowDownCircle, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AnalyticsClient() {
  const { user, loading: authLoading } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<EventAnalyticRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadAnalytics() {
      if (authLoading) return;
      if (!user) {
        setError("Please sign in to view event analytics.");
        setIsLoading(false);
        setAnalyticsData([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      const result = await fetchEventAnalyticsData(user.uid);

      if (result.error) {
        setError(result.error);
        toast({ title: "Error Loading Analytics", description: result.error, variant: "destructive" });
        setAnalyticsData([]);
      } else {
        setAnalyticsData(result.analytics);
      }
      setIsLoading(false);
    }
    loadAnalytics();
  }, [user, authLoading, toast]);

  const handleAiAnalysis = (eventId: string, eventName: string) => {
    // Placeholder for actual AI analysis call
    toast({
      title: "AI Analysis Triggered (Placeholder)",
      description: `AI analysis for "${eventName}" would be processed here.`,
    });
    console.log("Trigger AI Analysis for event ID:", eventId);
    // Later, this would call a server action that invokes a Genkit flow
    // e.g., const result = await triggerEventAiAnalysis(eventId);
    // And then display results, perhaps in a dialog or below the table row.
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Activity className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-lg">Loading analytics...</span>
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
        <AlertDescription>You need to be signed in to view your event analytics.</AlertDescription>
      </Alert>
    );
  }
  
  if (analyticsData.length === 0 && !isLoading) {
    return (
      <Card className="text-center shadow-lg">
        <CardHeader>
          <CardTitle>No Event Analytics Yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Once you have past events, their performance analytics will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-6 w-6 text-primary" />
            Event Performance Analytics
          </CardTitle>
          <CardDescription>
            Review metrics for your past events to understand engagement and success.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Confirmed</TableHead>
                <TableHead className="text-center">Capacity Filled</TableHead>
                <TableHead className="text-center">Change vs Prev.</TableHead>
                <TableHead className="text-right">AI Analysis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyticsData.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell className="font-medium">{event.eventName}</TableCell>
                  <TableCell>{format(new Date(event.eventDate), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-center">{event.confirmedGuests}</TableCell>
                  <TableCell className="text-center">
                    {event.capacityFilledPercentage !== null 
                      ? `${event.capacityFilledPercentage.toFixed(1)}%` 
                      : (event.seatLimit <=0 ? 'Unlimited' : 'N/A')}
                     {event.seatLimit > 0 && <span className="text-xs text-muted-foreground block">({event.confirmedGuests}/{event.seatLimit})</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {event.changeFromPreviousPercentage !== null ? (
                      <span className={cn(
                        "flex items-center justify-center font-semibold",
                        event.changeFromPreviousPercentage > 0 && "text-green-600",
                        event.changeFromPreviousPercentage < 0 && "text-red-600"
                      )}>
                        {event.changeFromPreviousPercentage > 0 ? <ArrowUpCircle className="mr-1 h-4 w-4" /> : <ArrowDownCircle className="mr-1 h-4 w-4" />}
                        {event.changeFromPreviousPercentage > 0 ? '+' : ''}
                        {event.changeFromPreviousPercentage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleAiAnalysis(event.eventId, event.eventName)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
             {analyticsData.length === 0 && (
                <TableCaption>No event analytics data available yet.</TableCaption>
             )}
          </Table>
        </CardContent>
      </Card>
       <Alert variant="default" className="bg-card border-primary/30">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Understanding The Metrics</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Capacity Filled:</strong> Percentage of available seats filled (if seat limit was set).</li>
                <li><strong>Change vs Prev.:</strong> Difference in 'Capacity Filled %' compared to the event held immediately before this one (if both had seat limits).</li>
                <li><strong>AI Analysis:</strong> (Future Feature) Click to get AI-powered insights and suggestions for a specific event.</li>
            </ul>
          </AlertDescription>
        </Alert>
    </div>
  );
}
